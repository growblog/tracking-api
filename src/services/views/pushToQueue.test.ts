jest.mock('../../sources/queues/TrackingViewQueue', () => ({
  __esModule: true,
  default: {
    add: jest.fn(),
  },
}));

jest.mock('../../sources/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import TrackingViewQueue from '../../sources/queues/TrackingViewQueue';
import logger from '../../sources/logger';
import {
  getDiscardedCount,
  resetDiscardedCounts,
} from '../../sources/queues/enqueueWithRetry';
import pushToQueue from './pushToQueue';

const sampleInput = {
  blogId: 'blog-1',
  viewId: 'view-1',
  referer: '',
  url: '/',
  country: 'ES',
  useragent: 'test',
  lang: 'en',
  body: {},
  visitorHash: 'hash',
};

describe('views.pushToQueue', () => {
  beforeEach(() => {
    jest.mocked(TrackingViewQueue.add).mockReset();
    jest.mocked(logger.error).mockClear();
    resetDiscardedCounts();
  });

  test('enqueues a tracking view job', async () => {
    jest.mocked(TrackingViewQueue.add).mockResolvedValue({ id: 'ok' } as never);

    await expect(pushToQueue(sampleInput)).resolves.toEqual({ id: 'ok' });
    expect(TrackingViewQueue.add).toHaveBeenCalledTimes(1);
    expect(TrackingViewQueue.add).toHaveBeenCalledWith(
      expect.stringMatching(/^trackingView_blog-1_view-1_/),
      expect.objectContaining({
        blogId: 'blog-1',
        viewId: 'view-1',
        created: expect.any(Date),
      }),
      expect.objectContaining({
        removeOnComplete: true,
        removeOnFail: 2,
      })
    );
    expect(getDiscardedCount('views.pushToQueue')).toBe(0);
  });

  test('retries briefly then succeeds when Redis recovers', async () => {
    jest
      .mocked(TrackingViewQueue.add)
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue({ id: 'recovered' } as never);

    await expect(pushToQueue(sampleInput)).resolves.toEqual({ id: 'recovered' });
    expect(TrackingViewQueue.add).toHaveBeenCalledTimes(2);
    expect(getDiscardedCount('views.pushToQueue')).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('returns quickly, logs, and counts when Redis stays down', async () => {
    jest
      .mocked(TrackingViewQueue.add)
      .mockRejectedValue(
        new Error(
          "Stream isn't writeable and enableOfflineQueue options is false"
        )
      );

    const startedAt = Date.now();
    await expect(pushToQueue(sampleInput)).resolves.toBeUndefined();
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(TrackingViewQueue.add).toHaveBeenCalledTimes(3);
    expect(getDiscardedCount('views.pushToQueue')).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('views.pushToQueue discarded=1')
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('enableOfflineQueue')
    );
  });
});
