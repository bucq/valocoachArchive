import { Hono } from 'hono';
import { COACH_CHANNEL_IDS } from '@public-api/services/coaches.js';
import { collectVideos, searchCollect, type CollectEvent } from '../services/collector.js';

export const collectRoute = new Hono();

function sseStream(handler: (send: (event: CollectEvent) => void) => Promise<void>) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: CollectEvent) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  handler(send).finally(() => writer.close());

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/** GET /api/collect/channels — チャンネル一覧 */
collectRoute.get('/channels', (c) => {
  return c.json({
    channels: COACH_CHANNEL_IDS.map(id => ({
      id,
      placeholder: id.startsWith('REPLACE_'),
    })),
  });
});

/** POST /api/collect/all — 全チャンネル収集（SSE） */
collectRoute.post('/all', async (c) => {
  const body: { maxPerChannel?: number; dryRun?: boolean } = await c.req.json().catch(() => ({}));
  const apiKey = process.env['YOUTUBE_API_KEY'] ?? '';
  if (!apiKey) return c.json({ error: 'YOUTUBE_API_KEY not set' }, 500);

  return sseStream(async (send) => {
    await collectVideos({
      apiKey,
      maxPerChannel: body.maxPerChannel ?? 9999,
      dryRun: body.dryRun ?? false,
      onEvent: send,
    });
  });
});

/** POST /api/collect/channel/:id — 単チャンネル収集（SSE） */
collectRoute.post('/channel/:id', async (c) => {
  const channelId = c.req.param('id');
  const body: { maxResults?: number; dryRun?: boolean } = await c.req.json().catch(() => ({}));
  const apiKey = process.env['YOUTUBE_API_KEY'] ?? '';
  if (!apiKey) return c.json({ error: 'YOUTUBE_API_KEY not set' }, 500);

  return sseStream(async (send) => {
    await collectVideos({
      apiKey,
      channelIds: [channelId],
      maxPerChannel: body.maxResults ?? 9999,
      dryRun: body.dryRun ?? false,
      onEvent: send,
    });
  });
});

/** POST /api/collect/search — キーワード検索収集（SSE） */
collectRoute.post('/search', async (c) => {
  const body: { query?: string; maxResults?: number } = await c.req.json().catch(() => ({}));
  const query = body.query?.trim();
  if (!query) return c.json({ error: 'query is required' }, 400);

  const apiKey = process.env['YOUTUBE_API_KEY'] ?? '';
  if (!apiKey) return c.json({ error: 'YOUTUBE_API_KEY not set' }, 500);

  return sseStream(async (send) => {
    await searchCollect({
      apiKey,
      query,
      maxResults: body.maxResults ?? 20,
      onEvent: send,
    });
  });
});
