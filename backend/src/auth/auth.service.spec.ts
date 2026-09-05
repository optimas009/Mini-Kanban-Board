import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

// vi.mock is hoisted above the module body, so the spies it closes over have
// to be created with vi.hoisted rather than plain consts.
const { hash, compare } = vi.hoisted(() => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: { hash, compare },
  hash,
  compare,
}));

const USER_ROW = {
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'stored-hash',
  createdAt: new Date('2026-01-01'),
};

describe('AuthService', () => {
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    hash.mockResolvedValue('new-hash');
    compare.mockResolvedValue(true);
    prisma = { user: { findUnique: vi.fn(), create: vi.fn() } };
    jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('normalises the email and trims the name', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(USER_ROW);

      await service.register({
        name: '  Ada  ',
        email: '  Ada@Example.COM ',
        password: 'password123',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Ada',
            email: 'ada@example.com',
          }),
        }),
      );
    });

    it('hashes the password rather than storing it', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(USER_ROW);

      await service.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'password123',
      });

      expect(hash).toHaveBeenCalledWith('password123', 12);
      const written = prisma.user.create.mock.calls[0]![0].data;
      expect(written.passwordHash).toBe('new-hash');
      expect(JSON.stringify(written)).not.toContain('password123');
    });

    it('rejects an email that is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          name: 'Ada',
          email: 'ada@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('maps a unique-constraint race (P2002) to Conflict', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        Object.assign(new Error('unique violation'), { code: 'P2002' }),
      );

      await expect(
        service.register({
          name: 'Ada',
          email: 'ada@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rethrows unrelated database errors untouched', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.register({
          name: 'Ada',
          email: 'ada@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('connection lost');
    });

    it('returns a signed token carrying the user id as subject', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(USER_ROW);

      const result = await service.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'password123',
      });

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'ada@example.com',
      });
      expect(result.accessToken).toBe('signed-token');
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_ROW);
      compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'ada@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('uses the same message for both failures so accounts cannot be enumerated', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const unknownEmail = await service
        .login({ email: 'nobody@example.com', password: 'password123' })
        .catch((error: Error) => error.message);

      prisma.user.findUnique.mockResolvedValue(USER_ROW);
      compare.mockResolvedValue(false);
      const wrongPassword = await service
        .login({ email: 'ada@example.com', password: 'wrong-password' })
        .catch((error: Error) => error.message);

      expect(unknownEmail).toBe(wrongPassword);
    });

    it('never returns the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_ROW);

      const result = await service.login({
        email: 'ada@example.com',
        password: 'password123',
      });

      expect(JSON.stringify(result)).not.toContain('stored-hash');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('compares against the stored hash', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_ROW);

      await service.login({ email: 'ada@example.com', password: 'password123' });

      expect(compare).toHaveBeenCalledWith('password123', 'stored-hash');
    });
  });
});
