import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { videosRoute } from './routes/videos';
import { correctionsRoute } from './routes/corrections';

export type Env = {
  DB: D1Database;
  ADMIN_TOKEN: string;
};

const app = new Hono<{ Bindings: Env }>();

// 公開エンドポイント用 CORS（GET + POST を許可）
app.use('/api/videos/*', cors({
  origin: (origin) => {
    if (!origin) return null;
    if (origin === 'http://localhost:4321') return origin;
    if (origin.endsWith('.valocoach-archive.pages.dev')) return origin;
    if (origin === 'https://valocoach-archive.pages.dev') return origin;
    return null;
  },
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type'],
}));

// 管理者エンドポイント用 CORS（admin studio の開発サーバーから呼ばれる）
app.use('/api/admin/*', cors({
  origin: ['http://localhost:5173'],
  allowMethods: ['GET', 'PATCH'],
  allowHeaders: ['Content-Type', 'X-Admin-Token'],
}));

app.route('/api/videos', videosRoute);
app.route('/api/admin/corrections', correctionsRoute);

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default { fetch: app.fetch };
