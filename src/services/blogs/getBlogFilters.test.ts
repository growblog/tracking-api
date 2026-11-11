const mockList = jest.fn();
const mockGet = jest.fn();
const mockSetEx = jest.fn();

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
    get: (key: string) => mockGet(key),
    setEx: (key: string, ttl: number, value: string) =>
      mockSetEx(key, ttl, value),
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
    mockSetEx.mockReset();
    jest.mocked(logger.error).mockClear();
  });

  test('rejects when postgres fails instead of hanging', async () => {
    mockGet.mockResolvedValue(null);
    mockList.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(getBlogFilters('blog-1')).rejects.toThrow('ECONNREFUSED');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
  });

  test('reads postgres when redis get fails and caches the list for five minutes', async () => {
    mockGet.mockRejectedValue(new Error('ECONNREFUSED'));
    mockList.mockResolvedValue([{ ip: '1.1.1.1' }]);
    mockSetEx.mockResolvedValue('OK');

    await expect(getBlogFilters('blog-1')).resolves.toEqual(['1.1.1.1']);
    expect(mockSetEx).toHaveBeenCalledWith(
      'blog:blog-1:ip_filters',
      300,
      JSON.stringify(['1.1.1.1'])
    );
  });

  test('returns a cached ip list without querying postgres', async () => {
    mockGet.mockResolvedValue(JSON.stringify(['9.9.9.9']));

    await expect(getBlogFilters('blog-1')).resolves.toEqual(['9.9.9.9']);
    expect(mockList).not.toHaveBeenCalled();
  });
});
