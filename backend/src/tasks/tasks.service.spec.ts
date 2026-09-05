import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BoardsService } from '../boards/boards.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from './tasks.service.js';

const BOARD = 'board-1';
const OTHER_BOARD = 'board-2';
const COL_A = 'col-a';
const COL_B = 'col-b';
const TASK = 'task-1';
const USER = 'user-1';

function createTx() {
  return {
    task: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    column: {
      findUnique: vi.fn(),
    },
  };
}

type Tx = ReturnType<typeof createTx>;

function createPrismaMock(tx: Tx) {
  return {
    $transaction: vi.fn(
      async (fn: (client: Tx) => unknown) => await fn(tx),
    ),
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    column: {
      findUnique: vi.fn(),
    },
  };
}

describe('TasksService', () => {
  let tx: Tx;
  let prisma: ReturnType<typeof createPrismaMock>;
  let boards: { assertCanAccess: ReturnType<typeof vi.fn> };
  let service: TasksService;

  beforeEach(() => {
    tx = createTx();
    prisma = createPrismaMock(tx);
    boards = { assertCanAccess: vi.fn().mockResolvedValue({ id: BOARD }) };
    service = new TasksService(
      prisma as unknown as PrismaService,
      boards as unknown as BoardsService,
    );
  });

  describe('create', () => {
    it('appends the task at the end of the column', async () => {
      prisma.column.findUnique.mockResolvedValue({ id: COL_A, boardId: BOARD });
      tx.task.count.mockResolvedValue(3);
      tx.task.create.mockResolvedValue({ id: TASK });

      await service.create(USER, COL_A, { title: '  Ship it  ' });

      expect(tx.task.create).toHaveBeenCalledWith({
        data: {
          title: 'Ship it',
          description: undefined,
          position: 3,
          columnId: COL_A,
        },
      });
    });

    it('checks board access before writing', async () => {
      prisma.column.findUnique.mockResolvedValue({ id: COL_A, boardId: BOARD });
      tx.task.count.mockResolvedValue(0);
      tx.task.create.mockResolvedValue({ id: TASK });

      await service.create(USER, COL_A, { title: 'x' });

      expect(boards.assertCanAccess).toHaveBeenCalledWith(USER, BOARD);
    });

    it('throws NotFound for a missing column', async () => {
      prisma.column.findUnique.mockResolvedValue(null);

      await expect(
        service.create(USER, 'nope', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('stores a blank description as null', async () => {
      prisma.column.findUnique.mockResolvedValue({ id: COL_A, boardId: BOARD });
      tx.task.count.mockResolvedValue(0);
      tx.task.create.mockResolvedValue({ id: TASK });

      await service.create(USER, COL_A, { title: 'x', description: '   ' });

      expect(tx.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null }),
        }),
      );
    });
  });

  describe('move within the same column', () => {
    beforeEach(() => {
      prisma.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 3,
        column: { id: COL_A, boardId: BOARD },
      });
      tx.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 3,
        column: { id: COL_A, boardId: BOARD },
      });
      tx.column.findUnique.mockResolvedValue({ id: COL_A, boardId: BOARD });
      tx.task.count.mockResolvedValue(5);
      tx.task.update.mockResolvedValue({ id: TASK });
    });

    it('shifts the passed-over range down when moving up', async () => {
      await service.move(USER, TASK, { columnId: COL_A, position: 1 });

      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: {
          columnId: COL_A,
          position: { gte: 1, lt: 3 },
          NOT: { id: TASK },
        },
        data: { position: { increment: 1 } },
      });
      expect(tx.task.update).toHaveBeenCalledWith({
        where: { id: TASK },
        data: { position: 1 },
      });
    });

    it('shifts the passed-over range up when moving down', async () => {
      await service.move(USER, TASK, { columnId: COL_A, position: 4 });

      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: {
          columnId: COL_A,
          position: { gt: 3, lte: 4 },
          NOT: { id: TASK },
        },
        data: { position: { decrement: 1 } },
      });
      expect(tx.task.update).toHaveBeenCalledWith({
        where: { id: TASK },
        data: { position: 4 },
      });
    });

    it('clamps a position past the end to the last slot', async () => {
      await service.move(USER, TASK, { columnId: COL_A, position: 999 });

      expect(tx.task.update).toHaveBeenCalledWith({
        where: { id: TASK },
        data: { position: 4 },
      });
    });

    it('is a no-op when the position is unchanged', async () => {
      await service.move(USER, TASK, { columnId: COL_A, position: 3 });

      expect(tx.task.updateMany).not.toHaveBeenCalled();
      expect(tx.task.update).not.toHaveBeenCalled();
    });
  });

  describe('move across columns', () => {
    beforeEach(() => {
      prisma.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 1,
        column: { id: COL_A, boardId: BOARD },
      });
      tx.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 1,
        column: { id: COL_A, boardId: BOARD },
      });
      tx.column.findUnique.mockResolvedValue({ id: COL_B, boardId: BOARD });
      tx.task.count.mockResolvedValue(2);
      tx.task.update.mockResolvedValue({ id: TASK });
    });

    it('closes the gap in the source column', async () => {
      await service.move(USER, TASK, { columnId: COL_B, position: 0 });

      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: { columnId: COL_A, position: { gt: 1 } },
        data: { position: { decrement: 1 } },
      });
    });

    it('opens a gap in the destination column', async () => {
      await service.move(USER, TASK, { columnId: COL_B, position: 0 });

      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: { columnId: COL_B, position: { gte: 0 } },
        data: { position: { increment: 1 } },
      });
    });

    it('writes the new column and position', async () => {
      await service.move(USER, TASK, { columnId: COL_B, position: 0 });

      expect(tx.task.update).toHaveBeenCalledWith({
        where: { id: TASK },
        data: { columnId: COL_B, position: 0 },
      });
    });

    it('clamps to append when the position exceeds the destination length', async () => {
      await service.move(USER, TASK, { columnId: COL_B, position: 999 });

      expect(tx.task.update).toHaveBeenCalledWith({
        where: { id: TASK },
        data: { columnId: COL_B, position: 2 },
      });
    });

    it('rejects a move into a column on a different board', async () => {
      tx.column.findUnique.mockResolvedValue({
        id: COL_B,
        boardId: OTHER_BOARD,
      });

      await expect(
        service.move(USER, TASK, { columnId: COL_B, position: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.task.update).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing destination column', async () => {
      tx.column.findUnique.mockResolvedValue(null);

      await expect(
        service.move(USER, TASK, { columnId: 'nope', position: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('move authorisation', () => {
    it('checks board access before moving', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 0,
        column: { id: COL_A, boardId: BOARD },
      });
      tx.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 0,
        column: { id: COL_A, boardId: BOARD },
      });
      tx.column.findUnique.mockResolvedValue({ id: COL_A, boardId: BOARD });
      tx.task.count.mockResolvedValue(1);

      await service.move(USER, TASK, { columnId: COL_A, position: 0 });

      expect(boards.assertCanAccess).toHaveBeenCalledWith(USER, BOARD);
    });

    it('propagates the access error and never opens a transaction', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 0,
        column: { id: COL_A, boardId: BOARD },
      });
      boards.assertCanAccess.mockRejectedValue(new NotFoundException());

      await expect(
        service.move(USER, TASK, { columnId: COL_A, position: 0 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing task', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.move(USER, 'nope', { columnId: COL_A, position: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 0,
        column: { id: COL_A, boardId: BOARD },
      });
      prisma.task.update.mockResolvedValue({ id: TASK });
    });

    it('only writes the fields that were supplied', async () => {
      await service.update(USER, TASK, { title: '  New title  ' });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: TASK },
        data: { title: 'New title' },
      });
    });

    it('clears the description when given an empty string', async () => {
      await service.update(USER, TASK, { description: '  ' });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: TASK },
        data: { description: null },
      });
    });
  });

  describe('remove', () => {
    it('deletes the task and closes the gap behind it', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: TASK,
        columnId: COL_A,
        position: 2,
        column: { id: COL_A, boardId: BOARD },
      });

      await service.remove(USER, TASK);

      expect(tx.task.delete).toHaveBeenCalledWith({ where: { id: TASK } });
      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: { columnId: COL_A, position: { gt: 2 } },
        data: { position: { decrement: 1 } },
      });
    });
  });

  describe('serialisable retry', () => {
    beforeEach(() => {
      prisma.column.findUnique.mockResolvedValue({ id: COL_A, boardId: BOARD });
      tx.task.count.mockResolvedValue(0);
      tx.task.create.mockResolvedValue({ id: TASK });
    });

    it('runs ordering writes at the Serializable isolation level', async () => {
      await service.create(USER, COL_A, { title: 'x' });

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
    });

    it('retries a serialisation failure (P2034) and succeeds', async () => {
      const conflict = Object.assign(new Error('write conflict'), {
        code: 'P2034',
      });
      prisma.$transaction
        .mockRejectedValueOnce(conflict)
        .mockImplementationOnce(async (fn: (client: Tx) => unknown) => fn(tx));

      await expect(
        service.create(USER, COL_A, { title: 'x' }),
      ).resolves.toEqual({ id: TASK });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('surfaces a 409 rather than a 500 when every attempt conflicts', async () => {
      const conflict = Object.assign(new Error('write conflict'), {
        code: 'P2034',
      });
      prisma.$transaction.mockRejectedValue(conflict);

      await expect(service.create(USER, COL_A, { title: 'x' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(10);
    });

    it('does not retry errors that are not serialisation failures', async () => {
      prisma.$transaction.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(USER, COL_A, { title: 'x' })).rejects.toThrow(
        'connection lost',
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
