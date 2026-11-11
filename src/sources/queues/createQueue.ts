import { Queue } from 'bullmq';
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
    })
  );
}

export default function createQueue(name: string) {
  let queue: Queue | undefined;

  function getQueue(): Queue {
    if (!queue) {
      queue = new Queue(name, {
        connection: getBullmqConnection(),
      });
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
