import TrackingErrorQueue from '../../sources/queues/TrackingErrorQueue';
import enqueueWithRetry from '../../sources/queues/enqueueWithRetry';

export default async function pushToErrorQueue(input) {
  const item = {
    ...input,
    created: new Date(),
  };
  const jobId = `trackingError-${Date.now()}-${input.blogId}`;
  const options = {
    jobId,
    removeOnComplete: true,
    removeOnFail: 2,
  };
  return enqueueWithRetry(
    () => TrackingErrorQueue.add(`item-${jobId}`, item, options),
    {
      label: 'errors.pushToQueue',
      input,
    }
  );
}
