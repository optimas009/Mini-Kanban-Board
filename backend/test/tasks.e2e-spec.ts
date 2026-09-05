import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addTasks,
  auth,
  createTestApp,
  readBoardLayout,
  readPositions,
  registerUser,
  resetDatabase,
  seedBoard,
  type TestUser,
} from './helpers.js';

describe('Task movement and order consistency (e2e)', () => {
  let app: INestApplication;
  let user: TestUser;
  let boardId: string;
  let todo: string;
  let doing: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    user = await registerUser(app, { name: 'Mover' });

    const seeded = await seedBoard(app, user, 'Flow', ['Todo', 'Doing']);
    boardId = seeded.boardId;
    todo = seeded.columnIds[0]!;
    doing = seeded.columnIds[1]!;
  });

  afterAll(async () => {
    await app.close();
  });

  function move(taskId: string, columnId: string, position: number) {
    return request(app.getHttpServer())
      .patch(`/tasks/${taskId}/move`)
      .set(...auth(user.token))
      .send({ columnId, position });
  }

  describe('creation order', () => {
    it('appends new tasks in order', async () => {
      await addTasks(app, user, todo, ['A', 'B', 'C']);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['A', 'B', 'C'],
        Doing: [],
      });
    });

    it('assigns contiguous positions from zero', async () => {
      await addTasks(app, user, todo, ['A', 'B', 'C']);

      expect(await readPositions(app, user, boardId)).toEqual([[0, 1, 2], []]);
    });
  });

  describe('reordering within a column', () => {
    it('moves a task to the top', async () => {
      const [, , c] = await addTasks(app, user, todo, ['A', 'B', 'C']);

      await move(c!, todo, 0).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['C', 'A', 'B'],
        Doing: [],
      });
    });

    it('moves a task to the bottom', async () => {
      const [a] = await addTasks(app, user, todo, ['A', 'B', 'C']);

      await move(a!, todo, 2).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['B', 'C', 'A'],
        Doing: [],
      });
    });

    it('moves a task into the middle', async () => {
      const [a] = await addTasks(app, user, todo, ['A', 'B', 'C', 'D']);

      await move(a!, todo, 2).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['B', 'C', 'A', 'D'],
        Doing: [],
      });
    });

    it('leaves the board unchanged when moved to its current position', async () => {
      const [, b] = await addTasks(app, user, todo, ['A', 'B', 'C']);

      await move(b!, todo, 1).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['A', 'B', 'C'],
        Doing: [],
      });
    });

    it('clamps a position past the end to the last slot', async () => {
      const [a] = await addTasks(app, user, todo, ['A', 'B', 'C']);

      await move(a!, todo, 999).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['B', 'C', 'A'],
        Doing: [],
      });
    });

    it('keeps positions contiguous after reordering', async () => {
      const [a, , c] = await addTasks(app, user, todo, ['A', 'B', 'C', 'D']);

      await move(c!, todo, 0).expect(200);
      await move(a!, todo, 3).expect(200);

      expect(await readPositions(app, user, boardId)).toEqual([
        [0, 1, 2, 3],
        [],
      ]);
    });
  });

  describe('moving between columns', () => {
    it('moves a task to a specific index in another column', async () => {
      const [a] = await addTasks(app, user, todo, ['A', 'B']);
      await addTasks(app, user, doing, ['X', 'Y']);

      await move(a!, doing, 1).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['B'],
        Doing: ['X', 'A', 'Y'],
      });
    });

    it('appends when the position is past the end of the destination', async () => {
      const [a] = await addTasks(app, user, todo, ['A']);
      await addTasks(app, user, doing, ['X', 'Y']);

      await move(a!, doing, 999).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: [],
        Doing: ['X', 'Y', 'A'],
      });
    });

    it('closes the gap left behind in the source column', async () => {
      const [, b] = await addTasks(app, user, todo, ['A', 'B', 'C']);

      await move(b!, doing, 0).expect(200);

      expect(await readPositions(app, user, boardId)).toEqual([[0, 1], [0]]);
    });

    it('moves into an empty column', async () => {
      const [a] = await addTasks(app, user, todo, ['A']);

      await move(a!, doing, 0).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: [],
        Doing: ['A'],
      });
    });

    it('survives a full round trip back to the original column', async () => {
      const [a] = await addTasks(app, user, todo, ['A', 'B']);

      await move(a!, doing, 0).expect(200);
      await move(a!, todo, 0).expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['A', 'B'],
        Doing: [],
      });
      expect(await readPositions(app, user, boardId)).toEqual([[0, 1], []]);
    });
  });

  describe('rejected moves', () => {
    it('rejects a move into a column on another board with 400', async () => {
      const [a] = await addTasks(app, user, todo, ['A']);
      const other = await seedBoard(app, user, 'Other board', ['Elsewhere']);

      await move(a!, other.columnIds[0]!, 0).expect(400);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['A'],
        Doing: [],
      });
    });

    it('rejects a negative position with 400', async () => {
      const [a] = await addTasks(app, user, todo, ['A']);

      await move(a!, todo, -1).expect(400);
    });

    it('rejects a non-integer position with 400', async () => {
      const [a] = await addTasks(app, user, todo, ['A']);

      await request(app.getHttpServer())
        .patch(`/tasks/${a}/move`)
        .set(...auth(user.token))
        .send({ columnId: todo, position: 1.5 })
        .expect(400);
    });

    it('returns 404 for an unknown task', async () => {
      await move('00000000-0000-0000-0000-000000000000', todo, 0).expect(404);
    });

    it('returns 404 for an unknown destination column', async () => {
      const [a] = await addTasks(app, user, todo, ['A']);

      await move(a!, '00000000-0000-0000-0000-000000000000', 0).expect(404);
    });
  });

  describe('deletion', () => {
    it('closes the gap left by a deleted task', async () => {
      const [, b] = await addTasks(app, user, todo, ['A', 'B', 'C']);

      await request(app.getHttpServer())
        .delete(`/tasks/${b}`)
        .set(...auth(user.token))
        .expect(200);

      expect(await readBoardLayout(app, user, boardId)).toEqual({
        Todo: ['A', 'C'],
        Doing: [],
      });
      expect(await readPositions(app, user, boardId)).toEqual([[0, 1], []]);
    });

    it('removes a column and its tasks, and resequences the rest', async () => {
      const seeded = await seedBoard(app, user, 'Three', ['One', 'Two', 'Three']);

      await request(app.getHttpServer())
        .delete(`/columns/${seeded.columnIds[0]}`)
        .set(...auth(user.token))
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/boards/${seeded.boardId}`)
        .set(...auth(user.token))
        .expect(200);

      expect(
        response.body.columns.map((c: { title: string; position: number }) => [
          c.title,
          c.position,
        ]),
      ).toEqual([
        ['Two', 0],
        ['Three', 1],
      ]);
    });
  });

  describe('order consistency under concurrency', () => {
    it('keeps positions contiguous when many tasks are moved at once', async () => {
      const ids = await addTasks(app, user, todo, [
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
      ]);

      // Every task races to claim position 0 of the other column. Whatever
      // order the transactions serialise in, the result must be a clean
      // 0..n-1 sequence with no duplicates and no gaps.
      const results = await Promise.all(
        ids.map((id) => move(id, doing, 0).then((res) => res.status)),
      );

      expect(results.every((status) => status === 200)).toBe(true);

      const [todoPositions, doingPositions] = await readPositions(
        app,
        user,
        boardId,
      );

      expect(todoPositions).toEqual([]);
      expect(doingPositions).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('does not lose or duplicate tasks when reordering concurrently', async () => {
      const ids = await addTasks(app, user, todo, ['A', 'B', 'C', 'D', 'E']);

      await Promise.all([
        move(ids[0]!, todo, 4),
        move(ids[4]!, todo, 0),
        move(ids[2]!, todo, 1),
        move(ids[1]!, todo, 3),
      ]);

      const layout = await readBoardLayout(app, user, boardId);

      expect([...layout.Todo!].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);

      const [todoPositions] = await readPositions(app, user, boardId);
      expect(todoPositions).toEqual([0, 1, 2, 3, 4]);
    });

    it('keeps concurrent task creation contiguous', async () => {
      await Promise.all(
        ['A', 'B', 'C', 'D', 'E'].map((title) =>
          request(app.getHttpServer())
            .post(`/columns/${todo}/tasks`)
            .set(...auth(user.token))
            .send({ title }),
        ),
      );

      const [todoPositions] = await readPositions(app, user, boardId);

      expect(todoPositions).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
