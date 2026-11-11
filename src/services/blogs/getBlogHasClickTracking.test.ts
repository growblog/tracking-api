const mockFirst = jest.fn();
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
      first: () => mockFirst(),
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
import getBlogHasClickTracking from './getBlogHasClickTracking';

describe('getBlogHasClickTracking', () => {
  beforeEach(() => {
    mockFirst.mockReset();
    mockGet.mockReset();
    mockSetex.mockReset();
    jest.mocked(logger.error).mockClear();
  });

  test('rejects when postgres fails instead of hanging', async () => {
    mockGet.mockImplementation((_key, callback) => {
      callback(null, undefined);
    });
    mockFirst.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(getBlogHasClickTracking('blog-1')).rejects.toThrow(
      'ECONNREFUSED'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('getBlogHasClickTracking(blog-1)')
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
  });

  test('returns a cached flag without querying postgres', async () => {
    mockGet.mockImplementation((_key, callback) => {
      callback(null, JSON.stringify(false));
    });

    await expect(getBlogHasClickTracking('blog-1')).resolves.toBe(false);
    expect(mockFirst).not.toHaveBeenCalled();
  });

  test('returns false when the user has no plan', async () => {
    mockGet.mockImplementation((_key, callback) => {
      callback(null, undefined);
    });
    mockFirst
      .mockResolvedValueOnce({ user: 'user-1', firstVisit: null })
      .mockResolvedValueOnce({ trialDays: 14, plan: null });

    await expect(getBlogHasClickTracking('blog-1')).resolves.toBe(false);
    expect(mockSetex).not.toHaveBeenCalled();
  });

  test('caches click tracking for two minutes', async () => {
    mockGet.mockImplementation((_key, callback) => {
      callback(null, undefined);
    });
    mockFirst
      .mockResolvedValueOnce({ user: 'user-1', firstVisit: '2000-01-01' })
      .mockResolvedValueOnce({ trialDays: 0, plan: 'plan-1' })
      .mockResolvedValueOnce({ hasClicks: true });

    await expect(getBlogHasClickTracking('blog-1')).resolves.toBe(true);
    expect(mockSetex).toHaveBeenCalledWith(
      'blog:blog-1:hasClickTracking',
      120,
      JSON.stringify(true),
      expect.any(Function)
    );
  });
});
