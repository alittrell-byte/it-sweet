import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import '../../src/db/models';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

describe('POST /api/auth/register + /api/auth/login', () => {
  const email = 'auth-spec-user@example.com';
  const password = 'CorrectHorseBattery1';

  it('registers a new local customer account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Auth Spec User' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('customer');
  });

  it('rejects a duplicate registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Auth Spec User' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials and returns an access token', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=/);
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects requests to protected routes without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a ?token= query param on an ordinary API call', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: email, password });
    const res = await request(app).get(`/api/auth/me?token=${login.body.accessToken}`);
    expect(res.status).toBe(401);
  });

  it('accepts a ?token= query param for event-stream requests (the SSE log-tail EventSource cannot set headers)', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: email, password });
    const res = await request(app)
      .get(`/api/auth/me?token=${login.body.accessToken}`)
      .set('Accept', 'text/event-stream');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  describe('PATCH /api/auth/change-password', () => {
    it('rejects the wrong current password', async () => {
      const login = await request(app).post('/api/auth/login').send({ username: email, password });
      const res = await request(app)
        .patch('/api/auth/change-password')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ currentPassword: 'not-the-right-password', newPassword: 'BrandNewPassword1' });
      expect(res.status).toBe(401);
    });

    it('changes the password and the new one works on next login', async () => {
      const login = await request(app).post('/api/auth/login').send({ username: email, password });
      const changeRes = await request(app)
        .patch('/api/auth/change-password')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ currentPassword: password, newPassword: 'BrandNewPassword1' });
      expect(changeRes.status).toBe(204);

      const oldLoginRes = await request(app).post('/api/auth/login').send({ username: email, password });
      expect(oldLoginRes.status).toBe(401);

      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: email, password: 'BrandNewPassword1' });
      expect(newLoginRes.status).toBe(200);
    });
  });
});
