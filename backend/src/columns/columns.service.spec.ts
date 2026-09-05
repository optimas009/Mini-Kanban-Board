import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BoardsService } from '../boards/boards.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ColumnsService } from './columns.service.js';

const BOARD = 'board-1';
const COLUMN = 'col-1';
const USER = 'user-1';

function createTx() {
  return {
    column: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  };
}

type Tx = ReturnType<typeof createTx>;

describe('ColumnsService', () => {
  let tx: Tx;
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    column: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  };
  let boards: { assertCanAccess: ReturnType<typeof vi.fn> };
  let service: ColumnsService;

  beforeEach(() => {
    tx = createTx();
    prisma = {
      $transaction: vi.fn(async (fn: (client: Tx) => unknown) => await fn(tx)),
      column: { findUnique: vi.fn(), update: vi.fn() },
    };
    boards = { assertCanAccess: vi.fn().mockResolvedValue({ id: BOARD }) };
    service = new ColumnsService(
      prisma as unknown as PrismaService,
      boards as unknown as BoardsService,
    );
  });

  describe('create', () => {
    it('appends the column and defaults the colour to navy', async () => {
      tx.column.count.mockResolvedValue(2);
      tx.column.create.mockResolvedValue({ id: COLUMN });

      await service.create(USER, BOARD, { title: '  Review  ' });

      expect(tx.column.create).toHaveBeenCalledWith({
        data: {
          title: 'Review',
          color: 'navy',
          position: 2,
          boardId: BOARD,
        },
      });
    });

    it('keeps an explicit colour', async () => {
      tx.column.count.mockResolvedValue(0);
      tx.column.create.mockResolvedValue({ id: COLUMN });

      await service.create(USER, BOARD, { title: 'Done', color: 'green' });

      expect(tx.column.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ color: 'green' }),
        }),
      );
    });

    it('checks board access before writing', async () => {
      boards.assertCanAccess.mockRejectedValue(new NotFoundException());

      await expect(
        service.create(USER, BOARD, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.column.findUnique.mockResolvedValue({
        id: COLUMN,
        boardId: BOARD,
        position: 0,
      });
      prisma.column.update.mockResolvedValue({ id: COLUMN });
    });

    it('only writes the supplied fields', async () => {
      await service.update(USER, COLUMN, { color: 'red' });

      expect(prisma.column.update).toHaveBeenCalledWith({
        where: { id: COLUMN },
        data: { color: 'red' },
      });
    });

    it('trims the title', async () => {
      await service.update(USER, COLUMN, { title: '  Blocked  ' });

      expect(prisma.column.update).toHaveBeenCalledWith({
        where: { id: COLUMN },
        data: { title: 'Blocked' },
      });
    });

    it('throws NotFound for a missing column', async () => {
      prisma.column.findUnique.mockResolvedValue(null);

      await expect(
        service.update(USER, 'nope', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('move', () => {
    beforeEach(() => {
      prisma.column.findUnique.mockResolvedValue({
        id: COLUMN,
        boardId: BOARD,
        position: 3,
      });
      tx.column.findUnique.mockResolvedValue({
        id: COLUMN,
        boardId: BOARD,
        position: 3,
      });
      tx.column.count.mockResolvedValue(5);
      tx.column.update.mockResolvedValue({ id: COLUMN });
    });

    it('shifts the passed-over range right when moving left', async () => {
      await service.move(USER, COLUMN, { position: 1 });

      expect(tx.column.updateMany).toHaveBeenCalledWith({
        where: {
          boardId: BOARD,
          position: { gte: 1, lt: 3 },
          NOT: { id: COLUMN },
        },
        data: { position: { increment: 1 } },
      });
    });

    it('shifts the passed-over range left when moving right', async () => {
      await service.move(USER, COLUMN, { position: 4 });

      expect(tx.column.updateMany).toHaveBeenCalledWith({
        where: {
          boardId: BOARD,
          position: { gt: 3, lte: 4 },
          NOT: { id: COLUMN },
        },
        data: { position: { decrement: 1 } },
      });
    });

    it('clamps beyond the last index', async () => {
      await service.move(USER, COLUMN, { position: 999 });

      expect(tx.column.update).toHaveBeenCalledWith({
        where: { id: COLUMN },
        data: { position: 4 },
      });
    });

    it('is a no-op when the position is unchanged', async () => {
      await service.move(USER, COLUMN, { position: 3 });

      expect(tx.column.updateMany).not.toHaveBeenCalled();
      expect(tx.column.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the column and closes the gap behind it', async () => {
      prisma.column.findUnique.mockResolvedValue({
        id: COLUMN,
        boardId: BOARD,
        position: 1,
      });

      await service.remove(USER, COLUMN);

      expect(tx.column.delete).toHaveBeenCalledWith({ where: { id: COLUMN } });
      expect(tx.column.updateMany).toHaveBeenCalledWith({
        where: { boardId: BOARD, position: { gt: 1 } },
        data: { position: { decrement: 1 } },
      });
    });
  });

  describe('isolation', () => {
    it('runs ordering writes at the Serializable isolation level', async () => {
      tx.column.count.mockResolvedValue(0);
      tx.column.create.mockResolvedValue({ id: COLUMN });

      await service.create(USER, BOARD, { title: 'x' });

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
    });
  });
});
