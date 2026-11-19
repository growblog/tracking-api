const isProduction = process.env.NODE_ENV == 'production';

export default async function start() {
  let api;
  try {
    // New Relic must load before Fastify so instrumentation can wrap the framework.
    // A static `import './api'` would hoist Fastify's require() above this call.
    if (isProduction) {
      require('newrelic');
    }
    const build = require('./api').default;
    api = await build();
    const options = {
      port: process.env.PORT,
      host: '0.0.0.0',
    };
    await api.listen(options);
    api.log.info('Tracking API started successfully ✅');
    return api;
  } catch (err) {
    api?.log?.error(err) || console.error(err);
    process.exit(1);
  }
}

start();
