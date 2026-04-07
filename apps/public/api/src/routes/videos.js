import { zValidator } from '@hono/zod-validator';
import { AGENT_LABELS, MAP_LABELS, RANK_LABELS } from '@valocoach/valorant';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { z } from 'zod';
import { tagCorrectionRequests, videos } from '../db/schema';
export const videosRoute = new Hono();
const filterSchema = z.object({
    map: z.string().optional(),
    agent: z.string().optional(),
    rank: z.string().optional(),
    coach: z.string().optional(),
    coachingType: z.enum(['individual', 'team']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(24),
});
/** GET /api/videos — フィルタリング・ページング */
videosRoute.get('/', zValidator('query', filterSchema), async (c) => {
    const db = drizzle(c.env.DB);
    const { map, agent, rank, coach, coachingType, page, limit } = c.req.valid('query');
    const conditions = [eq(videos.isValorantCoaching, 1)];
    if (map)
        conditions.push(eq(videos.map, map));
    if (agent)
        conditions.push(eq(videos.agent, agent));
    if (rank)
        conditions.push(eq(videos.rank, rank));
    if (coach)
        conditions.push(eq(videos.channelTitle, coach));
    if (coachingType)
        conditions.push(eq(videos.coachingType, coachingType));
    const where = and(...conditions);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
        db
            .select({
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
            coachingType: videos.coachingType,
            mapConfidence: videos.mapConfidence,
            agentConfidence: videos.agentConfidence,
            rankConfidence: videos.rankConfidence,
        })
            .from(videos)
            .where(where)
            .orderBy(desc(videos.publishedAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: sql `count(*)` }).from(videos).where(where),
    ]);
    return c.json({
        videos: rows,
        total: countResult[0]?.count ?? 0,
        page,
        limit,
    });
});
/** GET /api/videos/filters — フィルター選択肢一覧 */
videosRoute.get('/filters', async (c) => {
    const db = drizzle(c.env.DB);
    const isCoaching = eq(videos.isValorantCoaching, 1);
    const [maps, agents, ranks, coaches] = await Promise.all([
        db
            .selectDistinct({ value: videos.map })
            .from(videos)
            .where(and(isCoaching, isNotNull(videos.map)))
            .orderBy(videos.map),
        db
            .selectDistinct({ value: videos.agent })
            .from(videos)
            .where(and(isCoaching, isNotNull(videos.agent)))
            .orderBy(videos.agent),
        db
            .selectDistinct({ value: videos.rank })
            .from(videos)
            .where(and(isCoaching, isNotNull(videos.rank)))
            .orderBy(videos.rank),
        db
            .selectDistinct({ value: videos.channelTitle })
            .from(videos)
            .where(isCoaching)
            .orderBy(videos.channelTitle),
    ]);
    return c.json({
        maps: maps.map((r) => r.value).filter(Boolean),
        agents: agents.map((r) => r.value).filter(Boolean),
        ranks: ranks
            .map((r) => r.value)
            .filter(Boolean)
            .sort((a, b) => RANK_LABELS.indexOf(a) - RANK_LABELS.indexOf(b)),
        coaches: coaches.map((r) => r.value).filter(Boolean),
    });
});
const correctionBodySchema = z
    .object({
    suggestedMap: z.enum(MAP_LABELS).optional(),
    suggestedAgent: z.enum(AGENT_LABELS).optional(),
    suggestedRank: z.enum(RANK_LABELS).optional(),
    note: z.string().max(200).optional(),
})
    .refine((data) => data.suggestedMap !== undefined ||
    data.suggestedAgent !== undefined ||
    data.suggestedRank !== undefined, { message: '少なくとも1つのフィールドを指定してください' });
/** POST /api/videos/:id/correction — タグ修正リクエスト送信 */
videosRoute.post('/:id/correction', zValidator('json', correctionBodySchema), async (c) => {
    const db = drizzle(c.env.DB);
    const videoId = c.req.param('id');
    const body = c.req.valid('json');
    // 動画が存在するか確認
    const [video] = await db
        .select({ id: videos.id })
        .from(videos)
        .where(and(eq(videos.id, videoId), eq(videos.isValorantCoaching, 1)))
        .limit(1);
    if (!video) {
        return c.json({ error: 'video not found' }, 404);
    }
    // 同一動画で pending が既にある場合はスキップ（スパム防止）
    const [existing] = await db
        .select({ id: tagCorrectionRequests.id })
        .from(tagCorrectionRequests)
        .where(and(eq(tagCorrectionRequests.videoId, videoId), eq(tagCorrectionRequests.status, 'pending')))
        .limit(1);
    if (existing) {
        return c.json({
            ok: false,
            alreadyPending: true,
            message: '他のユーザーからすでにリクエストが届いています',
        });
    }
    const now = new Date().toISOString();
    await db.batch([
        db.insert(tagCorrectionRequests).values({
            videoId,
            suggestedMap: body.suggestedMap ?? null,
            suggestedAgent: body.suggestedAgent ?? null,
            suggestedRank: body.suggestedRank ?? null,
            note: body.note ?? null,
            status: 'pending',
            createdAt: now,
        }),
        db.update(videos).set({ reviewNeeded: 1, updatedAt: now }).where(eq(videos.id, videoId)),
    ]);
    return c.json({ ok: true });
});
