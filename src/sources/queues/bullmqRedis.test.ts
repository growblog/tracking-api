import {
  closeSharedBullmqRedis,
  connectSharedBullmqRedis,
  getSharedBullmqRedis,
} from './bullmqRedis';

describe('bullmqRedis', () => {
  const previousHost = process.env.REDIS_HOST;
  const previousPort = process.env.REDIS_PORT;
  const previousUrl = process.env.REDIS_URL;

  afterEach(async () => {
    await closeSharedBullmqRedis();
    restoreEnv('REDIS_HOST', previousHost);
    restoreEnv('REDIS_PORT', previousPort);
    restoreEnv('REDIS_URL', previousUrl);
  });

  test('connects, pings, and reuses a ready shared client', async () => {
    delete process.env.REDIS_URL;
    // Use whatever Redis the local test suite already relies on.
    const client = await connectSharedBullmqRedis(5_000);
    expect(client.status).toBe('ready');
    expect(getSharedBullmqRedis()).toBe(client);

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
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
