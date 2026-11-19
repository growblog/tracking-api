import TrackingClickQueue from '../../sources/queues/TrackingClickQueue';
import enqueueWithRetry from '../../sources/queues/enqueueWithRetry';

export default async function pushToQueue(input) {
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
  return enqueueWithRetry(
    () => TrackingClickQueue.add(`item-${jobId}`, item, options),
    {
      label: 'clicks.pushToQueue',
      input,
    }
  );
}
