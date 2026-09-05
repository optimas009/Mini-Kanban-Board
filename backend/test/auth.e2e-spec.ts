import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, registerUser, resetDatabase } from './helpers.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports health on the root route without a token', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.body).toEqual({ message: 'Mini Kanban API', status: 'ok' });
  });

  describe('POST /auth/register', () => {
    it('creates an account and returns a token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Ada Lovelace',
          email: 'ada@example.test',
          password: 'password123',
        })
        .expect(201);

      expect(response.body.user).toMatchObject({
        name: 'Ada Lovelace',
        email: 'ada@example.test',
      });
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('never returns the password hash', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Ada',
          email: 'ada@example.test',
          password: 'password123',
        })
        .expect(201);

      expect(JSON.stringify(response.body)).not.toContain('password123');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('treats email as case-insensitive', async () => {
      await registerUser(app, { email: 'ada@example.test' });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Impostor',
          email: 'ADA@EXAMPLE.TEST',
          password: 'password123',
        })
        .expect(409);
    });

    it('rejects a duplicate email with 409', async () => {
      await registerUser(app, { email: 'taken@example.test' });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Second',
          email: 'taken@example.test',
          password: 'password123',
        })
        .expect(409);
    });

    it.each([
      ['a malformed email', { name: 'A', email: 'not-an-email', password: 'password123' }],
      ['a short password', { name: 'A', email: 'a@example.test', password: 'short' }],
      ['a blank name', { name: '', email: 'a@example.test', password: 'password123' }],
      ['a missing password', { name: 'A', email: 'a@example.test' }],
    ])('rejects %s with 400', async (_label, payload) => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(400);
    });

    it('strips unknown properties rather than trusting them', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Ada',
          email: 'ada@example.test',
          password: 'password123',
          id: 'attacker-chosen-id',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with the correct credentials', async () => {
      const user = await registerUser(app, { email: 'ada@example.test' });

      // Nest returns 201 for POST by default and the controller does not
      // override it. 200 would be more accurate for a login, since nothing is
      // created, but changing it now would change the API contract.
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(201);

      expect(response.body.user.id).toBe(user.id);
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('rejects a wrong password with 401', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password-1' })
        .expect(401);
    });

    it('gives an identical message for unknown email and wrong password', async () => {
      const user = await registerUser(app);

      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.test', password: 'password123' })
        .expect(401);

      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password-1' })
        .expect(401);

      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });
  });

  describe('token handling', () => {
    it('rejects a request with no token', async () => {
      await request(app.getHttpServer()).get('/boards').expect(401);
    });

    it('rejects a malformed token', async () => {
      await request(app.getHttpServer())
        .get('/boards')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('rejects a token signed with the wrong secret', async () => {
      // header.payload.signature, correctly shaped but signed with junk.
      const forged = [
        Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
          'base64url',
        ),
        Buffer.from(
          JSON.stringify({ sub: 'someone', email: 'a@b.test' }),
        ).toString('base64url'),
        'bm90LWEtdmFsaWQtc2lnbmF0dXJl',
      ].join('.');

      await request(app.getHttpServer())
        .get('/boards')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('accepts a valid token', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .get('/boards')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
    });
  });
});
