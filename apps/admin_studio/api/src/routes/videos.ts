import { Hono } from 'hono';
import { eq, and, desc, sql, inArray, like } from 'drizzle-orm';
import { db } from '../db.js';
import { videos } from '@public-api/db/schema.js';

export const videosRoute = new Hono();

/** GET /api/videos — フィルタ付き一覧 */
videosRoute.get('/', async (c) => {
  const q = c.req.query();
  const page = Math.max(parseInt(q['page'] ?? '1', 10), 1);
  const limit = Math.min(parseInt(q['limit'] ?? '50', 10), 200);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (q['map']) conditions.push(eq(videos.map, q['map']));
  if (q['agent']) conditions.push(eq(videos.agent, q['agent']));
  if (q['rank']) conditions.push(eq(videos.rank, q['rank']));
  if (q['coach']) conditions.push(eq(videos.channelTitle, q['coach']));
  if (q['status']) conditions.push(eq(videos.aiTaggingStatus, q['status']));
  if (q['review']) conditions.push(eq(videos.reviewNeeded, parseInt(q['review'], 10)));
  if (q['coaching'] !== undefined) {
    conditions.push(eq(videos.isValorantCoaching, parseInt(q['coaching'], 10)));
  }
  if (q['q']) {
    conditions.push(like(videos.title, `%${q['q']}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db.select({
      id: videos.id,
      title: videos.title,
      channelTitle: videos.channelTitle,
      publishedAt: videos.publishedAt,
      thumbnailUrl: videos.thumbnailUrl,
      duration: videos.duration,
      viewCount: videos.viewCount,
      map: videos.map,
      agent: videos.agent,
      rank: videos.rank,
      mapConfidence: videos.mapConfidence,
      agentConfidence: videos.agentConfidence,
      rankConfidence: videos.rankConfidence,
      mapSource: videos.mapSource,
      agentSource: videos.agentSource,
      rankSource: videos.rankSource,
      aiTaggingStatus: videos.aiTaggingStatus,
      reviewNeeded: videos.reviewNeeded,
      isValorantCoaching: videos.isValorantCoaching,
      aiTaggedAt: videos.aiTaggedAt,
    })
      .from(videos)
      .where(where)
      .orderBy(desc(videos.publishedAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(videos).where(where),
  ]);

  return c.json({ total: countResult[0]?.count ?? 0, page, limit, videos: rows });
});

/** GET /api/videos/stats — DB統計 */
videosRoute.get('/stats', async (c) => {
  const rows = await db
    .select({
      status: videos.aiTaggingStatus,
      count: sql<number>`count(*)`,
    })
    .from(videos)
    .groupBy(videos.aiTaggingStatus);

  const stats: Record<string, number> = {};
  for (const r of rows) stats[r.status] = r.count;

  const [total, coaching, reviewNeeded] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(videos),
    db.select({ count: sql<number>`count(*)` }).from(videos).where(eq(videos.isValorantCoaching, 0)),
    db.select({ count: sql<number>`count(*)` }).from(videos).where(eq(videos.reviewNeeded, 1)),
  ]);

  return c.json({
    total: total[0]?.count ?? 0,
    rejected: coaching[0]?.count ?? 0,
    reviewNeeded: reviewNeeded[0]?.count ?? 0,
    byStatus: {
      pending: stats['pending'] ?? 0,
      in_progress: stats['in_progress'] ?? 0,
      complete: stats['complete'] ?? 0,
      skipped: stats['skipped'] ?? 0,
      failed: stats['failed'] ?? 0,
    },
  });
});

/** GET /api/videos/channels — distinct channelTitle 一覧 */
videosRoute.get('/channels', async (c) => {
  const rows = await db
    .selectDistinct({ channelTitle: videos.channelTitle })
    .from(videos)
    .orderBy(videos.channelTitle);
  return c.json(rows.map(r => r.channelTitle).filter(Boolean));
});

/** GET /api/videos/:id — 単体詳細 */
videosRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const rows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  if (rows.length === 0) return c.json({ error: 'not found' }, 404);
  return c.json(rows[0]);
});
