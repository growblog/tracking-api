jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import logger from '../logger';
import enqueueWithRetry, {
  DEFAULT_MAX_ATTEMPTS,
  getDiscardedCount,
  resetDiscardedCounts,
} from './enqueueWithRetry';

describe('enqueueWithRetry', () => {
  const sleep = jest.fn(async () => undefined);

  beforeEach(() => {
    resetDiscardedCounts();
    sleep.mockClear();
    jest.mocked(logger.error).mockClear();
  });

  test('returns the enqueue result on first success', async () => {
    const enqueue = jest.fn().mockResolvedValue({ id: 'job-1' });

    await expect(
      enqueueWithRetry(enqueue, {
        label: 'views.pushToQueue',
        input: { blogId: 'b1' },
        sleep,
      })
    ).resolves.toEqual({ id: 'job-1' });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(getDiscardedCount('views.pushToQueue')).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('retries briefly and succeeds without discarding', async () => {
    const enqueue = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue({ id: 'job-2' });

    await expect(
      enqueueWithRetry(enqueue, {
        label: 'views.pushToQueue',
        input: { blogId: 'b1' },
        retryDelayMs: 10,
        sleep,
      })
    ).resolves.toEqual({ id: 'job-2' });

    expect(enqueue).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
    expect(getDiscardedCount('views.pushToQueue')).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('increments discard counter and logs after all attempts fail', async () => {
    const enqueue = jest
      .fn()
      .mockRejectedValue(
        new Error("Stream isn't writeable and enableOfflineQueue options is false")
      );

    await expect(
      enqueueWithRetry(enqueue, {
        label: 'views.pushToQueue',
        input: { blogId: 'b1', viewId: 'v1' },
        sleep,
      })
    ).resolves.toBeUndefined();

    expect(enqueue).toHaveBeenCalledTimes(DEFAULT_MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(DEFAULT_MAX_ATTEMPTS - 1);
    expect(getDiscardedCount('views.pushToQueue')).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(
        /views\.pushToQueue discarded=1 attempts=3 input=.*"blogId":"b1".*enableOfflineQueue/
      )
    );

    await enqueueWithRetry(enqueue, {
      label: 'views.pushToQueue',
      input: { blogId: 'b1' },
      sleep,
    });
    expect(getDiscardedCount('views.pushToQueue')).toBe(2);
  });

  test('keeps discard counters independent per label', async () => {
    const enqueue = jest.fn().mockRejectedValue(new Error('down'));

    await enqueueWithRetry(enqueue, {
      label: 'views.pushToQueue',
      input: {},
      maxAttempts: 1,
      sleep,
    });
    await enqueueWithRetry(enqueue, {
      label: 'clicks.pushToQueue',
      input: {},
      maxAttempts: 1,
      sleep,
    });

    expect(getDiscardedCount('views.pushToQueue')).toBe(1);
    expect(getDiscardedCount('clicks.pushToQueue')).toBe(1);
  });
});
