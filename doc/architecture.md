# ValoCoach Archive — アーキテクチャ図

## システム全体図

```mermaid
graph TB
  subgraph Client["ブラウザ (Client)"]
    UI["Astro SSR + React Islands<br/>FilterPanel / VideoGrid / VideoPlayer"]
  end

  subgraph CF_Pages["Cloudflare Pages (Frontend)"]
    ASTRO["Astro SSR Worker<br/>index.astro → HTML + hydration"]
  end

  subgraph CF_Workers["Cloudflare Workers (API + Jobs)"]
    direction TB
    API["Hono API Worker<br/>/api/videos<br/>/api/videos/filters<br/>/api/admin/*"]
    CRON["Cron Worker<br/>0 0 * * * (毎日深夜)<br/>YouTube取得 + Regex + waitUntil"]
    AI_WORKER["aiTaggingWorker<br/>waitUntil ベース<br/>LLMタグ付け (最大500件)"]
  end

  subgraph CF_D1["Cloudflare D1 (Database)"]
    DB[("SQLite<br/>videos<br/>ai_tagging_jobs")]
  end

  subgraph External["外部サービス"]
    YT["YouTube Data API v3<br/>search.list / videos.list<br/>10,000 units/day"]
    TN["YouTube Thumbnail CDN<br/>img.youtube.com<br/>無料・認証不要"]
    GEMINI["Google Gemini API<br/>gemini-2.0-flash-exp (default)<br/>vision + responseJsonSchema"]
    ANTHROPIC["Anthropic API<br/>claude-haiku-4-5 (fallback)<br/>text + vision / tool_use"]
  end

  UI -->|"① ページリクエスト"| ASTRO
  ASTRO -->|"② /api/videos/filters"| API
  UI -->|"③ フィルター変更\nGET /api/videos?map=&agent="| API
  API -->|"Drizzle SELECT"| DB
  API -->|"④ JSON レスポンス"| UI

  CRON -->|"⑤ search.list\nvideos.list"| YT
  CRON -->|"⑥ INSERT + Regex tag"| DB
  CRON -->|"⑦ ctx.waitUntil(tagPendingVideos)"| AI_WORKER

  AI_WORKER -->|"⑧ サムネイル取得"| TN
  AI_WORKER -->|"⑨ Vision 推論 (default)"| GEMINI
  AI_WORKER -->|"⑨' Vision 推論 (fallback)"| ANTHROPIC
  AI_WORKER -->|"⑩ UPDATE confidence/source"| DB

  style CF_Pages fill:#f0f7ff,stroke:#4a90d9
  style CF_Workers fill:#fff3e0,stroke:#f5a623
  style CF_D1 fill:#e8f5e9,stroke:#4caf50
  style External fill:#f3e5f5,stroke:#9c27b0
```

## データフロー詳細

### フロー①〜④: ユーザーの動画閲覧

```mermaid
sequenceDiagram
  actor User as 視聴者
  participant Astro as Astro SSR
  participant Hono as Hono API
  participant D1 as Cloudflare D1

  User->>Astro: GET / (or /?map=Ascent&agent=Jett)
  Astro->>Hono: GET /api/videos/filters
  Hono->>D1: SELECT DISTINCT map, agent, rank, channel_title
  D1-->>Hono: フィルター選択肢
  Hono-->>Astro: JSON
  Astro-->>User: HTML (静的シェル + 初期データ)

  Note over User,Astro: React Islands 水和 (FilterPanel, VideoGrid)

  User->>Hono: GET /api/videos?map=Ascent&agent=Jett&page=1
  Hono->>D1: SELECT * FROM videos WHERE map=? AND agent=? AND is_valorant_coaching=1
  D1-->>Hono: 動画レコード一覧
  Hono-->>User: JSON {videos, total, page}
```

### フロー⑤〜⑩: YouTube同期 + AIタグ付け

