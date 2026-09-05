import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { BoardsService } from './boards.service.js';

function createPrismaMock() {
  return {
    board: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    boardMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

const OWNER = 'user-owner';
const MEMBER = 'user-member';
const OUTSIDER = 'user-outsider';
const BOARD = 'board-1';

describe('BoardsService', () => {
  let prisma: PrismaMock;
  let service: BoardsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new BoardsService(prisma as unknown as PrismaService);
  });

  describe('assertCanAccess', () => {
    it('returns the board when the user owns it or is a member', async () => {
      prisma.board.findFirst.mockResolvedValue({ id: BOARD, ownerId: OWNER });

      await expect(service.assertCanAccess(MEMBER, BOARD)).resolves.toEqual({
        id: BOARD,
        ownerId: OWNER,
      });
    });

    it('queries for ownership OR membership rather than ownership alone', async () => {
      prisma.board.findFirst.mockResolvedValue({ id: BOARD, ownerId: OWNER });

      await service.assertCanAccess(MEMBER, BOARD);

      const where = prisma.board.findFirst.mock.calls[0]![0].where;
      expect(where.id).toBe(BOARD);
      expect(where.OR).toEqual([
        { ownerId: MEMBER },
        { members: { some: { userId: MEMBER } } },
      ]);
    });

    it('throws NotFound (not Forbidden) so board existence is not disclosed', async () => {
      prisma.board.findFirst.mockResolvedValue(null);

      await expect(service.assertCanAccess(OUTSIDER, BOARD)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertOwner', () => {
    it('returns the board for the owner', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: BOARD, ownerId: OWNER });

      await expect(service.assertOwner(OWNER, BOARD)).resolves.toEqual({
        id: BOARD,
        ownerId: OWNER,
      });
    });

    it('throws NotFound when the board does not exist', async () => {
      prisma.board.findUnique.mockResolvedValue(null);

      await expect(service.assertOwner(OWNER, BOARD)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Forbidden for a member who is not the owner', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: BOARD, ownerId: OWNER });

      await expect(service.assertOwner(MEMBER, BOARD)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('trims the name and assigns the caller as owner', async () => {
      prisma.board.create.mockResolvedValue({ id: BOARD });

      await service.create(OWNER, { name: '  Product launch  ' });

      expect(prisma.board.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Product launch', ownerId: OWNER },
        }),
      );
    });
  });

  describe('findAllForUser', () => {
    it('returns boards the user owns as well as boards shared with them', async () => {
      prisma.board.findMany.mockResolvedValue([]);

      await service.findAllForUser(MEMBER);

      const where = prisma.board.findMany.mock.calls[0]![0].where;
      expect(where.OR).toEqual([
        { ownerId: MEMBER },
        { members: { some: { userId: MEMBER } } },
      ]);
    });
  });

  describe('update', () => {
    it('is owner-only', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: BOARD, ownerId: OWNER });

      await expect(
        service.update(MEMBER, BOARD, { name: 'Renamed' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.board.update).not.toHaveBeenCalled();
    });

    it('trims the new name', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: BOARD, ownerId: OWNER });
      prisma.board.update.mockResolvedValue({ id: BOARD });

      await service.update(OWNER, BOARD, { name: '  Renamed  ' });

      expect(prisma.board.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Renamed' } }),
      );
    });
  });

  describe('remove', () => {
    it('is owner-only', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: BOARD, ownerId: OWNER });

      await expect(service.remove(MEMBER, BOARD)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.board.delete).not.toHaveBeenCalled();
    });
  });

  describe('share', () => {
    beforeEach(() => {
      prisma.board.findUnique.mockResolvedValue({ id: BOARD, ownerId: OWNER });
    });

    it('is owner-only', async () => {
      await expect(
        service.share(MEMBER, BOARD, { email: 'someone@example.com' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.boardMember.create).not.toHaveBeenCalled();
    });

    it('normalises the email before lookup', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: MEMBER,
        name: 'Member',
        email: 'member@example.com',
      });
      prisma.boardMember.findUnique.mockResolvedValue(null);
      prisma.boardMember.create.mockResolvedValue({});

      await service.share(OWNER, BOARD, { email: '  Member@Example.COM  ' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'member@example.com' } }),
      );
    });

    it('throws NotFound when no registered user has that email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.share(OWNER, BOARD, { email: 'nobody@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects sharing a board with its own owner', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: OWNER,
        name: 'Owner',
        email: 'owner@example.com',
      });

      await expect(
        service.share(OWNER, BOARD, { email: 'owner@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate share with Conflict', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: MEMBER,
        name: 'Member',
        email: 'member@example.com',
      });
      prisma.boardMember.findUnique.mockResolvedValue({
        boardId: BOARD,
        userId: MEMBER,
      });

      await expect(
        service.share(OWNER, BOARD, { email: 'member@example.com' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.boardMember.create).not.toHaveBeenCalled();
    });

    it('creates the membership on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: MEMBER,
        name: 'Member',
        email: 'member@example.com',
      });
      prisma.boardMember.findUnique.mockResolvedValue(null);
      prisma.boardMember.create.mockResolvedValue({});

      const result = await service.share(OWNER, BOARD, {
        email: 'member@example.com',
      });

      expect(prisma.boardMember.create).toHaveBeenCalledWith({
        data: { boardId: BOARD, userId: MEMBER },
      });
      expect(result.member.id).toBe(MEMBER);
    });
  });

  describe('removeMember', () => {
    beforeEach(() => {
      prisma.board.findUnique.mockResolvedValue({ id: BOARD, ownerId: OWNER });
    });

    it('is owner-only', async () => {
      await expect(
        service.removeMember(MEMBER, BOARD, OUTSIDER),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });

    it('throws NotFound when the user is not a member', async () => {
      prisma.boardMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember(OWNER, BOARD, OUTSIDER),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the membership on success', async () => {
      prisma.boardMember.findUnique.mockResolvedValue({
        boardId: BOARD,
        userId: MEMBER,
      });
      prisma.boardMember.delete.mockResolvedValue({});

      await service.removeMember(OWNER, BOARD, MEMBER);

      expect(prisma.boardMember.delete).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: BOARD, userId: MEMBER } },
      });
    });
  });
});
