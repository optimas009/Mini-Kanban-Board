import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertTestDatabase } from './database-url.js';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

export async function createTestApp(): Promise<INestApplication> {
  assertTestDatabase(process.env.DATABASE_URL ?? '');

  const app = await NestFactory.create(AppModule, { logger: false });

  // Mirrors the pipe configured in src/main.ts so validation behaves
  // identically to production.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  return app;
}

export async function resetDatabase(app: INestApplication): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL ?? '');

  const prisma = app.get(PrismaService);

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Task", "Column", "BoardMember", "Board", "User" RESTART IDENTITY CASCADE',
  );
}

let userCounter = 0;

export async function registerUser(
  app: INestApplication,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<TestUser> {
  userCounter += 1;

  const payload = {
    name: overrides.name ?? `User ${userCounter}`,
    email: overrides.email ?? `user${userCounter}@example.test`,
    password: overrides.password ?? 'password123',
  };

  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send(payload)
    .expect(201);

  return {
    id: response.body.user.id,
    name: response.body.user.name,
    email: response.body.user.email,
    password: payload.password,
    token: response.body.accessToken,
  };
}

export function auth(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

/** Creates a board with `columnTitles` columns, returning their ids in order. */
export async function seedBoard(
  app: INestApplication,
  user: TestUser,
  name: string,
  columnTitles: string[] = [],
): Promise<{ boardId: string; columnIds: string[] }> {
  const server = app.getHttpServer();

  const board = await request(server)
    .post('/boards')
    .set(...auth(user.token))
    .send({ name })
    .expect(201);

  const columnIds: string[] = [];

  for (const title of columnTitles) {
    const column = await request(server)
      .post(`/boards/${board.body.id}/columns`)
      .set(...auth(user.token))
      .send({ title })
      .expect(201);

    columnIds.push(column.body.id);
  }

  return { boardId: board.body.id, columnIds };
}

export async function addTasks(
  app: INestApplication,
  user: TestUser,
  columnId: string,
  titles: string[],
): Promise<string[]> {
  const ids: string[] = [];

  for (const title of titles) {
    const response = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set(...auth(user.token))
      .send({ title })
      .expect(201);

    ids.push(response.body.id);
  }

  return ids;
}

/** Reads a board back as `{ 'Column title': ['Task A', 'Task B'] }`, ordered by position. */
export async function readBoardLayout(
  app: INestApplication,
  user: TestUser,
  boardId: string,
): Promise<Record<string, string[]>> {
  const response = await request(app.getHttpServer())
    .get(`/boards/${boardId}`)
    .set(...auth(user.token))
    .expect(200);

  const layout: Record<string, string[]> = {};

  for (const column of response.body.columns) {
    layout[column.title] = column.tasks.map(
      (task: { title: string }) => task.title,
    );
  }

  return layout;
}

/** Every column's task positions, for asserting they stay contiguous. */
export async function readPositions(
  app: INestApplication,
  user: TestUser,
  boardId: string,
): Promise<number[][]> {
  const response = await request(app.getHttpServer())
    .get(`/boards/${boardId}`)
    .set(...auth(user.token))
    .expect(200);

  return response.body.columns.map((column: { tasks: { position: number }[] }) =>
    column.tasks.map((task) => task.position),
  );
}
