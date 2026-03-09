import { Hono } from 'hono';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_DIR        = resolve(__dirname, '../../../../public/api');
const TMP_FILE       = resolve(API_DIR, '.tmp-sync-export.sql');
const TMP_PULL_FILE  = resolve(API_DIR, '.tmp-pull-export.sql');

export const syncRoute = new Hono();

type SyncEvent = { type: 'step' | 'done' | 'error'; message: string };

/** POST /api/sync/push — ローカルD1 → リモートCloudflare D1（SSE） */
syncRoute.post('/push', async (c) => {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: SyncEvent) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  (async () => {
    try {
      send({ type: 'step', message: 'リモートD1にマイグレーションを適用中...' });
      execSync(
        `pnpm wrangler d1 migrations apply valocoach-archive --remote`,
        { cwd: API_DIR, stdio: 'pipe' },
      );

      send({ type: 'step', message: 'ローカルD1をSQLエクスポート中（データのみ）...' });
      execSync(
        `pnpm wrangler d1 export valocoach-archive --local --no-schema --output=${TMP_FILE}`,
        { cwd: API_DIR, stdio: 'pipe' },
      );

      // リモートの既存データを削除してから INSERT するSQL文をプリペンド
      // FK制約順: tag_correction_requests → ai_tagging_jobs → videos
      const exported = readFileSync(TMP_FILE, 'utf8');
      const withDeletes = [
        'DELETE FROM tag_correction_requests;',
        'DELETE FROM ai_tagging_jobs;',
        'DELETE FROM videos;',
        'DELETE FROM d1_migrations;',
        '',
        exported,
      ].join('\n');
      writeFileSync(TMP_FILE, withDeletes, 'utf8');

      send({ type: 'step', message: 'リモートCloudflare D1にインポート中（数分かかる場合があります）...' });
      execSync(
        `pnpm wrangler d1 execute valocoach-archive --remote --file=${TMP_FILE}`,
        { cwd: API_DIR, stdio: 'pipe' },
      );

      if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
      send({ type: 'done', message: '同期が完了しました。' });
    } catch (err) {
      if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
      send({ type: 'error', message: String(err).slice(0, 500) });
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
});

/** POST /api/sync/pull — リモートCloudflare D1 → ローカルD1（SSE） */
syncRoute.post('/pull', async (c) => {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: SyncEvent) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  (async () => {
    try {
      send({ type: 'step', message: 'リモートD1をSQLエクスポート中（データのみ）...' });
      execSync(
        `pnpm wrangler d1 export valocoach-archive --remote --no-schema --output=${TMP_PULL_FILE}`,
        { cwd: API_DIR, stdio: 'pipe' },
      );

      const exported = readFileSync(TMP_PULL_FILE, 'utf8');
      const withDeletes = [
        'DELETE FROM tag_correction_requests;',
        'DELETE FROM ai_tagging_jobs;',
        'DELETE FROM videos;',
        'DELETE FROM d1_migrations;',
        '',
        exported,
      ].join('\n');
      writeFileSync(TMP_PULL_FILE, withDeletes, 'utf8');

      send({ type: 'step', message: 'ローカルD1にインポート中...' });
      execSync(
        `pnpm wrangler d1 execute valocoach-archive --local --file=${TMP_PULL_FILE}`,
        { cwd: API_DIR, stdio: 'pipe' },
      );

      if (existsSync(TMP_PULL_FILE)) unlinkSync(TMP_PULL_FILE);
      send({ type: 'done', message: 'プルが完了しました。' });
    } catch (err) {
      if (existsSync(TMP_PULL_FILE)) unlinkSync(TMP_PULL_FILE);
      send({ type: 'error', message: String(err).slice(0, 500) });
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
});
