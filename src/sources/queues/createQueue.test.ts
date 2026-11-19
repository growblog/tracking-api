import createQueue, {
  buildQueueOptions,
  closeQueues,
} from './createQueue';

describe('createQueue', () => {
  const previousHost = process.env.REDIS_HOST;
  const previousPort = process.env.REDIS_PORT;
  const previousUrl = process.env.REDIS_URL;

  afterEach(async () => {
    await closeQueues();
    restoreEnv('REDIS_HOST', previousHost);
    restoreEnv('REDIS_PORT', previousPort);
    restoreEnv('REDIS_URL', previousUrl);
  });

  test('buildQueueOptions disables the offline queue and skips waiting for ready', () => {
    const options = buildQueueOptions({
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '6379',
    });

    expect(options).toMatchObject({
      skipWaitingForReady: true,
      connection: {
        host: '127.0.0.1',
        port: 6379,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      },
    });
  });

  test('add rejects within a bounded time when Redis is down', async () => {
    delete process.env.REDIS_URL;
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '1';

    const queueApi = createQueue(`fail-fast-add-${Date.now()}`);
    const startedAt = Date.now();
    await expect(queueApi.add('job', { ok: false })).rejects.toBeDefined();
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
