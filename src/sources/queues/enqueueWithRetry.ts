import logger from '../logger';
import formatError from '../../lib/formatError';

/** Initial attempt + 2 short retries before discarding. */
export const DEFAULT_MAX_ATTEMPTS = 3;
/** Covers brief ioredis reconnects without holding tracking requests open long. */
export const DEFAULT_RETRY_DELAY_MS = 100;

const discardedCounts = new Map<string, number>();

export type SleepFn = (ms: number) => Promise<void>;

export interface EnqueueWithRetryOptions {
  /** Log / metric label, e.g. `views.pushToQueue`. */
  label: string;
  /** Payload for error logs (must be JSON-serializable). */
  input: unknown;
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: SleepFn;
}

export function getDiscardedCount(label: string): number {
  return discardedCounts.get(label) ?? 0;
}

/** Test helper: clears in-memory discard counters. */
export function resetDiscardedCounts(): void {
  discardedCounts.clear();
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function recordDiscard(label: string): number {
  const next = getDiscardedCount(label) + 1;
  discardedCounts.set(label, next);
  return next;
}

/**
 * Runs `enqueue` with a few short retries. On final failure, increments a
 * process-local discard counter and logs — never throws (HTTP stays fast).
 */
export default async function enqueueWithRetry<T>(
  enqueue: () => Promise<T>,
  {
    label,
    input,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    sleep = defaultSleep,
  }: EnqueueWithRetryOptions
): Promise<T | undefined> {
  const attempts = Math.max(1, maxAttempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await enqueue();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  const discardedTotal = recordDiscard(label);
  logger.error(
    `${label} discarded=${discardedTotal} attempts=${attempts} input=${JSON.stringify(input)} ${formatError(lastError)}`
  );
  return undefined;
}
