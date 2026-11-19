import TrackingViewHeartbeatQueue from '../../sources/queues/TrackingViewHeartbeatQueue';
import enqueueWithRetry from '../../sources/queues/enqueueWithRetry';

export default async function pushToHeartbeatQueue(input): Promise<any> {
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
  return enqueueWithRetry(
    () => TrackingViewHeartbeatQueue.add(jobId, item, options),
    {
      label: 'views.pushToHeartbeatQueue',
      input,
    }
  );
}
