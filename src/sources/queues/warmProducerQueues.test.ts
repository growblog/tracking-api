jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import logger from '../logger';
import type { ProducerQueue } from './createQueue';
import warmProducerQueues, {
  QUEUE_WARMUP_TIMEOUT_MS,
} from './warmProducerQueues';

describe('warmProducerQueues', () => {
  const connectRedis = jest.fn(async () => undefined);

  beforeEach(() => {
    connectRedis.mockClear();
    connectRedis.mockResolvedValue(undefined);
    jest.mocked(logger.error).mockClear();
    jest.mocked(logger.info).mockClear();
  });

  test('connects Redis then waits for every producer queue', async () => {
    const queues = [
      mockQueue('TrackingViewQueue', async () => undefined),
      mockQueue('TrackingClickQueue', async () => undefined),
    ];

    await expect(
      warmProducerQueues({ queues, connectRedis })
    ).resolves.toEqual({
      ready: true,
      failed: [],
    });
    expect(connectRedis).toHaveBeenCalledWith(QUEUE_WARMUP_TIMEOUT_MS);
    expect(logger.info).toHaveBeenCalledWith('Producer queues ready ✅');
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('returns degraded when Redis connect fails before queue warmup', async () => {
    connectRedis.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      warmProducerQueues({
        queues: [mockQueue('TrackingViewQueue', async () => undefined)],
        connectRedis,
      })
    ).resolves.toEqual({
      ready: false,
      failed: ['redis'],
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Producer queue redis warmup')
    );
  });

  test('returns degraded when a queue warmup rejects', async () => {
    const queues = [
      mockQueue('TrackingViewQueue', async () => undefined),
      mockQueue('TrackingClickQueue', async () => {
        throw new Error("Stream isn't writeable");
      }),
    ];

    await expect(
      warmProducerQueues({ queues, connectRedis })
    ).resolves.toEqual({
      ready: false,
      failed: ['TrackingClickQueue'],
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('TrackingClickQueue warmup')
    );
  });

  test('times out a hung waitUntilReady without hanging startup', async () => {
    const queues = [
      mockQueue(
        'TrackingViewQueue',
        () => new Promise(() => undefined) // never resolves
      ),
    ];

    const startedAt = Date.now();
    await expect(
      warmProducerQueues({ queues, connectRedis, timeoutMs: 50 })
    ).resolves.toEqual({
      ready: false,
      failed: ['TrackingViewQueue'],
    });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('timed out after')
    );
  });

  test('exposes a bounded default warmup timeout', () => {
    expect(QUEUE_WARMUP_TIMEOUT_MS).toBe(10_000);
  });
});

function mockQueue(
  name: string,
  waitUntilReady: () => Promise<void>
): ProducerQueue {
  return {
    name,
    add: jest.fn(),
    waitUntilReady,
  };
}
