# ValoCoach Archive — ユースケース図

## アクター

| アクター | 説明 |
|---|---|
| 視聴者 | コーチング動画を検索・視聴する一般ユーザー |
| 管理者 | YouTube同期・AIタグ付けを操作する運用者 |
| Cron (自動) | 毎日深夜0時に自動実行される同期ジョブ |

## ユースケース図

```mermaid
graph LR
  U((視聴者))
  A((管理者))
  C((Cron自動))

  subgraph ValoCoach Archive システム
    subgraph 動画閲覧
      UC1[動画一覧を表示]
      UC2[map でフィルタリング]
      UC3[agent でフィルタリング]
      UC4[rank でフィルタリング]
      UC5[coach でフィルタリング]
      UC6[動画を視聴]
      UC7[フィルター付き URL をシェア]
    end

    subgraph 管理・同期
      UC8[YouTube 動画を手動同期]
      UC9[動画を個別に再タグ付け]
      UC10[未タグ動画をバッチ再タグ付け]
      UC11[クエリ検索で動画収集]
      UC12[偽陽性動画を非表示]
      UC13[非表示動画を復元]
    end

    subgraph 自動処理
      UC14[YouTube 動画を定期取得]
      UC15[Regex でメタデータ抽出]
      UC16[サムネイル Vision でメタデータ補完]
    end
  end

  U --> UC1
  U --> UC2
  U --> UC3
  U --> UC4
  U --> UC5
  UC2 & UC3 & UC4 & UC5 --> UC1
  UC1 --> UC6
  UC1 --> UC7

  A --> UC8
  A --> UC9
  A --> UC10
  A --> UC11
  A --> UC12
  A --> UC13

  C --> UC14
  UC14 --> UC15
  UC15 --> UC16
```

## ユースケース詳細

### UC1: 動画一覧を表示
- **主アクター**: 視聴者
- **事前条件**: YouTube同期が少なくとも1回実行済み
- **基本フロー**:
  1. ユーザーがトップページにアクセス
  2. システムがフィルター選択肢（map/agent/rank/coach）を取得
  3. システムが最新動画一覧を表示（デフォルト: 投稿日降順、`is_valorant_coaching = 1` のみ）
- **代替フロー**: URLにフィルターパラメータがある場合はフィルタリング済み結果を表示

### UC2–UC5: フィルタリング
- **主アクター**: 視聴者
- **基本フロー**:
  1. ユーザーがフィルターパネルで値を選択
  2. URLのsearch paramsが更新される（シェア可能なURL）
  3. 動画グリッドがフィルター結果で更新される

### UC6: 動画を視聴
- **主アクター**: 視聴者
- **基本フロー**:
  1. ユーザーが動画カードをクリック
  2. YouTube iframe プレイヤーがページ内に表示される
  3. 動画が自動再生開始

### UC8: YouTube 動画を手動同期
- **エンドポイント**: `POST /api/admin/sync`
- **主アクター**: 管理者
- **基本フロー**:
  1. 管理者がBearerトークン付きでリクエスト送信
  2. `ctx.waitUntil(runSync)` でバックグラウンド実行開始
  3. 即時レスポンス `{ status: 'sync started' }` を返す

### UC9: 動画を個別に再タグ付け
- **エンドポイント**: `POST /api/admin/retag/:videoId`
- **主アクター**: 管理者
- **基本フロー**:
  1. 対象VideoIDを指定してリクエスト
  2. `ctx.waitUntil(tagVideo)` でGemini Flash Vision解析を実行
  3. D1のmap/agent/rank/confidence/sourceを更新

### UC10: 未タグ動画をバッチ再タグ付け
- **エンドポイント**: `POST /api/admin/retag-batch`
- **主アクター**: 管理者
- **基本フロー**:
  1. `ctx.waitUntil(tagPendingVideos)` でバックグラウンド実行
  2. `ai_tagging_status = 'pending' or 'failed'` の動画を最大500件処理

### UC11: クエリ検索で動画収集
- **エンドポイント**: `POST /api/admin/search-collect`
- **Body**: `{ "query": "valorant coaching woohoojin", "maxResults": 20 }`
- **主アクター**: 管理者
- **用途**: チャンネルID不明のコーチ発掘や深堀り探索

### UC12–UC13: 偽陽性動画の管理
- **エンドポイント**: `POST /api/admin/videos/:videoId/reject` / `/restore`
- **主アクター**: 管理者
- **基本フロー**:
  - reject: `is_valorant_coaching = 0` に設定→一覧から非表示
  - restore: `is_valorant_coaching = 1` に戻す→一覧に再表示

### UC14–UC16: 自動メタデータ抽出パイプライン
- **主アクター**: Cron（自動・毎日深夜0時）
- **基本フロー**:
  1. Cronが毎日深夜0時にトリガー
  2. YouTube Data API v3 でコーチングチャンネルの新着動画を取得
  3. 全動画に対しRegex抽出（タイトル/タグ/説明）を実行
  4. `ctx.waitUntil(tagPendingVideos)` でGemini Flash Vision解析をバックグラウンド実行
  5. D1データベースを更新
- **補足**: 字幕LLM (caption_llm) は YouTube字幕取得不可のためデフォルトスキップ

## API エンドポイント一覧

### 公開エンドポイント（認証不要）

| エンドポイント | メソッド | 用途 |
|---|---|---|
| `/api/videos` | GET | 動画一覧取得（フィルター・ページング対応） |
| `/api/videos/filters` | GET | フィルター選択肢一覧取得 |
| `/api/health` | GET | ヘルスチェック |

**クエリパラメータ** (`/api/videos`):
- `map` — マップ名でフィルター (例: `Ascent`)
- `agent` — エージェント名でフィルター (例: `Jett`)
- `rank` — ランクでフィルター (例: `Diamond`)
- `coach` — チャンネル名でフィルター
- `page` — ページ番号 (デフォルト: 1)
- `limit` — 1ページあたりの件数 (デフォルト: 24, 最大: 50)

### 管理エンドポイント（Bearer 認証必須）

| エンドポイント | メソッド | 用途 |
|---|---|---|
| `/api/admin/sync` | POST | 手動Cronトリガー |
| `/api/admin/test-collect` | POST | 検証用: 収集+LLM即時実行 |
| `/api/admin/search-collect` | POST | クエリ検索で収集+DB保存 |
| `/api/admin/retag/:videoId` | POST | 単体再タグ付け |
| `/api/admin/retag-batch` | POST | pending/failed一括タグ付け |
| `/api/admin/videos/:videoId/reject` | POST | 偽陽性として非表示 |
| `/api/admin/videos/:videoId/restore` | POST | 非表示を復元 |
