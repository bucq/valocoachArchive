import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { videosRoute } from './routes/videos.js';
import { collectRoute } from './routes/collect.js';
import { tagRoute } from './routes/tag.js';
import { reviewRoute } from './routes/review.js';
import { syncRoute } from './routes/sync.js';

const app = new Hono();

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type'],
}));

app.route('/api/videos', videosRoute);
app.route('/api/collect', collectRoute);
app.route('/api/tag', tagRoute);
app.route('/api/review', reviewRoute);
app.route('/api/sync', syncRoute);

app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

console.log(`\n[admin_studio/api] starting on http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });
