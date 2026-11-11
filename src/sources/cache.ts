import { client as cache } from './redis';
import logger from './logger';
import formatError from '../lib/formatError';

const CACHE_READ_TIMEOUT_MS = 2000;

export async function readCache(key: string): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      cache.get(key),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Redis GET timed out for ${key}`));
        }, CACHE_READ_TIMEOUT_MS);
      }),
    ]);
    return value ?? null;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function writeCache(key: string, ttlSeconds: number, value: string): void {
  void cache.setEx(key, ttlSeconds, value).catch((error) => {
    logger.error(`cache setEx ${key} ${formatError(error)}`);
  });
}

export function parseCachedJson<T>(raw: string): T {
  let data: unknown = JSON.parse(raw);
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  return data as T;
}
