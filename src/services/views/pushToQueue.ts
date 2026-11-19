import TrackingViewQueue from '../../sources/queues/TrackingViewQueue';
import enqueueWithRetry from '../../sources/queues/enqueueWithRetry';

export default async function pushToQueue(input): Promise<any> {
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
  return enqueueWithRetry(() => TrackingViewQueue.add(jobId, item, options), {
    label: 'views.pushToQueue',
    input,
  });
}
