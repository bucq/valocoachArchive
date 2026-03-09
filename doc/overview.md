# ValoCoach Archive — システム概要 & Valorant 基本情報

## システム概要

### ValoCoach Archive とは
ValorantのYouTubeコーチング動画を自動収集・分類し、**map / agent / rank / コーチ**の軸でフィルタリングして視聴できるWebアプリ。

コーチング動画はYouTubeに大量に存在するが、「特定のマップでJettを使う場合のコーチング」など絞り込みが難しい。本サービスはAIを使って動画メタデータを自動タグ付けし、目的の動画を素早く発見できるようにする。

### 主な機能
- **自動収集**: 登録済みコーチチャンネルから新着動画を毎日自動収集
- **AIタグ付け**: 動画タイトル・サムネイルをAI解析してmap/agent/rankを自動分類
- **フィルター検索**: map・agent・rank・coachの組み合わせでワンクリック絞り込み
- **シェア可能URL**: フィルター状態をURLに保持し、特定の検索条件を共有可能

### 技術スタック

| レイヤー | 技術 | 用途 |
|---|---|---|
| Frontend | Astro 5 + React Islands + Tailwind CSS | SSR + クライアント部分水和 |
| API / Worker | Hono on Cloudflare Workers | REST API + Cron処理 |
| Database | Cloudflare D1 (SQLite) | 動画メタデータ保存 |
| ORM | Drizzle ORM | 型安全クエリ |
| AI (default) | Google Gemini Flash (Vision) | サムネイル画像解析・構造化JSON出力 |
| AI (fallback) | Anthropic Claude Haiku (Vision) | 同上 (LLM_PROVIDERで切り替え) |
| YouTube | YouTube Data API v3 | 動画・チャンネル情報取得 |
| Package Manager | pnpm (monorepo) | パッケージ管理 |
| Deploy | Cloudflare Pages / Workers | フロント/API それぞれデプロイ |

### ディレクトリ構成

```
valoStudy/
├── apps/
│   ├── web/                    # Astro 5 フロントエンド
│   │   └── src/
│   │       ├── pages/index.astro
│   │       ├── components/
│   │       │   ├── FilterPanel.tsx   (client:load)
│   │       │   ├── VideoGrid.tsx     (client:load)
│   │       │   ├── VideoCard.tsx
│   │       │   └── VideoPlayer.tsx   (client:visible)
│   │       └── lib/api.ts
│   └── api/                    # Hono + Cloudflare Workers
│       └── src/
│           ├── index.ts              # エントリ + Cron (waitUntil)
│           ├── routes/
│           │   ├── videos.ts         # GET /api/videos, /api/videos/filters
│           │   └── admin.ts          # POST /api/admin/*
│           ├── db/
│           │   ├── schema.ts         # Drizzle スキーマ
│           │   └── migrations/0001_initial.sql
│           ├── services/
│           │   ├── youtube.ts        # YouTube Data API v3
│           │   ├── coaches.ts        # コーチチャンネルレジストリ
│           │   ├── sync.ts           # Cron 同期サービス
│           │   └── aiTaggingWorker.ts # waitUntil ベースのLLMタグ付け
│           └── extractors/
│               ├── types.ts
│               ├── valorant.ts       # MAPS, AGENTS, RANKS 定数
│               ├── regexExtractor.ts
│               ├── captionFetcher.ts
│               ├── captionLLMExtractor.ts
│               ├── thumbnailExtractor.ts
│               └── pipeline.ts       # 2段階パイプライン
└── doc/                        # ドキュメント
    ├── overview.md  ← このファイル
    ├── architecture.md
    ├── er.md
    └── usecase.md
```

### コスト概算

| 項目 | 詳細 |
|---|---|
| 初回タグ付け (10,000動画) | ~$3.69 (Gemini Flash Vision) |
| YouTube API | 10,000 units/日制限（毎日0時Cronで余裕あり） |
| Cloudflare 無料枠 | 100K req/日、D1 500MB、Workers 10ms CPU/req |

---

## Valorant 基本情報

### ゲーム概要
Valorant（ヴァロラント）はRiot Gamesが開発・運営するタクティカルFPS。2020年6月にリリース。5v5の攻守交替制で、攻撃側はスパイク（爆弾）を設置、守備側は解除を目指す。

各プレイヤーはラウンド開始前に**エージェント（キャラクター）**を選択し、固有のアビリティを駆使して戦う。ゲームの勝敗はエージェント選択・マップ理解・ランクに応じた戦術理解が重要で、コーチング需要が高い。

---

### マップ一覧（全12マップ）

| マップ | 特徴 |
|---|---|
| **Ascent** | 中央サイトのドア・ゲートが攻防の鍵。最もスタンダードな構造 |
| **Bind** | テレポーターが2か所。3サイト構造ではなく2サイト |
| **Breeze** | 広大なオープンエリア。スナイパーやロングレンジが強い |
| **Fracture** | H字型。攻撃側がマップ両端からスポーン。独特な攻撃ルート |
| **Haven** | 珍しい3サイト構造（A/B/C）。守備側の情報管理が難しい |
| **Icebox** | 縦に長く立体構造。ロープ・クレートを活用した垂直移動 |
| **Lotus** | 3サイト構造。回転扉がサイト間の移動を変える |
| **Pearl** | 地下構造。ミッドが重要な2サイトマップ |
| **Split** | 狭く縦長なマップ。ロープ活用とミッドコントロールが鍵 |
| **Sunset** | 市街地風。ミッドのドアが攻防に大きく影響 |
| **Abyss** | 縁から落下死あり。マップ端の壁がない独自メカニクス |
| **Corrode** | 新マップ |

