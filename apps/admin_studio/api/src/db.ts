import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function findWorkspaceRoot(from: string): string {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('pnpm-workspace.yaml が見つかりません');
    dir = parent;
  }
}

function findLocalD1Path(): string {
  // wrangler d1 --local のデフォルトパスを検索
  const workspaceRoot = findWorkspaceRoot(__dirname);
  const stateDir = join(workspaceRoot, 'apps/public/api/.wrangler/state/v3/d1');
  if (!existsSync(stateDir)) {
    throw new Error(
      `ローカルD1が見つかりません。\n` +
      `以下のいずれかを実行してください:\n` +
      `  1. pnpm --filter valocoach-archive-api dev （wrangler dev で初期化）\n` +
      `  2. pnpm --filter valocoach-archive-api bulk-collect （動画収集）\n` +
      `または LOCAL_DB_PATH 環境変数でSQLiteファイルパスを指定してください。`
    );
  }

  // miniflare-D1DatabaseObject 配下の .sqlite ファイルを再帰的に検索
  const entries = readdirSync(stateDir, { recursive: true }) as string[];
  const found = entries.find(e => String(e).endsWith('.sqlite'));
  if (!found) {
    throw new Error(
      `D1 SQLiteファイルが見つかりません (${stateDir})。\n` +
      `wrangler dev を一度起動してDBを初期化してください。`
    );
  }
  return join(stateDir, String(found));
}

const sqlite = new Database(findLocalD1Path());
// WALモード有効化（読み取りパフォーマンス向上）
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite);
