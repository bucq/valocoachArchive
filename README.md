# ValoCoach Archive

Valorantのコーチング動画をYouTubeから収集し、map/agent/rank/coach別にフィルタリングして視聴できるWebアプリ。

## 構成

```
valoStudy/
├── apps/
│   ├── public/
│   │   ├── api/   # Cloudflare Workers (Hono) — GET API
│   │   └── web/   # Astro 5 公開サイト (Cloudflare Pages)
│   └── admin_studio/
│       ├── api/   # Hono + Node.js, port 3001 — ローカル専用
│       └── web/   # Vite + React 19, port 5173 — ローカル専用
└── pnpm-workspace.yaml
```

## ローカル開発

### 起動

```bash
# 管理ツール（収集・タグ付け・レビュー・D1同期）
pnpm --filter admin_studio-api dev   # port 3001
pnpm --filter admin_studio-web dev   # port 5173

# 公開サービス（動作確認用）
pnpm --filter valocoach-archive-api dev   # wrangler dev
pnpm --filter valocoach-archive-web dev   # astro dev (port 4321)
```

### ローカルDBの場所

wrangler が自動生成するローカル D1 SQLite:

```
apps/public/api/.wrangler/state/v3/d1/*.sqlite
```

admin_studio はこのファイルを `better-sqlite3` で直接読み書きします。

---

## Cloudflare デプロイ手順

### 前提

```bash
pnpm wrangler login   # Cloudflareアカウントにログイン
```

---

### 1. D1 データベースの作成（初回のみ）

```bash
cd apps/public/api
pnpm wrangler d1 create valocoach-archive
```

出力された `database_id` を `wrangler.toml` の `database_id` に設定:

```toml
[[d1_databases]]
binding = "DB"
database_name = "valocoach-archive"
database_id = "<ここに貼り付け>"
```

---

### 2. リモートD1にマイグレーションを適用（初回 / スキーマ変更時）

```bash
cd apps/public/api
pnpm wrangler d1 migrations apply valocoach-archive --remote
```

---

### 3. Workers (API) のデプロイ

```bash
cd apps/public/api
pnpm wrangler deploy
```

デプロイ後、WorkersのURLが発行される:

```
https://valocoach-archive-api.<subdomain>.workers.dev
```

`apps/public/web/wrangler.toml` の `API_BASE_URL` をこのURLに更新:

```toml
[vars]
API_BASE_URL = "https://valocoach-archive-api.<subdomain>.workers.dev"
```

---

### 4. Pages (Web) のデプロイ

初回のみ Pages プロジェクトを作成:

```bash
cd apps/public/web
pnpm wrangler pages project create valocoach-archive-web
```

ビルド＆デプロイ（本番）:

```bash
cd apps/public/web
pnpm build
pnpm wrangler pages deploy dist --branch main
```

> `--branch main` を付けることで本番URL（`https://valocoach-archive-web.pages.dev`）に固定される。
> 省略するとプレビューURL（`https://<hash>.valocoach-archive-web.pages.dev`）になる。
> git管理不要。

---

## ローカル D1 → リモート D1 へのデータ反映

ローカルで収集・タグ付けしたデータをリモートCloudflare D1に反映する方法は2つあります。

### 方法A: Admin Studio UI から実行（推奨）

1. admin_studio を起動
2. サイドバーの **Sync** ページを開く
3. 「リモートD1に同期」ボタンをクリック

内部では以下の2ステップが実行されます:

```
ローカルD1 → SQLエクスポート(.sql) → リモートD1にインポート
```

SSEでログがリアルタイム表示されます。完了まで数分かかる場合があります。

---

### 方法B: CLI から手動実行

```bash
cd apps/public/api

# ① ローカルD1をSQLファイルにエクスポート
pnpm wrangler d1 export valocoach-archive --local --output=./export.sql

# ② リモートD1にインポート
pnpm wrangler d1 execute valocoach-archive --remote --file=./export.sql

# ③ 一時ファイルを削除
rm ./export.sql
```

> **注意**: `--remote` のインポートはデータ量によって数分かかります。
> 既存データとの重複は INSERT OR REPLACE / IGNORE で処理されます（スキーマ依存）。

---

### 方法C: 差分のみ反映したい場合

全データではなく特定テーブルだけ同期したい場合:

```bash
cd apps/public/api

# videosテーブルのみエクスポート
pnpm wrangler d1 export valocoach-archive --local --table=videos --output=./videos.sql

# リモートに適用
pnpm wrangler d1 execute valocoach-archive --remote --file=./videos.sql

rm ./videos.sql
```

---

## 環境変数・シークレット

| 変数 | 設定方法 | 用途 |
|---|---|---|
| `YOUTUBE_API_KEY` | `wrangler secret put YOUTUBE_API_KEY` (Workers) / `.env` (admin) | YouTube Data API v3 |
| `GEMINI_API_KEY` | admin_studio の `.env` | Gemini Flash (AIタグ付け) |
| `ADMIN_TOKEN` | `wrangler secret put ADMIN_TOKEN` | Workers管理API認証 |

ローカル開発時は `apps/admin_studio/api/.env` に設定:

```env
YOUTUBE_API_KEY=...
GEMINI_API_KEY=...
```