> **Regexエイリアス**: `fracture/frac`, `icebox/ice box`, `kayo/kay/o/kay o`, `brimstone/brim`, `killjoy/kj`

---

### エージェント一覧（全27エージェント）

エージェントはロールによって4種類に分類される。コーチング動画ではロール別に戦術が異なるため、ロール理解が重要。

#### Duelist（デュエリスト）— 7人
自己完結型の攻撃特化。単独でのエントリー・フラグ獲得が得意。
コーチング需要が最も高いロール。

| エージェント | 特徴 |
|---|---|
| **Jett** | 機動力最高。ダッシュ・ホバーで縦横無尽。スナイパー（Operator）との相性抜群 |
| **Reyna** | キルで自己回復・無敵。初心者にも人気の1v1特化 |
| **Raze** | 爆発物アビリティで広範囲ダメージ。グレネード・ロケットランチャー |
| **Phoenix** | 自己回復+フラッシュ。Ultimate で再出現 |
| **Neon** | 超高速スプリント。スライドで奇襲 |
| **Iso** | シールドとバリアで1v1デュエル特化 |
| **Waylay** | 高速移動とリプレイメカニクスを持つ最新エージェント |

#### Initiator（イニシエーター）— 7人
チームのエントリーをサポート。情報収集・フラッシュ・スタン提供。

| エージェント | 特徴 |
|---|---|
| **Sova** | リコンボルト・ドローンで広範囲索敵。Ultimate でマップ越し射撃 |
| **Breach** | スタン・フラッシュを壁越しに使用。チームとの連携が鍵 |
| **Skye** | ヒール付きイニシエーター。フラッシュ・索敵犬 |
| **KAY/O** | アビリティを無効化するグレネード。敵の妨害に特化 |
| **Fade** | 索敵+スタン。Prowler（追跡体）で敵を追い詰める |
| **Gekko** | ユニークなクリーチャーアビリティ。回収して再使用可能 |
| **Tejo** | 誘導ミサイルと電磁パルスグレネードを持つ最新イニシエーター |

#### Controller（コントローラー）— 6人
スモーク・壁で視線を切り、エリアコントロールを担う。

| エージェント | 特徴 |
|---|---|
| **Brimstone** | 遠隔スモーク・ストライクが強力。初心者でも扱いやすいコントローラー |
| **Viper** | ウォール・スモーク・オービで強烈な毒エリア展開。上級者向け |
| **Omen** | テレポートとスモークで欺く。奇襲型コントローラー |
| **Astra** | 全マップに星を設置してスモーク・スタン・引き寄せ。複雑だが強力 |
| **Harbor** | 水の壁とスモークでエリアを制圧 |
| **Clove** | 死後もアビリティ使用可能なユニークなコントローラー |

#### Sentinel（センチネル）— 6人
防衛・情報収集・スパイク解除のサポートに特化。

| エージェント | 特徴 |
|---|---|
| **Sage** | ヒール・バリア・蘇生。唯一の全体回復持ち |
| **Cypher** | トラップワイヤー・カメラで情報収集。1人でサイト守備可能 |
| **Killjoy** | タレット・ナノスワームでサイト守備。Ultimate で範囲デテイン |
| **Chamber** | テレポート+スナイパートラップ。守備的デュエリスト |
| **Deadlock** | ナノワイヤーネットで敵を捕縛。サイトロック特化 |
| **Vyse** | メタルワイヤーで武器を封じる。最新センチネル |

---

### ランク一覧（全9ランク）

各ランクは1〜3の段階（Tier）に分かれる（RadiantとUnrankedを除く）。
コーチング動画では「Diamond以上向け」「Iron〜Gold向け入門」などランク別に内容が異なる。

| ランク | 順位 | 概要 |
|---|---|---|
| **Iron** | 1 | 最低ランク。ゲームに慣れている段階 |
| **Bronze** | 2 | 基本的なゲームメカニクスを理解し始める |
| **Silver** | 3 | エイムと基本戦術を学ぶ段階 |
| **Gold** | 4 | アビリティ使用・ポジショニングを意識し始める |
| **Platinum** | 5 | 戦術理解が深まる中級帯 |
| **Diamond** | 6 | 上位10%程度。エコ管理・チーム連携が重要 |
| **Ascendant** | 7 | 上位数%。細かい判断力と高度な戦術理解 |
| **Immortal** | 8 | トップ1%前後。プロ水準に近い実力 |
| **Radiant** | 9 | 最高ランク。各地域上位500名のみ |

> **Ordinal値**: Drizzle スキーマでは `ordinal: 1〜9` として定義（将来の範囲クエリ用）

---

### コーチング動画の判定ロジック

`isValorantCoachingVideo()` 関数で以下の**2条件AND**でコーチング動画を判定:

1. **ゲーム名**: タイトルに `valorant` / `valo` / `ヴァロラント` 等を含む
2. **コーチング系ワード**: タイトルに `coach` / `coaching` / `guide` / `tips` / `tutorial` / `how to` / `improvement` / `rank up` / `vod review` 等を含む

どちらか一方だけではコーチング動画として判定しない（誤検知防止）。
