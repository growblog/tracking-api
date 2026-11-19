import TrackingNoscriptViewQueue from '../../sources/queues/TrackingNoscriptViewQueue';
import enqueueWithRetry from '../../sources/queues/enqueueWithRetry';

export default async function pushToNoscriptQueue(input): Promise<any> {
  const item = {
    ...input,
    created: new Date(),
  };
  const randomNumber = Math.floor(Math.random() * 1000);
  const jobId = `trackingNoscript_${input.blogId}_${Date.now()}_${randomNumber}`;
  const options = {
    jobId,
    removeOnComplete: true,
    removeOnFail: 2,
  };
  return enqueueWithRetry(
    () => TrackingNoscriptViewQueue.add(jobId, item, options),
    {
      label: 'views.pushToNoscriptQueue',
      input,
    }
  );
}
