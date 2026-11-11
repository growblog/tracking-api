jest.mock('./logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import logger from './logger';
import {
  getBullmqConnection,
  getNodeRedisConfig,
} from './redisConfig';

describe('redisConfig', () => {
  beforeEach(() => {
    jest.mocked(logger.error).mockClear();
  });

  test('uses REDIS_URL for the cache client and the queue connection', () => {
    const env = {
      REDIS_URL: 'rediss://default:s3cret@redis.example:25061/2',
      REDIS_HOST: 'ignored.example',
      REDIS_PASSWORD: 'ignored-password',
    };

    expect(getNodeRedisConfig(env)).toEqual({
      url: 'rediss://default:s3cret@redis.example:25061/2',
      disableOfflineQueue: true,
    });
    expect(getBullmqConnection(env)).toEqual({
      host: 'redis.example',
      port: 25061,
      username: 'default',
      password: 's3cret',
      db: 2,
      tls: {},
    });
  });

  test('accepts a protocol-relative REDIS_URL as redis without TLS', () => {
    const env = { REDIS_URL: '//127.0.0.1:6379' };

    expect(getNodeRedisConfig(env)).toEqual({
      url: 'redis://127.0.0.1:6379',
      disableOfflineQueue: true,
    });
    expect(getBullmqConnection(env)).toEqual({
      host: '127.0.0.1',
      port: 6379,
    });
  });

  test('uses host, port and password with TLS when REDIS_URL is absent', () => {
    const env = {
      REDIS_HOST: 'cache.internal',
      REDIS_PORT: '6380',
      REDIS_PASSWORD: 'test-password',
    };

    expect(getNodeRedisConfig(env)).toEqual({
      socket: {
        host: 'cache.internal',
        port: 6380,
        tls: true,
      },
      password: 'test-password',
      disableOfflineQueue: true,
    });
    expect(getBullmqConnection(env)).toEqual({
      host: 'cache.internal',
      port: 6380,
      password: 'test-password',
      tls: {},
    });
  });

  test('defaults to localhost:6379 without TLS', () => {
    expect(getNodeRedisConfig({})).toEqual({
      socket: {
        host: '127.0.0.1',
        port: 6379,
      },
      disableOfflineQueue: true,
    });
    expect(getBullmqConnection({})).toEqual({
      host: '127.0.0.1',
      port: 6379,
    });
  });

  test('does not turn on TLS for a redis:// URL just because REDIS_PASSWORD is set', () => {
    const connection = getBullmqConnection({
      REDIS_URL: 'redis://cache.example:6390',
      REDIS_HOST: 'other.example',
      REDIS_PASSWORD: 'should-not-apply',
    });

    expect(connection).toEqual({
      host: 'cache.example',
      port: 6390,
    });
  });

  test('falls back to host settings when REDIS_URL is not a redis URL', () => {
    const connection = getBullmqConnection({
      REDIS_URL: 'http://:s3cret@cache.example:6379',
      REDIS_HOST: 'cache.internal',
      REDIS_PORT: '6379',
    });

    expect(connection).toEqual({
      host: 'cache.internal',
      port: 6379,
    });
    const logged = jest.mocked(logger.error).mock.calls.flat().join(' ');
    expect(logged).toContain('REDIS_URL');
    expect(logged).not.toContain('s3cret');
  });
});
