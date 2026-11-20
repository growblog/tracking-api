import Redis from 'ioredis';
import { getBullmqConnection } from '../redisConfig';

let shared: Redis | null = null;

/**
 * Runtime reconnect backoff after the shared client is ready.
 * ElastiCache failover closes the socket; without this, tracking discards forever.
 */
export function bullmqRedisRetryStrategy(times: number): number {
  return Math.min(times * 200, 2_000);
}

/** Warmup-only: never schedule reconnects so a dead host fails the connect attempt. */
function failFastRetryStrategy(): null {
  return null;
}

/** Returns the warmed shared client, if connect+ping already succeeded. */
export function getSharedBullmqRedis(): Redis | null {
  if (shared && shared.status === 'ready') {
    return shared;
  }
  return null;
}

/**
 * Connect a shared ioredis client and verify it accepts writes.
 * Producer queues reuse this client so BullMQ's startup INFO does not race
 * enableOfflineQueue=false against a still-connecting socket.
 *
 * Warmup uses fail-fast retry; once ready, runtime reconnect is restored.
 */
export async function connectSharedBullmqRedis(
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<Redis> {
  if (shared) {
    if (shared.status === 'ready') {
      return shared;
    }
    if (isRecoverableStatus(shared.status)) {
      await waitUntilReady(shared, timeoutMs);
      return shared;
    }
    shared.disconnect();
    shared = null;
  }

  const options = getBullmqConnection(env);
  const client = new Redis({
    ...options,
    lazyConnect: true,
    retryStrategy: failFastRetryStrategy,
  });

  try {
    await withTimeout(client.connect(), timeoutMs, 'bullmq redis connect');
    await withTimeout(client.ping(), Math.min(2_000, timeoutMs), 'bullmq redis ping');
  } catch (error) {
    client.disconnect();
    throw error;
  }

  client.options.retryStrategy = bullmqRedisRetryStrategy;
  shared = client;
  return client;
}

export async function closeSharedBullmqRedis(): Promise<void> {
  if (!shared) {
    return;
  }
  const client = shared;
  shared = null;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

function isRecoverableStatus(status: string): boolean {
  return (
    status === 'connecting' ||
    status === 'connect' ||
    status === 'reconnecting' ||
    status === 'close'
  );
}

function waitUntilReady(client: Redis, timeoutMs: number): Promise<void> {
  if (client.status === 'ready') {
    return Promise.resolve();
  }
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onEnd = () => {
        cleanup();
        reject(new Error('bullmq redis ended before ready'));
      };
      const cleanup = () => {
        client.off('ready', onReady);
        client.off('end', onEnd);
      };
      client.on('ready', onReady);
      client.on('end', onEnd);
    }),
    timeoutMs,
    'bullmq redis ready'
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        if (timer) {
          clearTimeout(timer);
        }
        resolve(value);
      },
      (error) => {
        if (timer) {
          clearTimeout(timer);
        }
        reject(error);
      }
    );
  });
}
