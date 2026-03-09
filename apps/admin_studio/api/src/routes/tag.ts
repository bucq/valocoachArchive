import { Hono } from 'hono';
import { tagPendingVideos, resetTaggingStatus, type TagEvent } from '../services/tagger.js';

export const tagRoute = new Hono();

function sseStream(handler: (send: (event: TagEvent) => void) => Promise<void>) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: TagEvent) => {
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

/** POST /api/tag/batch — pending/failed 一括タグ付け（SSE） */
tagRoute.post('/batch', async (c) => {
  const body: { maxCount?: number; dryRun?: boolean; provider?: 'gemini' | 'gemma' | 'anthropic' } = await c.req.json().catch(() => ({}));
  const apiKey = process.env['GEMINI_API_KEY'] ?? '';
  if (!apiKey) return c.json({ error: 'GEMINI_API_KEY not set' }, 500);

  return sseStream(async (send) => {
    await tagPendingVideos({
      geminiApiKey: apiKey,
      provider: body.provider ?? 'gemini',
      maxCount: body.maxCount ?? 500,
      dryRun: body.dryRun ?? false,
      onEvent: send,
    });
  });
});

/** POST /api/tag/reset — タグ付けステータスをリセット */
tagRoute.post('/reset', async (c) => {
  const body: { statuses?: string[] } = await c.req.json().catch(() => ({}));
  const statuses = body.statuses ?? ['pending', 'in_progress', 'complete', 'skipped', 'failed'];
  const count = await resetTaggingStatus(statuses);
  return c.json({ status: 'reset', statuses, count });
});
