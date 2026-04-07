import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { adminCollectRoute } from './routes/admin/collect';
import { adminReviewRoute } from './routes/admin/review';
import { adminTagRoute } from './routes/admin/tag';
import { adminVideosRoute } from './routes/admin/videos';
import { correctionsRoute } from './routes/corrections';
import { videosRoute } from './routes/videos';
const app = new Hono();
// 公開エンドポイント用 CORS
app.use('/api/videos/*', cors({
    origin: (origin) => {
        if (!origin)
            return null;
        if (origin === 'http://localhost:4321')
            return origin;
        if (origin.endsWith('.valocoach-archive.pages.dev'))
            return origin;
        if (origin === 'https://valocoach-archive.pages.dev')
            return origin;
        return null;
    },
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type'],
}));
// 管理者エンドポイント用 CORS
// admin UI が別オリジンの場合はここに追加する
app.use('/api/admin/*', cors({
    origin: ['http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PATCH'],
    allowHeaders: ['Content-Type', 'X-Admin-Token'],
}));
// X-Admin-Token 認証ミドルウェア（全 admin ルートに適用）
app.use('/api/admin/*', async (c, next) => {
    const token = c.req.header('X-Admin-Token');
    if (!token || token !== c.env.ADMIN_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    return next();
});
app.route('/api/videos', videosRoute);
app.route('/api/admin/corrections', correctionsRoute);
app.route('/api/admin/collect', adminCollectRoute);
app.route('/api/admin/tag', adminTagRoute);
app.route('/api/admin/videos', adminVideosRoute);
app.route('/api/admin/review', adminReviewRoute);
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
export default { fetch: app.fetch };
