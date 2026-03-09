import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { videos } from '@public-api/db/schema.js';

export const reviewRoute = new Hono();

/** GET /api/review — reviewNeeded=1 の動画一覧 */
reviewRoute.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const page = Math.max(parseInt(c.req.query('page') ?? '1', 10), 1);
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      channelTitle: videos.channelTitle,
      publishedAt: videos.publishedAt,
      thumbnailUrl: videos.thumbnailUrl,
      map: videos.map,
      agent: videos.agent,
      rank: videos.rank,
      mapConfidence: videos.mapConfidence,
      agentConfidence: videos.agentConfidence,
      rankConfidence: videos.rankConfidence,
      mapSource: videos.mapSource,
      agentSource: videos.agentSource,
      rankSource: videos.rankSource,
      llmReasoning: videos.llmReasoning,
      isValorantCoaching: videos.isValorantCoaching,
    })
    .from(videos)
    .where(eq(videos.reviewNeeded, 1))
    .orderBy(desc(videos.aiTaggedAt))
    .limit(limit)
    .offset(offset);

  return c.json({ count: rows.length, page, limit, videos: rows });
});

/**
 * PATCH /api/review/:id/correct — 手動タグ修正
 * Body: { map?: string|null, agent?: string|null, rank?: string|null }
 * 指定フィールドを source=manual, confidence=1.0 でセット。reviewNeeded=0 にリセット。
 */
reviewRoute.patch('/:id/correct', async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();

  let body: { map?: string | null; agent?: string | null; rank?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const update: Record<string, unknown> = { reviewNeeded: 0, updatedAt: now };

  if ('map' in body) {
    update['map'] = body.map ?? null;
    update['mapSource'] = body.map != null ? 'manual' : null;
    update['mapConfidence'] = body.map != null ? 1.0 : 0;
  }
  if ('agent' in body) {
    update['agent'] = body.agent ?? null;
    update['agentSource'] = body.agent != null ? 'manual' : null;
    update['agentConfidence'] = body.agent != null ? 1.0 : 0;
  }
  if ('rank' in body) {
    update['rank'] = body.rank ?? null;
    update['rankSource'] = body.rank != null ? 'manual' : null;
    update['rankConfidence'] = body.rank != null ? 1.0 : 0;
  }

  await db.update(videos).set(update).where(eq(videos.id, id));
  return c.json({ status: 'corrected', id, applied: Object.keys(body) });
});

/** POST /api/review/:id/reject — 偽陽性として非表示 */
reviewRoute.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  await db.update(videos).set({ isValorantCoaching: 0, reviewNeeded: 0, updatedAt: new Date().toISOString() }).where(eq(videos.id, id));
  return c.json({ status: 'rejected', id });
});

/** POST /api/review/:id/restore — 非表示を復元 */
reviewRoute.post('/:id/restore', async (c) => {
  const id = c.req.param('id');
  await db.update(videos).set({ isValorantCoaching: 1, updatedAt: new Date().toISOString() }).where(eq(videos.id, id));
  return c.json({ status: 'restored', id });
});

/** POST /api/review/:id/approve — reviewNeeded=0 にするだけ（値変更なし） */
reviewRoute.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  await db.update(videos).set({ reviewNeeded: 0, updatedAt: new Date().toISOString() }).where(eq(videos.id, id));
  return c.json({ status: 'approved', id });
});
