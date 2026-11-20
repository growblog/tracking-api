import {
  bullmqRedisRetryStrategy,
  closeSharedBullmqRedis,
  connectSharedBullmqRedis,
  getSharedBullmqRedis,
} from './bullmqRedis';
import createQueue, { closeQueues } from './createQueue';

describe('bullmqRedis', () => {
  const previousHost = process.env.REDIS_HOST;
  const previousPort = process.env.REDIS_PORT;
  const previousUrl = process.env.REDIS_URL;

  afterEach(async () => {
    await closeQueues();
    await closeSharedBullmqRedis();
    restoreEnv('REDIS_HOST', previousHost);
    restoreEnv('REDIS_PORT', previousPort);
    restoreEnv('REDIS_URL', previousUrl);
  });

  test('bullmqRedisRetryStrategy uses capped linear backoff', () => {
    expect(bullmqRedisRetryStrategy(1)).toBe(200);
    expect(bullmqRedisRetryStrategy(5)).toBe(1_000);
    expect(bullmqRedisRetryStrategy(20)).toBe(2_000);
  });

  test('connects, pings, and reuses a ready shared client', async () => {
    delete process.env.REDIS_URL;
    // Use whatever Redis the local test suite already relies on.
    const client = await connectSharedBullmqRedis(5_000);
    expect(client.status).toBe('ready');
    expect(getSharedBullmqRedis()).toBe(client);
    expect(client.options.retryStrategy).toBe(bullmqRedisRetryStrategy);

    const again = await connectSharedBullmqRedis(5_000);
    expect(again).toBe(client);
  });

  test('fails within the timeout when Redis is unreachable', async () => {
    delete process.env.REDIS_URL;
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '1';

    const startedAt = Date.now();
    await expect(connectSharedBullmqRedis(500)).rejects.toBeDefined();
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(getSharedBullmqRedis()).toBeNull();
  });

  test('reconnects after unexpected close so Queue.add works again', async () => {
    delete process.env.REDIS_URL;
    const client = await connectSharedBullmqRedis(5_000);
    const queueApi = createQueue(`reconnect-add-${Date.now()}`);

    await expect(queueApi.add('job', { phase: 'before' })).resolves.toBeDefined();

    // Simulate ElastiCache/network drop (not quit/disconnect — those skip retry).
    await dropSocketAndAwaitReconnect(client, 10_000);
    await client.ping();

    expect(client.status).toBe('ready');
    expect(getSharedBullmqRedis()).toBe(client);
    await expect(queueApi.add('job', { phase: 'after' })).resolves.toBeDefined();
  });
});

type RedisEvents = {
  status: string;
  stream?: { destroy: () => void } | null;
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
};

/**
 * Destroy the TCP stream and wait for close → ready (ioredis status may still
 * read "ready" synchronously right after destroy).
 */
function dropSocketAndAwaitReconnect(
  client: RedisEvents,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let sawClose = false;
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `redis reconnect timed out after ${timeoutMs}ms (status=${client.status}, sawClose=${sawClose})`
        )
      );
    }, timeoutMs);

    const onClose = () => {
      sawClose = true;
    };
    const onReady = () => {
      if (!sawClose) {
        return;
      }
      cleanup();
      resolve();
    };
    const onEnd = () => {
      cleanup();
      reject(new Error('redis ended without reconnecting'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      client.off('close', onClose);
      client.off('ready', onReady);
      client.off('end', onEnd);
    };

    client.on('close', onClose);
    client.on('ready', onReady);
    client.on('end', onEnd);

    const stream = client.stream;
    if (!stream) {
      cleanup();
      reject(new Error('expected an open redis stream to destroy'));
      return;
    }
    stream.destroy();
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
