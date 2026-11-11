const mockList = jest.fn();
const mockGet = jest.fn();
const mockSetex = jest.fn();

jest.mock('../../sources/postgres', () => ({
  __esModule: true,
  default: () => {
    const query = {
      select: () => query,
      where: () => query,
      orWhere: () => query,
      whereNull: () => query,
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(mockList()).then(onFulfilled, onRejected),
    };
    return query;
  },
}));

jest.mock('../../sources/redis', () => ({
  __esModule: true,
  client: {
    get: (key: string, callback: (err: Error | null, value?: string) => void) =>
      mockGet(key, callback),
    setex: (
      key: string,
      ttl: number,
      value: string,
      callback?: (err: Error | null) => void
    ) => mockSetex(key, ttl, value, callback),
  },
}));

jest.mock('../../sources/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import logger from '../../sources/logger';
import getBlogFilters from './getBlogFilters';

describe('getBlogFilters', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockGet.mockReset();
    mockSetex.mockReset();
    jest.mocked(logger.error).mockClear();
  });

  test('rejects when postgres fails instead of hanging', async () => {
    mockGet.mockImplementation((_key, callback) => {
      callback(null, undefined);
    });
    mockList.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(getBlogFilters('blog-1')).rejects.toThrow('ECONNREFUSED');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
  });

  test('reads postgres when redis get fails and caches the list for five minutes', async () => {
    mockGet.mockImplementation((_key, callback) => {
      callback(new Error('ECONNREFUSED'));
    });
    mockList.mockResolvedValue([{ ip: '1.1.1.1' }]);

    await expect(getBlogFilters('blog-1')).resolves.toEqual(['1.1.1.1']);
    expect(mockSetex).toHaveBeenCalledWith(
      'blog:blog-1:ip_filters',
      300,
      JSON.stringify(['1.1.1.1']),
      expect.any(Function)
    );
  });

  test('returns a cached ip list without querying postgres', async () => {
    mockGet.mockImplementation((_key, callback) => {
      callback(null, JSON.stringify(['9.9.9.9']));
    });

    await expect(getBlogFilters('blog-1')).resolves.toEqual(['9.9.9.9']);
    expect(mockList).not.toHaveBeenCalled();
  });
});
