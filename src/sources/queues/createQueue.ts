import { Queue, QueueOptions } from 'bullmq';
import logger from '../logger';
import formatError from '../../lib/formatError';
import { getBullmqConnection } from '../redisConfig';
import {
  closeSharedBullmqRedis,
  getSharedBullmqRedis,
} from './bullmqRedis';

const openQueues: Queue[] = [];

export async function closeQueues(): Promise<void> {
  const closing = openQueues.splice(0, openQueues.length);
  await Promise.all(
    closing.map(async (queue) => {
      try {
        await queue.close();
      } catch (error) {
        logger.error(`${queue.name} close ${formatError(error)}`);
      }
      try {
        // Stop ioredis reconnect timers after fail-fast tests against a dead Redis.
        await queue.disconnect();
      } catch {
        // Redis may already be unreachable; ignore disconnect errors.
      }
    })
  );
  await closeSharedBullmqRedis();
}

/** Producer options: fail fast when Redis is down (never hold HTTP requests open). */
export function buildQueueOptions(
  env: NodeJS.ProcessEnv = process.env
): QueueOptions {
  const shared = getSharedBullmqRedis();
  return {
    // Prefer the warmed shared client so BullMQ never races INFO against a
    // half-open socket (skipWaitingForReady + enableOfflineQueue=false).
    connection: shared ?? getBullmqConnection(env),
    skipWaitingForReady: true,
  };
}

export interface ProducerQueue {
  name: string;
  add: (
    jobName: string,
    data: unknown,
    opts?: Parameters<Queue['add']>[2]
  ) => Promise<unknown>;
  /** Ensure the BullMQ client exists and Redis is ready for writes. */
  waitUntilReady: () => Promise<void>;
}

export default function createQueue(name: string): ProducerQueue {
  let queue: Queue | undefined;

  function getQueue(): Queue {
    if (!queue) {
      // See https://docs.bullmq.io/patterns/failing-fast-when-redis-is-down
      queue = new Queue(name, buildQueueOptions());
      queue.on('error', (error: Error) => {
        logger.error(`${name} ${formatError(error)}`);
      });
      openQueues.push(queue);
    }
    return queue;
  }

  return {
    name,
    add: (
      jobName: string,
      data: unknown,
      opts?: Parameters<Queue['add']>[2]
    ) => getQueue().add(jobName, data, opts),
    waitUntilReady: () => getQueue().waitUntilReady(),
  };
}
