import { ConflictException } from '@nestjs/common';

/** Prisma error code for a write conflict or deadlock. */
const PRISMA_WRITE_CONFLICT = 'P2034';

/**
 * PostgreSQL SQLSTATEs: serialization_failure and deadlock_detected.
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_SERIALIZATION_FAILURE = '40001';
const PG_DEADLOCK_DETECTED = '40P01';

const DEFAULT_MAX_ATTEMPTS = 10;
const MAX_BACKOFF_MS = 100;

/**
 * A serialisation conflict reaches us in more than one shape, and getting this
 * wrong makes the whole retry loop silently dead:
 *
 *  - Through Prisma's own engine it is a known request error with code P2034.
 *  - Through a driver adapter (@prisma/adapter-pg, which this project uses) it
 *    is a `DriverAdapterError` whose message is `TransactionWriteConflict` and
 *    which carries no `code` at all.
 *  - The underlying pg error may also surface with SQLSTATE 40001 or 40P01,
 *    either directly or wrapped in `cause`.
 *
 * Anything that does not match is a real failure and must not be retried.
 */
function isSerializationFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
    cause?: unknown;
  };

  const code = candidate.code === undefined ? '' : String(candidate.code);

  if (
    code === PRISMA_WRITE_CONFLICT ||
    code === PG_SERIALIZATION_FAILURE ||
    code === PG_DEADLOCK_DETECTED
  ) {
    return true;
  }

  const message = String(candidate.message ?? '');

  if (
    candidate.name === 'DriverAdapterError' &&
    message.includes('TransactionWriteConflict')
  ) {
    return true;
  }

  if (
    message.includes('could not serialize access') ||
    message.includes('deadlock detected')
  ) {
    return true;
  }

  return candidate.cause !== undefined && isSerializationFailure(candidate.cause);
}

/**
 * Exponential backoff with jitter. Without the jitter, transactions that
 * conflicted once tend to retry in lockstep and conflict again.
 */
function backoffDelay(attempt: number): number {
  const ceiling = Math.min(2 ** attempt, MAX_BACKOFF_MS);
  return Math.random() * ceiling;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs a Serializable transaction, retrying only genuine serialisation
 * failures. Ordering writes shift whole ranges of sibling rows, so under
 * concurrent edits PostgreSQL will abort some of them; retrying is how the
 * board stays contiguous instead of developing gaps or duplicate positions.
 *
 * If every attempt conflicts, the caller gets a 409 rather than a 500: the
 * request is retryable, not broken.
 */
export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializationFailure(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw new ConflictException(
          'The board was being changed by someone else. Please try again.',
        );
      }

      await sleep(backoffDelay(attempt));
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new ConflictException('Could not complete the change. Please try again.');
}
