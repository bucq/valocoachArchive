import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { COACH_CHANNEL_IDS } from '../../services/coaches';
import { collectVideos, searchCollect } from '../../services/admin/collector';
export const adminCollectRoute = new Hono();
function sseStream(handler) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (event) => {
        writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    };
    handler(send).finally(() => writer.close());
    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
/** GET /api/admin/collect/channels — チャンネル一覧 */
adminCollectRoute.get('/channels', (c) => {
    return c.json({
        channels: COACH_CHANNEL_IDS.map((id) => ({
            id,
            placeholder: id.startsWith('REPLACE_'),
        })),
    });
});
/** POST /api/admin/collect/all — 全チャンネル収集（SSE） */
adminCollectRoute.post('/all', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const apiKey = c.env.YOUTUBE_API_KEY;
    if (!apiKey)
        return c.json({ error: 'YOUTUBE_API_KEY not set' }, 500);
    const db = drizzle(c.env.DB);
    return sseStream(async (send) => {
        await collectVideos(db, {
            apiKey,
            maxPerChannel: body.maxPerChannel ?? 9999,
            dryRun: body.dryRun ?? false,
            onEvent: send,
        });
    });
});
/** POST /api/admin/collect/channel/:id — 単チャンネル収集（SSE） */
adminCollectRoute.post('/channel/:id', async (c) => {
    const channelId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const apiKey = c.env.YOUTUBE_API_KEY;
    if (!apiKey)
        return c.json({ error: 'YOUTUBE_API_KEY not set' }, 500);
    const db = drizzle(c.env.DB);
    return sseStream(async (send) => {
        await collectVideos(db, {
            apiKey,
            channelIds: [channelId],
            maxPerChannel: body.maxResults ?? 9999,
            dryRun: body.dryRun ?? false,
            onEvent: send,
        });
    });
});
/** POST /api/admin/collect/search — キーワード検索収集（SSE） */
adminCollectRoute.post('/search', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const query = body.query?.trim();
    if (!query)
        return c.json({ error: 'query is required' }, 400);
    const apiKey = c.env.YOUTUBE_API_KEY;
    if (!apiKey)
        return c.json({ error: 'YOUTUBE_API_KEY not set' }, 500);
    const db = drizzle(c.env.DB);
    return sseStream(async (send) => {
        await searchCollect(db, {
            apiKey,
            query,
            maxResults: body.maxResults ?? 20,
            onEvent: send,
        });
    });
});
