import logger from '../logger';
import formatError from '../../lib/formatError';
import type { ProducerQueue } from './createQueue';
import { connectSharedBullmqRedis } from './bullmqRedis';
import TrackingClickQueue from './TrackingClickQueue';
import TrackingErrorQueue from './TrackingErrorQueue';
import TrackingNoscriptViewQueue from './TrackingNoscriptViewQueue';
import TrackingViewHeartbeatQueue from './TrackingViewHeartbeatQueue';
import TrackingViewQueue from './TrackingViewQueue';

/** Bound queue warmup so startup never hangs if Redis is unreachable. */
export const QUEUE_WARMUP_TIMEOUT_MS = 10_000;

export interface WarmProducerQueuesResult {
  ready: boolean;
  failed: string[];
}

export interface WarmProducerQueuesOptions {
  timeoutMs?: number;
  queues?: ProducerQueue[];
  /** Test seam: skip/replace the shared Redis connect step. */
  connectRedis?: (timeoutMs: number) => Promise<unknown>;
}

const defaultProducerQueues: ProducerQueue[] = [
  TrackingViewQueue,
  TrackingViewHeartbeatQueue,
  TrackingNoscriptViewQueue,
  TrackingClickQueue,
  TrackingErrorQueue,
];

/**
 * Connect Redis, then wait until every producer queue can write.
 * Call before `listen()` so the load balancer never sends traffic while
 * BullMQ would reject with enableOfflineQueue=false.
 */
export default async function warmProducerQueues({
  timeoutMs = QUEUE_WARMUP_TIMEOUT_MS,
  queues = defaultProducerQueues,
  connectRedis = connectSharedBullmqRedis,
}: WarmProducerQueuesOptions = {}): Promise<WarmProducerQueuesResult> {
  const failed: string[] = [];
  const startedAt = Date.now();

  try {
    await connectRedis(timeoutMs);
  } catch (error) {
    logger.error(`Producer queue redis warmup ${formatError(error)}`);
    logger.error(
      'Producer queues not ready (redis) — continuing in degraded mode (enqueues may discard until Redis connects)'
    );
    return { ready: false, failed: ['redis'] };
  }

  const remainingMs = () => Math.max(50, timeoutMs - (Date.now() - startedAt));

  await Promise.all(
    queues.map(async (queue) => {
      try {
        await withTimeout(
          queue.waitUntilReady(),
          remainingMs(),
          `${queue.name} warmup`
        );
      } catch (error) {
        failed.push(queue.name);
        logger.error(`${queue.name} warmup ${formatError(error)}`);
      }
    })
  );

  if (failed.length === 0) {
    logger.info('Producer queues ready ✅');
    return { ready: true, failed };
  }

  logger.error(
    `Producer queues not ready (${failed.join(', ')}) — continuing in degraded mode (enqueues may discard until Redis connects)`
  );
  return { ready: false, failed };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        if (timer) {
          clearTimeout(timer);
        }
        resolve(value);
      },
      (error) => {
        if (timer) {
          clearTimeout(timer);
        }
        reject(error);
      }
    );
  });
}
