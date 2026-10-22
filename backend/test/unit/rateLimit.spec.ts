import express from 'express';
import request from 'supertest';
import { rateLimit } from '../../src/common/middleware/rateLimit';

function appWith(limiter: express.RequestHandler, status = 200) {
  const app = express();
  app.use(express.json());
  app.post('/', limiter, (_req, res) => {
    res.status(status).json({});
  });
  return app;
}

describe('rateLimit', () => {
  it('returns 429 once the limit is reached', async () => {
    const app = appWith(rateLimit({ windowMs: 60_000, max: 2, key: () => 'k' }));
    expect((await request(app).post('/')).status).toBe(200);
    expect((await request(app).post('/')).status).toBe(200);
    const blocked = await request(app).post('/');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('with countWhen, only counts matching responses', async () => {
    const ok = appWith(rateLimit({ windowMs: 60_000, max: 1, key: () => 'k', countWhen: (r) => r.statusCode === 401 }));
    for (let i = 0; i < 3; i++) expect((await request(ok).post('/')).status).toBe(200);

    const failing = appWith(rateLimit({ windowMs: 60_000, max: 1, key: () => 'k', countWhen: (r) => r.statusCode === 401 }), 401);
    expect((await request(failing).post('/')).status).toBe(401);
    expect((await request(failing).post('/')).status).toBe(429);
  });

  it('keeps separate buckets per key', async () => {
    const app = appWith(rateLimit({ windowMs: 60_000, max: 1, key: (req) => String(req.body.user) }));
    expect((await request(app).post('/').send({ user: 'a' })).status).toBe(200);
    expect((await request(app).post('/').send({ user: 'b' })).status).toBe(200);
    expect((await request(app).post('/').send({ user: 'a' })).status).toBe(429);
  });
});
