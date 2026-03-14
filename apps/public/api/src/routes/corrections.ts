import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { tagCorrectionRequests } from '../db/schema';
import type { Env } from '../index';

export const correctionsRoute = new Hono<{ Bindings: Env }>();

/** X-Admin-Token 認証ミドルウェア */
correctionsRoute.use('*', async (c, next) => {
  const token = c.req.header('X-Admin-Token');
  if (!token || token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
});

/** GET /api/admin/corrections?videoId=xxx — 指定動画の corrections 取得 */
correctionsRoute.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const videoId = c.req.query('videoId');

  if (!videoId) {
    return c.json({ error: 'videoId is required' }, 400);
  }

  const rows = await db
    .select()
    .from(tagCorrectionRequests)
    .where(
      and(eq(tagCorrectionRequests.videoId, videoId), eq(tagCorrectionRequests.status, 'pending')),
    );

  return c.json({ corrections: rows });
});

/** PATCH /api/admin/corrections/resolve-by-video/:videoId — 一括ステータス更新 */
correctionsRoute.patch('/resolve-by-video/:videoId', async (c) => {
  const db = drizzle(c.env.DB);
  const videoId = c.req.param('videoId');
  const body = await c.req.json<{ status: 'resolved' | 'dismissed' }>().catch(() => ({}));
  const newStatus = 'status' in body && body.status === 'dismissed' ? 'dismissed' : 'resolved';

  await db
    .update(tagCorrectionRequests)
    .set({ status: newStatus })
    .where(
      and(eq(tagCorrectionRequests.videoId, videoId), eq(tagCorrectionRequests.status, 'pending')),
    );

  return c.json({ ok: true, videoId, status: newStatus });
});
