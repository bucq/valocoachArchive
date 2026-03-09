# ValoCoach Archive — ER図

## ER図

```mermaid
erDiagram
  videos {
    text     id                PK  "YouTube動画ID"
    text     title             "動画タイトル"
    text     description       "動画説明文"
    text     channel_id        "YouTubeチャンネルID"
    text     channel_title     "チャンネル名（コーチ名）"
    text     published_at      "投稿日時 (ISO 8601)"
    text     thumbnail_url     "サムネイルURL"
    text     duration          "動画長(ISO8601: PT12M30S)"
    integer  view_count        "視聴回数"
    text     map               "マップ名 e.g. Ascent"
    text     agent             "エージェント名 e.g. Jett"
    text     rank              "ランク e.g. Diamond"
    real     map_confidence    "map抽出信頼度 0.0-1.0"
    real     agent_confidence  "agent抽出信頼度 0.0-1.0"
    real     rank_confidence   "rank抽出信頼度 0.0-1.0"
    text     map_source        "regex|caption_llm|thumbnail_llm|manual"
    text     agent_source      "抽出ソース"
    text     rank_source       "抽出ソース"
    text     caption_text      "字幕テキストキャッシュ(NULL=未取得)"
    text     caption_fetched_at "字幕取得日時"
    integer  is_valorant_coaching "1=表示対象 / 0=偽陽性(非表示)"
    text     ai_tagging_status "pending|in_progress|complete|skipped|failed"
    text     ai_tagged_at      "AI処理完了日時"
    text     synced_at         "YouTube同期日時"
    text     updated_at        "レコード更新日時"
  }

  ai_tagging_jobs {
    integer  id             PK  "自動採番"
    text     video_id       FK  "videos.id参照"
    text     tier           "thumbnail_llm (caption_llmはデフォルトスキップ)"
    text     status         "queued|running|done|failed"
    integer  input_tokens   "LLM入力トークン数"
    integer  output_tokens  "LLM出力トークン数"
    text     error_message  "エラー内容(失敗時)"
    text     created_at     "ジョブ作成日時"
    text     completed_at   "ジョブ完了日時"
  }

  videos ||--o{ ai_tagging_jobs : "タグ付けジョブ"
```

## テーブル説明

### `videos`
YouTube動画のメタデータとAI抽出結果を保持するメインテーブル。

**主キー**: `id` — YouTube動画ID（例: `dQw4w9WgXcQ`）

**抽出メタデータ（map/agent/rank）**
各フィールドは2段階パイプラインで抽出される:
1. Regex（タイトル/タグ/説明）→ `*_source = 'regex'`, `*_confidence = 0.8`
2. Gemini Flash Vision サムネイル解析 → `*_source = 'thumbnail_llm'`, `*_confidence = 0.45`
3. Claude Haiku 字幕解析 → `*_source = 'caption_llm'`, `*_confidence = 0.65` (**デフォルトスキップ**)
4. 手動修正 → `*_source = 'manual'`, `*_confidence = 1.0`

**信頼度順位**: `manual(1.0)` > `regex(0.8)` > `caption_llm(0.65)` > `thumbnail_llm(0.45)`

**`is_valorant_coaching` フラグ**:
- `1` — コーチング動画として表示対象（デフォルト）
- `0` — 偽陽性として非表示（`/api/admin/videos/:id/reject` で設定）

**`ai_tagging_status` 遷移**:
```
pending → in_progress → complete
                      → failed
         skipped  ← (regex で全フィールド完成時)
```

**インデックス**:
- `idx_videos_map` — mapフィルタークエリ最適化
- `idx_videos_agent` — agentフィルタークエリ最適化
- `idx_videos_rank` — rankフィルタークエリ最適化
- `idx_videos_channel` — channel_idインデックス (coachフィルタークエリ最適化)
- `idx_videos_ai_status` — pendingジョブ一覧取得最適化
- `idx_videos_published` — 投稿日降順ソート最適化

### `ai_tagging_jobs`
AIタグ付けの実行ログ・監査テーブル。コスト追跡とリトライ管理に使用。

**`tier`**:
- `thumbnail_llm` — YouTubeサムネイルをGemini Flash Visionで解析（デフォルト実行）
- `caption_llm` — YouTube字幕テキストをLLMで解析（`skipCaptionLLM === false` の場合のみ）

**コスト試算クエリ例**:
```sql
SELECT
  tier,
  count(*) as jobs,
  sum(input_tokens) as total_input,
  sum(output_tokens) as total_output,
  round(sum(input_tokens) * 0.00025 / 1000 + sum(output_tokens) * 0.00125 / 1000, 4) as cost_usd
FROM ai_tagging_jobs
WHERE status = 'done'
GROUP BY tier;
```

## フィールド値定義

### map（全12マップ）
`Ascent` | `Bind` | `Breeze` | `Fracture` | `Haven` | `Icebox` | `Lotus` | `Pearl` | `Split` | `Sunset` | `Abyss` | `Corrode`

### agent（全27エージェント）
**Duelist**: `Jett` | `Reyna` | `Raze` | `Phoenix` | `Neon` | `Iso` | `Waylay`
**Initiator**: `Sova` | `Breach` | `Skye` | `KAY/O` | `Fade` | `Gekko` | `Tejo`
**Controller**: `Brimstone` | `Viper` | `Omen` | `Astra` | `Harbor` | `Clove`
**Sentinel**: `Sage` | `Cypher` | `Killjoy` | `Chamber` | `Deadlock` | `Vyse`

### rank（全9ランク）
`Iron` | `Bronze` | `Silver` | `Gold` | `Platinum` | `Diamond` | `Ascendant` | `Immortal` | `Radiant`
