import { createClient, RedisClientType } from 'redis';
import { FastifyInstance } from 'fastify';
import logger from './logger';
import formatError from '../lib/formatError';
import { getNodeRedisConfig } from './redisConfig';

export let client: RedisClientType;

export default async function (fastify: FastifyInstance): Promise<boolean> {
  client = createClient(getNodeRedisConfig());
  client.on('error', (error) => {
    logger.error(`Redis client ${formatError(error)}`);
  });
  client.on('ready', () => {
    fastify.log.info('Redis is ready ✅');
  });

  try {
    await client.connect();
    await client.set('testing', 'reading', { EX: 10 });
    await client.get('testing');
    fastify.log.info('Redis test is OK ✅');
  } catch (error) {
    logger.error(`Redis connect ${formatError(error)}`);
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
