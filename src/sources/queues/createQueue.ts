import { Queue, QueueOptions } from 'bullmq';
import logger from '../logger';
import formatError from '../../lib/formatError';
import { getBullmqConnection } from '../redisConfig';

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
}

/** Producer options: fail fast when Redis is down (never hold HTTP requests open). */
export function buildQueueOptions(
  env: NodeJS.ProcessEnv = process.env
): QueueOptions {
  return {
    connection: getBullmqConnection(env),
    skipWaitingForReady: true,
  };
}

export default function createQueue(name: string) {
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
    add: (
      jobName: string,
      data: unknown,
      opts?: Parameters<Queue['add']>[2]
    ) => getQueue().add(jobName, data, opts),
  };
}
