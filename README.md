# ValoCoach Archive

Valorant のコーチング動画を YouTube から収集し、map/agent/rank/coach 別にフィルタリングして視聴できる Web アプリ。

## 構成

```
valocoachArchive/
├── apps/
│   ├── public/
│   │   ├── api/   # Cloudflare Workers (Hono + D1) — 公開 API + 管理 API
│   │   └── web/   # Astro 5 公開サイト (Cloudflare Pages)
│   └── admin_studio/
│       └── web/   # Vite + React 19 管理 UI (Cloudflare Pages)
└── pnpm-workspace.yaml
```

> `admin_studio/web` は `public/api` に直接接続します。ローカル専用の `admin_studio/api` は廃止済みです。

---

## ローカル開発

```sh
pnpm install

# Workers API (localhost:8787)
pnpm dev:api

# 公開サイト (localhost:4321)
pnpm dev:web

# 管理 UI (localhost:5173)
pnpm dev:admin-web
```

管理 UI はデフォルトで `http://localhost:8787` に接続し、トークン `dev-admin-token` を使います  
（`apps/public/api/wrangler.toml` の `[vars]` に定義済み）。

変更する場合は `apps/admin_studio/web/.env.local` を作成:

```sh
cp apps/admin_studio/web/.env.example apps/admin_studio/web/.env.local
# .env.local を編集
```

---

## Cloudflare デプロイ手順

### 前提

```sh
npx wrangler login   # Cloudflare アカウントにログイン
```

---

### 1. D1 データベース作成（初回のみ）

```sh
cd apps/public/api
npx wrangler d1 create valocoach-archive
```

出力された `database_id` を `wrangler.toml` に設定:

```toml
[[d1_databases]]
binding = "DB"
database_name = "valocoach-archive"
database_id = "<ここに貼り付け>"
```

---

### 2. マイグレーション適用（初回 / スキーマ変更時）

```sh
cd apps/public/api
npx wrangler d1 migrations apply valocoach-archive --remote
```

---

### 3. Workers API のシークレット設定

`ADMIN_TOKEN` には推測困難なランダム文字列を使用してください:

```sh
# 生成方法（どちらでも可）
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

生成した値を使ってシークレットを設定:

```sh
cd apps/public/api

npx wrangler secret put ADMIN_TOKEN       # 上記で生成した値を入力
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY  # 任意
```

---

### 4. Workers API のデプロイ

```sh
pnpm deploy:api
# または
cd apps/public/api && npx wrangler deploy
```

デプロイ後に Workers URL が発行される:

```
https://valocoach-archive-api.<subdomain>.workers.dev
```

---

### 5. 公開サイトのデプロイ (`apps/public/web`)

初回のみ Pages プロジェクトを作成:

```sh
cd apps/public/web
npx wrangler pages project create valocoach-archive-web
```

ビルド＆デプロイ:

```sh
pnpm deploy:web
# または
cd apps/public/web && pnpm build && npx wrangler pages deploy dist --branch main
```

> `apps/public/web/wrangler.toml` の `API_BASE_URL` を Workers URL に更新すること。

---

### 6. 管理 UI のデプロイ (`apps/admin_studio/web`)

#### 初回: Pages プロジェクト作成

```sh
cd apps/admin_studio/web
npx wrangler pages project create valocoach-admin
```

#### 環境変数設定

Cloudflare Pages ダッシュボード → プロジェクト → Settings → Environment variables:

| 変数名 | 値 |
|---|---|
| `VITE_API_URL` | Workers の URL（例: `https://valocoach-archive-api.xxx.workers.dev`） |
| `VITE_ADMIN_TOKEN` | `ADMIN_TOKEN` に設定したのと同じ値 |

#### ビルド＆デプロイ

```sh
cd apps/admin_studio/web
pnpm build
npx wrangler pages deploy dist --project-name valocoach-admin --branch main
```

> **SPA ルーティング**: `public/_redirects` に `/* /index.html 200` が含まれているため、Cloudflare Pages でのクライアントサイドルーティングは自動的に機能します。

---

## 環境変数まとめ

### Workers (`apps/public/api`)

| 変数 | 設定方法 | 用途 |
|---|---|---|
| `ADMIN_TOKEN` | `wrangler secret put` | 管理 API 認証 |
| `GEMINI_API_KEY` | `wrangler secret put` | Gemini Flash (AI タグ付け) |
| `YOUTUBE_API_KEY` | `wrangler secret put` | YouTube Data API v3 |
| `ANTHROPIC_API_KEY` | `wrangler secret put` (任意) | Claude (AI タグ付け) |

### 管理 UI (`apps/admin_studio/web`)

| 変数 | ローカル | Pages 本番 |
|---|---|---|
| `VITE_API_URL` | `.env.local`（省略時 `http://localhost:8787`） | Pages 環境変数 |
| `VITE_ADMIN_TOKEN` | `.env.local`（省略時 空文字） | Pages 環境変数 |

---

## マイグレーション管理

```sh
cd apps/public/api

# ローカル D1 に適用
npx wrangler d1 migrations apply valocoach-archive --local

# 本番 D1 に適用
npx wrangler d1 migrations apply valocoach-archive --remote
```

---

## その他のコマンド

```sh
pnpm lint          # Biome でリント
pnpm lint:fix      # 自動修正
pnpm test          # @valocoach/valorant パッケージのテスト
pnpm typecheck     # 全パッケージの型チェック
```
