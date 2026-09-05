import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addTasks,
  auth,
  createTestApp,
  registerUser,
  resetDatabase,
  seedBoard,
  type TestUser,
} from './helpers.js';

describe('Boards, sharing and access control (e2e)', () => {
  let app: INestApplication;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    owner = await registerUser(app, { name: 'Owner' });
    member = await registerUser(app, { name: 'Member' });
    outsider = await registerUser(app, { name: 'Outsider' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('board lifecycle', () => {
    it('creates a board owned by the caller', async () => {
      const response = await request(app.getHttpServer())
        .post('/boards')
        .set(...auth(owner.token))
        .send({ name: 'Product launch' })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Product launch',
        ownerId: owner.id,
      });
    });

    it('ignores a client-supplied ownerId', async () => {
      await request(app.getHttpServer())
        .post('/boards')
        .set(...auth(owner.token))
        .send({ name: 'Hijack', ownerId: outsider.id })
        .expect(400);
    });

    it('lists only boards the caller can see', async () => {
      await seedBoard(app, owner, 'Owned board');
      await seedBoard(app, outsider, 'Someone else board');

      const response = await request(app.getHttpServer())
        .get('/boards')
        .set(...auth(owner.token))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Owned board');
    });

    it('renames and deletes a board as the owner', async () => {
      const { boardId } = await seedBoard(app, owner, 'Before');

      await request(app.getHttpServer())
        .patch(`/boards/${boardId}`)
        .set(...auth(owner.token))
        .send({ name: 'After' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/boards/${boardId}`)
        .set(...auth(owner.token))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/boards/${boardId}`)
        .set(...auth(owner.token))
        .expect(404);
    });

    it('cascades deletion to columns and tasks', async () => {
      const { boardId, columnIds } = await seedBoard(app, owner, 'Doomed', [
        'Todo',
      ]);
      const [taskId] = await addTasks(app, owner, columnIds[0]!, ['Task']);

      await request(app.getHttpServer())
        .delete(`/boards/${boardId}`)
        .set(...auth(owner.token))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set(...auth(owner.token))
        .send({ title: 'Still here?' })
        .expect(404);
    });
  });

  describe('sharing', () => {
    it('grants a registered user access by email', async () => {
      const { boardId } = await seedBoard(app, owner, 'Shared');

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: member.email })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/boards/${boardId}`)
        .set(...auth(member.token))
        .expect(200);
    });

    it('makes the board appear in the member board list', async () => {
      const { boardId } = await seedBoard(app, owner, 'Shared');

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: member.email })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/boards')
        .set(...auth(member.token))
        .expect(200);

      expect(response.body.map((board: { id: string }) => board.id)).toContain(
        boardId,
      );
    });

    it('matches the email case-insensitively', async () => {
      const { boardId } = await seedBoard(app, owner, 'Shared');

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: member.email.toUpperCase() })
        .expect(201);
    });

    it('rejects an unregistered email with 404', async () => {
      const { boardId } = await seedBoard(app, owner, 'Shared');

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: 'nobody@example.test' })
        .expect(404);
    });

    it('rejects sharing with the owner with 400', async () => {
      const { boardId } = await seedBoard(app, owner, 'Shared');

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: owner.email })
        .expect(400);
    });

    it('rejects a duplicate share with 409', async () => {
      const { boardId } = await seedBoard(app, owner, 'Shared');

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: member.email })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: member.email })
        .expect(409);
    });

    it('revokes access when the member is removed', async () => {
      const { boardId } = await seedBoard(app, owner, 'Shared');

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: member.email })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/boards/${boardId}/members/${member.id}`)
        .set(...auth(owner.token))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/boards/${boardId}`)
        .set(...auth(member.token))
        .expect(404);
    });
  });

  describe('a member can do collaborative work but not own the board', () => {
    let boardId: string;
    let columnId: string;

    beforeEach(async () => {
      const seeded = await seedBoard(app, owner, 'Shared', ['Todo']);
      boardId = seeded.boardId;
      columnId = seeded.columnIds[0]!;

      await request(app.getHttpServer())
        .post(`/boards/${boardId}/members`)
        .set(...auth(owner.token))
        .send({ email: member.email })
        .expect(201);
    });

    it('lets a member add a column', async () => {
      await request(app.getHttpServer())
        .post(`/boards/${boardId}/columns`)
        .set(...auth(member.token))
        .send({ title: 'Doing' })
        .expect(201);
    });

    it('lets a member add and move tasks', async () => {
      const [taskId] = await addTasks(app, member, columnId, ['Member task']);

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/move`)
        .set(...auth(member.token))
        .send({ columnId, position: 0 })
        .expect(200);
    });

    it.each([
      ['rename the board', 'patch', '', { name: 'Renamed' }],
      ['delete the board', 'delete', '', undefined],
      ['share the board', 'post', '/members', { email: 'x@example.test' }],
    ])('stops a member trying to %s with 403', async (_label, method, suffix, body) => {
      const call = request(app.getHttpServer())
        [method as 'patch' | 'delete' | 'post'](`/boards/${boardId}${suffix}`)
        .set(...auth(member.token));

      await (body ? call.send(body) : call).expect(403);
    });

    it('stops a member removing another member with 403', async () => {
      await request(app.getHttpServer())
        .delete(`/boards/${boardId}/members/${member.id}`)
        .set(...auth(member.token))
        .expect(403);
    });
  });

  describe('an outsider is blocked from every route on the board', () => {
    let boardId: string;
    let columnId: string;
    let taskId: string;

    beforeEach(async () => {
      const seeded = await seedBoard(app, owner, 'Private', ['Todo']);
      boardId = seeded.boardId;
      columnId = seeded.columnIds[0]!;
      [taskId] = await addTasks(app, owner, columnId, ['Secret task']);
    });

    it('cannot read the board, and gets 404 rather than 403', async () => {
      await request(app.getHttpServer())
        .get(`/boards/${boardId}`)
        .set(...auth(outsider.token))
        .expect(404);
    });

    it('cannot see it in their own board list', async () => {
      const response = await request(app.getHttpServer())
        .get('/boards')
        .set(...auth(outsider.token))
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('cannot create a column on it', async () => {
      await request(app.getHttpServer())
        .post(`/boards/${boardId}/columns`)
        .set(...auth(outsider.token))
        .send({ title: 'Intrusion' })
        .expect(404);
    });

    it('cannot edit or delete its columns', async () => {
      await request(app.getHttpServer())
        .patch(`/columns/${columnId}`)
        .set(...auth(outsider.token))
        .send({ title: 'Renamed' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/columns/${columnId}`)
        .set(...auth(outsider.token))
        .expect(404);
    });

    it('cannot create, edit, move or delete its tasks', async () => {
      await request(app.getHttpServer())
        .post(`/columns/${columnId}/tasks`)
        .set(...auth(outsider.token))
        .send({ title: 'Intrusion' })
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set(...auth(outsider.token))
        .send({ title: 'Renamed' })
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/move`)
        .set(...auth(outsider.token))
        .send({ columnId, position: 0 })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set(...auth(outsider.token))
        .expect(404);
    });

    it('leaves the board untouched after all of that', async () => {
      const response = await request(app.getHttpServer())
        .get(`/boards/${boardId}`)
        .set(...auth(owner.token))
        .expect(200);

      expect(response.body.columns).toHaveLength(1);
      expect(response.body.columns[0].tasks).toHaveLength(1);
      expect(response.body.columns[0].tasks[0].title).toBe('Secret task');
    });
  });
});