```mermaid
sequenceDiagram
  participant Cron as Cron Worker (毎日深夜)
  participant YT as YouTube API
  participant D1 as Cloudflare D1
  participant Worker as aiTaggingWorker (waitUntil)
  participant TN as Thumbnail CDN
  participant AI as Gemini Flash (or Claude Haiku)

  Cron->>YT: search.list (channel別, 100units/req)
  YT-->>Cron: 動画ID一覧
  Cron->>YT: videos.list (50本まとめて, 1unit/50本)
  YT-->>Cron: snippet + contentDetails
  Cron->>D1: UPSERT videos (Regex tag同時実行)
  Cron->>Worker: ctx.waitUntil(tagPendingVideos) ← pending/failed動画をまとめて処理

  loop pending/failed 動画 (最大500件)
    Worker->>TN: fetch maxresdefault.jpg
    TN-->>Worker: JPEG画像
    Worker->>AI: Vision API (base64 image + JSON schema)
    AI-->>Worker: {map, agent, rank, confidence}
    Worker->>D1: UPDATE videos SET map=?, agent=?, rank=?, ...
    Worker->>D1: INSERT ai_tagging_jobs (監査ログ)
  end
```

> **注**: 字幕LLM (caption_llm) はYouTube字幕取得不可のためデフォルトスキップ。
> `skipCaptionLLM === false` で明示指定した場合のみ実行。

## コンポーネント責務

| コンポーネント | 責務 | 技術 |
|---|---|---|
| Astro SSR | 初期ページレンダリング・SEO・フィルター選択肢取得 | Astro 5 + Cloudflare adapter |
| FilterPanel | map/agent/rank/coachフィルターUI・URL params管理 | React + URL Search Params |
| VideoGrid | 動画カード一覧・ページング | React |
| VideoPlayer | YouTube iframe embed | React (client:visible) |
| Hono API | フィルタークエリ・Zod バリデーション・管理エンドポイント | Hono + Drizzle + D1 |
| Cron Worker | YouTube取得・Regexタグ付け・waitUntil でLLMタグ付けトリガー | Hono scheduled handler |
| aiTaggingWorker | pending/failed動画のLLMタグ付け・DB更新 (waitUntilベース) | TypeScript (Queues不要) |
| Regex Extractor | タイトル/タグ/説明から単語境界マッチで抽出（無料・同期） | TypeScript regex |
| Caption Fetcher | YouTube Timedtext VTTを取得・整形 (デフォルトスキップ) | fetch() |
| Caption LLM | テキスト解析・構造化出力 (デフォルトスキップ) | fetch() → Gemini / Anthropic API |
| Thumbnail LLM | Vision でサムネイル解析・構造化出力 (デフォルト実行) | fetch() → Gemini / Anthropic API |
| Pipeline | 2段階抽出の統合・信頼度重みによるマージ | TypeScript |

## 管理エンドポイント一覧

| エンドポイント | メソッド | 用途 |
|---|---|---|
| `/api/admin/sync` | POST | 手動Cronトリガー (waitUntil) |
| `/api/admin/test-collect` | POST | 最大N動画収集+LLM即時実行（検証用） |
| `/api/admin/search-collect` | POST | クエリ検索で収集+DB保存 |
| `/api/admin/retag/:videoId` | POST | 単体再タグ付け (waitUntil) |
| `/api/admin/retag-batch` | POST | pending/failed一括タグ付け (waitUntil) |
| `/api/admin/videos/:videoId/reject` | POST | 偽陽性を非表示 (is_valorant_coaching=0) |
| `/api/admin/videos/:videoId/restore` | POST | 非表示を元に戻す (is_valorant_coaching=1) |

## デプロイ構成

```mermaid
graph LR
  subgraph GitHub
    GH[リポジトリ push]
  end
  subgraph Cloudflare
    CP[Pages\nweb/ → Astro build]
    CW[Workers\napi/ → wrangler deploy]
    CD1[D1 Database\ndrizzle-kit migrate]
  end

  GH -->|Pages CI| CP
  GH -->|wrangler deploy| CW
  CW --- CD1
```

## 環境変数・シークレット

| 変数名 | スコープ | 用途 |
|---|---|---|
| `YOUTUBE_API_KEY` | Workers secret | YouTube Data API v3 認証 |
| `GEMINI_API_KEY` | Workers secret | Gemini Flash API 認証 (default LLM) |
| `ANTHROPIC_API_KEY` | Workers secret | Claude Haiku API 認証 (fallback LLM) |
| `SYNC_SECRET` | Workers secret | /api/admin/* 保護 (Bearer トークン) |
| `LLM_PROVIDER` | Workers vars (wrangler.toml) | `"gemini"` または `"anthropic"` で切り替え |
| `API_BASE_URL` | Pages env | AstroからHono APIへのベースURL |

設定方法:
```bash
wrangler secret put YOUTUBE_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put SYNC_SECRET
# LLM_PROVIDER は wrangler.toml の [vars] で設定 (secret不要)
```
