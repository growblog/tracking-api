import Redis from 'ioredis';
import { getBullmqConnection } from '../redisConfig';

let shared: Redis | null = null;

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
 */
export async function connectSharedBullmqRedis(
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<Redis> {
  const existing = getSharedBullmqRedis();
  if (existing) {
    return existing;
  }

  if (shared) {
    shared.disconnect();
    shared = null;
  }

  const options = getBullmqConnection(env);
  const client = new Redis({
    ...options,
    lazyConnect: true,
    // Warmup owns reconnect policy; fail the connect attempt instead of hanging.
    retryStrategy: () => null,
  });

  try {
    await withTimeout(client.connect(), timeoutMs, 'bullmq redis connect');
    await withTimeout(client.ping(), Math.min(2_000, timeoutMs), 'bullmq redis ping');
  } catch (error) {
    client.disconnect();
    throw error;
  }

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
