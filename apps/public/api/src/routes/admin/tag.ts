/**
 * tag.ts — LLMタグ付けルート（per-video設計）
 *
 * Workers の 30s 制限を考慮し、1動画ずつ処理する。
 * バッチループはクライアント（admin UI）側が担当する。
 */
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import type { Env } from '../../index';
import { getPendingVideos, resetTaggingStatus, tagSingleVideo } from '../../services/admin/tagger';

export const adminTagRoute = new Hono<{ Bindings: Env }>();

/** GET /api/admin/tag/pending — pending/failed 動画一覧 */
adminTagRoute.get('/pending', async (c) => {
  const maxCount = Math.min(parseInt(c.req.query('maxCount') ?? '500', 10), 500);
  const db = drizzle(c.env.DB);
  const pendingVideos = await getPendingVideos(db, maxCount);
  return c.json({ count: pendingVideos.length, videos: pendingVideos });
});

/**
 * POST /api/admin/tag/video/:id — 1動画をタグ付け
 *
 * クライアントがループして1件ずつ呼び出す。
 * 429 (rate_limited) が返った場合はクライアント側で待機してリトライ。
 */
adminTagRoute.post('/video/:id', async (c) => {
  const videoId = c.req.param('id');
  const body: { provider?: 'gemini' | 'gemma' | 'anthropic'; dryRun?: boolean } = await c.req
    .json()
    .catch(() => ({}));

  const apiKey = c.env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: 'GEMINI_API_KEY not set' }, 500);

  const db = drizzle(c.env.DB);

  // 対象動画を取得
  const [video] = await getPendingVideos(db, 1).then((rows) =>
    rows.filter((r) => r.id === videoId),
  );
  if (!video) {
    return c.json({ error: 'video not found or not pending' }, 404);
  }

  try {
    const result = await tagSingleVideo(db, video, {
      geminiApiKey: apiKey,
      provider: body.provider ?? 'gemma',
      dryRun: body.dryRun ?? false,
    });
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      return c.json({ error: 'rate_limited', message: msg.slice(0, 120) }, 429);
    }
    return c.json({ error: 'internal_error', message: msg.slice(0, 120) }, 500);
  }
});

/** POST /api/admin/tag/reset — タグ付けステータスをリセット */
adminTagRoute.post('/reset', async (c) => {
  const body: { statuses?: string[] } = await c.req.json().catch(() => ({}));
  const statuses = body.statuses ?? ['pending', 'in_progress', 'complete', 'skipped', 'failed'];
  const db = drizzle(c.env.DB);
  const count = await resetTaggingStatus(db, statuses);
  return c.json({ status: 'reset', statuses, count });
});
