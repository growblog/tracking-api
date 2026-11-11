import { client as cache } from './redis';
import logger from './logger';
import formatError from '../lib/formatError';

const CACHE_READ_TIMEOUT_MS = 2000;

export function readCache(key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Redis GET timed out for ${key}`));
    }, CACHE_READ_TIMEOUT_MS);
    try {
      cache.get(key, (err, value) => {
        clearTimeout(timer);
        if (err) {
          reject(err);
          return;
        }
        resolve(value ?? null);
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

export function writeCache(key: string, ttlSeconds: number, value: string): void {
  try {
    cache.setex(key, ttlSeconds, value, (err) => {
      if (err) {
        logger.error(`cache setex ${key} ${formatError(err)}`);
      }
    });
  } catch (error) {
    logger.error(`cache setex ${key} ${formatError(error)}`);
  }
}

export function parseCachedJson<T>(raw: string): T {
  let data: unknown = JSON.parse(raw);
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  return data as T;
}
