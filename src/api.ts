import {
  fastify as Fastify,
  FastifyHttpOptions,
  FastifyInstance,
  LogController,
} from 'fastify';
import SECURITY_CONFIG from './config/security.json';
import LOGGING_CONFIG from './config/logging.json';
import router from './router';
import logger from './sources/logger';
import { closeQueues } from './sources/queues/createQueue';

const isProduction = process.env.NODE_ENV === 'production';
const isQA = process.env.NODE_ENV === 'qa';
const importDotenv = !isProduction && !isQA;
if (importDotenv) {
  const dotenv = require('dotenv');
  dotenv.config({ quiet: true });
}

export default async function build() {
  const options: FastifyHttpOptions<any> = {
    logger: LOGGING_CONFIG.loggerOptions,
    trustProxy: true,
  };
  if (LOGGING_CONFIG.disableRequestLogging) {
    options.logController = new LogController({
      disableRequestLogging: true,
    });
  }
  const fastify: FastifyInstance = Fastify(options);
  fastify.addHook('onRequest', (req, reply) => {
    if (LOGGING_CONFIG.logRequestStart) {
      const out = `request - ${req.method} ${req.routeOptions.url} #${req.id}`;
      logger.info(out);
    }
    return Promise.resolve();
  });
  fastify.addHook('onResponse', (req, res) => {
    const time = res.elapsedTime.toFixed(2);
    const out = `${res.statusCode} ${res.request.method} ${req.url} ${time}ms #${req.id}`;
    logger.info(out);
    return res;
  });
  fastify.register(require('@fastify/helmet'), SECURITY_CONFIG.helmet);
	fastify.register(require('@fastify/cors'), { origin: '*' });
  fastify.register(require('fastify-no-icon'));
  fastify.register(require('@fastify/formbody'));
  fastify.register(require('./sources/redis'));
  fastify.addHook('onClose', () => closeQueues());
  await router(fastify);
  return fastify;
}
