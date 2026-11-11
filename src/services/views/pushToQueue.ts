import TrackingViewQueue from '../../sources/queues/TrackingViewQueue';
import logger from '../../sources/logger';
import formatError from '../../lib/formatError';

export default async function pushToQueue(input): Promise<any> {
  try {
    const item = {
      ...input,
      created: new Date(),
    };
    const jobId = `trackingView_${input.blogId}_${input.viewId}_${Date.now()}`;
    const options = {
      jobId,
      removeOnComplete: true,
      removeOnFail: 2,
    };
    return await TrackingViewQueue.add(jobId, item, options);
  } catch (error: any) {
    logger.error(
      `views.pushToQueue(${JSON.stringify(input)}) ${formatError(error)}`
    );
  }
}
