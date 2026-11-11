import TrackingClickQueue from '../../sources/queues/TrackingClickQueue';
import logger from '../../sources/logger';
import formatError from '../../lib/formatError';

export default async function pushToQueue(input) {
  try {
    const item = {
      ...input,
      created: new Date(),
    };
    const jobId = `trackingClick-${Date.now()}-${input.blogId}`;
    const options = {
      jobId,
      removeOnComplete: true,
      removeOnFail: 2,
    };
    return await TrackingClickQueue.add(`item-${jobId}`, item, options);
  } catch (error: any) {
    logger.error(
      `clicks.pushToQueue(${JSON.stringify(input)}) ${formatError(error)}`
    );
  }
}
