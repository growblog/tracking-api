import { createClient, RedisClientType } from 'redis';
import { FastifyInstance } from 'fastify';
import logger from './logger';
import formatError from '../lib/formatError';
import {
  getNodeRedisConfig,
  REDIS_CONNECT_TIMEOUT_MS,
} from './redisConfig';

export let client: RedisClientType;

/**
 * Redis is optional for request serving: cache reads already fall back to
 * Postgres. Prefer degraded startup over failing the whole process when Redis
 * is unreachable — but never block indefinitely waiting for connect.
 */
export default async function (fastify: FastifyInstance): Promise<boolean> {
  client = createClient(getNodeRedisConfig());
  client.on('error', (error) => {
    logger.error(`Redis client ${formatError(error)}`);
  });
  client.on('ready', () => {
    fastify.log.info('Redis is ready ✅');
  });

  try {
    await connectWithTimeout(client);
    await client.set('testing', 'reading', { EX: 10 });
    await client.get('testing');
    fastify.log.info('Redis test is OK ✅');
  } catch (error) {
    logger.error(`Redis connect ${formatError(error)}`);
    fastify.log.warn(
      'Redis unavailable at startup — continuing in degraded mode (cache falls back to Postgres)'
    );
  }

  fastify.addHook('onClose', async () => {
    try {
      if (client.isOpen) {
        await client.quit();
      }
    } catch (error) {
      logger.error(`Redis client quit ${formatError(error)}`);
    }
  });
  return true;
}

async function connectWithTimeout(redisClient: RedisClientType): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      redisClient.connect(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Redis connect timed out after ${REDIS_CONNECT_TIMEOUT_MS}ms`
            )
          );
        }, REDIS_CONNECT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
