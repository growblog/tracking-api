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

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ disableOfflineQueue: true })
    );
    expect(mockClient.connect).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
