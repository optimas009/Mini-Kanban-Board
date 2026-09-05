import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { withSerializableRetry } from './serializable-retry.js';

function serialisationFailure() {
  return Object.assign(new Error('could not serialize access'), {
    code: 'P2034',
  });
}

describe('withSerializableRetry', () => {
  it('returns the result when the first attempt succeeds', async () => {
    const operation = vi.fn().mockResolvedValue('ok');

    await expect(withSerializableRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries a serialisation failure until it succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(serialisationFailure())
      .mockRejectedValueOnce(serialisationFailure())
      .mockResolvedValue('ok');

    await expect(withSerializableRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('allows enough attempts to absorb realistic contention', async () => {
    const operation = vi.fn().mockRejectedValue(serialisationFailure());

    await expect(withSerializableRetry(operation)).rejects.toThrow(
      ConflictException,
    );
    expect(operation).toHaveBeenCalledTimes(10);
  });

  it('reports exhaustion as a retryable conflict, never as a raw Prisma error', async () => {
    const operation = vi.fn().mockRejectedValue(serialisationFailure());

    const error = await withSerializableRetry(operation).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect(JSON.stringify(error)).not.toContain('P2034');
  });

  describe('recognises a conflict in every shape it can arrive in', () => {
    it.each([
      [
        'Prisma engine (P2034)',
        Object.assign(new Error('write conflict'), { code: 'P2034' }),
      ],
      [
        // The shape this project actually produces, via @prisma/adapter-pg.
        'driver adapter (DriverAdapterError)',
        Object.assign(new Error('TransactionWriteConflict'), {
          name: 'DriverAdapterError',
        }),
      ],
      [
        'postgres SQLSTATE 40001',
        Object.assign(new Error('serialization failure'), { code: '40001' }),
      ],
      [
        'postgres SQLSTATE 40P01',
        Object.assign(new Error('deadlock'), { code: '40P01' }),
      ],
      [
        'postgres message text',
        new Error('could not serialize access due to concurrent update'),
      ],
      [
        'a conflict wrapped in cause',
        Object.assign(new Error('query failed'), {
          cause: Object.assign(new Error('TransactionWriteConflict'), {
            name: 'DriverAdapterError',
          }),
        }),
      ],
    ])('retries after %s', async (_label, error) => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('ok');

      await expect(withSerializableRetry(operation)).resolves.toBe('ok');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  it('does not retry errors that are not serialisation failures', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('connection lost'));

    await expect(withSerializableRetry(operation)).rejects.toThrow(
      'connection lost',
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry an application error raised inside the transaction', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('bad request'), { code: 400 }));

    await expect(withSerializableRetry(operation)).rejects.toThrow(
      'bad request',
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('honours a custom attempt budget', async () => {
    const operation = vi.fn().mockRejectedValue(serialisationFailure());

    await expect(withSerializableRetry(operation, 2)).rejects.toThrow(
      ConflictException,
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('backs off between attempts rather than retrying in a tight loop', async () => {
    // Asserted through setTimeout rather than elapsed wall-clock time: the
    // first backoff is a random 0-2ms, which Date.now() cannot resolve.
    const timer = vi.spyOn(globalThis, 'setTimeout');

    try {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(serialisationFailure())
        .mockResolvedValue('ok');

      await withSerializableRetry(operation);

      expect(timer).toHaveBeenCalledTimes(1);
      expect(timer.mock.calls[0]![1]).toBeGreaterThanOrEqual(0);
    } finally {
      timer.mockRestore();
    }
  });

  it('does not sleep when the first attempt succeeds', async () => {
    const timer = vi.spyOn(globalThis, 'setTimeout');

    try {
      await withSerializableRetry(vi.fn().mockResolvedValue('ok'));

      expect(timer).not.toHaveBeenCalled();
    } finally {
      timer.mockRestore();
    }
  });
});
