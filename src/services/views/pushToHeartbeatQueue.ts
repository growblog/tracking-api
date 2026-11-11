import TrackingViewHeartbeatQueue from '../../sources/queues/TrackingViewHeartbeatQueue';
import logger from '../../sources/logger';
import formatError from '../../lib/formatError';

export default async function pushToHeartbeatQueue(input): Promise<any> {
  try {
    const item = {
      ...input,
      created: new Date(),
    };
    const jobId = `trackingHeartbeat_${input.viewId}_${input.time}_${Date.now()}`;
    const options = {
      jobId,
      removeOnComplete: true,
      removeOnFail: 2,
    };
    return await TrackingViewHeartbeatQueue.add(jobId, item, options);
  } catch (error: any) {
    logger.error(
      `views.pushToHeartbeatQueue(${JSON.stringify(input)}) ${formatError(error)}`
    );
  }
}
