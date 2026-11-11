const mockHandlers: Record<string, (error?: Error) => void> = {};
const mockClient = {
  on: (event: string, callback: (error?: Error) => void) => {
    mockHandlers[event] = callback;
    return mockClient;
  },
  set: jest.fn(),
  expire: jest.fn(),
  get: jest.fn(),
};

jest.mock('redis', () => ({
  __esModule: true,
  default: {
    createClient: jest.fn(() => mockClient),
  },
}));

jest.mock('./logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import redis from 'redis';
import logger from './logger';
import plugin from './redis';

describe('redis client', () => {
  test('logs a connection error and keeps the process alive', async () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const fastify = {
      log: {
        info: jest.fn(),
        error: jest.fn(),
      },
      addHook: jest.fn(),
    };

    await plugin(fastify as never);
    expect(() => {
      mockHandlers.error(new Error('ECONNREFUSED'));
    }).not.toThrow();

    expect(redis.createClient).toHaveBeenCalledWith(
      expect.objectContaining({ enable_offline_queue: false })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
