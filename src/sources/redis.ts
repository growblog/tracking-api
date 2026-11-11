import redis from 'redis';
import { FastifyInstance } from 'fastify';
import logger from './logger';
import formatError from '../lib/formatError';
import { getNodeRedisConfig } from './redisConfig';

export let client: redis.RedisClient;

export default async function (fastify: FastifyInstance): Promise<boolean> {
  client = redis.createClient(getNodeRedisConfig());
  client.on('error', (error) => {
    logger.error(`Redis client ${formatError(error)}`);
  });
  client.on('ready', () => {
    fastify.log.info('Redis is ready ✅');

    client.set('testing', 'reading');
    client.expire('testing', 10);
    client.get('testing', () => {
      fastify.log.info('Redis test is OK ✅');
    });
  });
  fastify.addHook('onClose', (_instance, done) => {
    client.quit((error) => {
      if (error) {
        logger.error(`Redis client quit ${formatError(error)}`);
      }
      done();
    });
  });
  return true;
}
