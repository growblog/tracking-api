const mockHandlers: Record<string, (error?: Error) => void> = {};
const mockClient = {
  on: (event: string, callback: (error?: Error) => void) => {
    mockHandlers[event] = callback;
    return mockClient;
  },
  connect: jest.fn(async () => undefined),
  set: jest.fn(async () => 'OK'),
  get: jest.fn(async () => 'reading'),
  quit: jest.fn(async () => 'OK'),
  isOpen: true,
};

jest.mock('redis', () => ({
  __esModule: true,
  createClient: jest.fn(() => mockClient),
}));

jest.mock('./logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { createClient } from 'redis';
import logger from './logger';
import plugin from './redis';
import { REDIS_CONNECT_TIMEOUT_MS } from './redisConfig';

describe('redis client', () => {
  beforeEach(() => {
    mockClient.connect.mockReset();
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.set.mockClear();
    mockClient.get.mockClear();
    jest.mocked(logger.error).mockClear();
  });

  test('logs a connection error and keeps the process alive', async () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const fastify = {
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
      addHook: jest.fn(),
    };

    await plugin(fastify as never);
    expect(() => {
      mockHandlers.error(new Error('ECONNREFUSED'));
    }).not.toThrow();

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        disableOfflineQueue: true,
        socket: expect.objectContaining({
          connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        }),
      })
    );
    expect(mockClient.connect).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('starts in degraded mode when Redis connect fails', async () => {
    mockClient.connect.mockRejectedValueOnce(new Error('ENOTFOUND redis-host'));
    const fastify = {
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
      addHook: jest.fn(),
    };

    await expect(plugin(fastify as never)).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ENOTFOUND redis-host')
    );
    expect(fastify.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('degraded mode')
    );
    expect(mockClient.set).not.toHaveBeenCalled();
  });

  test('does not block indefinitely when Redis connect never resolves', async () => {
    jest.useFakeTimers();
    try {
      mockClient.connect.mockImplementation(() => new Promise(() => undefined));
      const fastify = {
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
        },
        addHook: jest.fn(),
      };

      const started = plugin(fastify as never);
      await jest.advanceTimersByTimeAsync(REDIS_CONNECT_TIMEOUT_MS);
      await expect(started).resolves.toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('timed out')
      );
      expect(fastify.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('degraded mode')
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

