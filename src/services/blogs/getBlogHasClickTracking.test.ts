const mockFirst = jest.fn();
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
      first: () => mockFirst(),
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
import getBlogHasClickTracking from './getBlogHasClickTracking';

describe('getBlogHasClickTracking', () => {
  beforeEach(() => {
    mockFirst.mockReset();
    mockGet.mockReset();
    mockSetEx.mockReset();
    jest.mocked(logger.error).mockClear();
  });

  test('rejects when postgres fails instead of hanging', async () => {
    mockGet.mockResolvedValue(null);
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
    mockGet.mockResolvedValue(JSON.stringify(false));

    await expect(getBlogHasClickTracking('blog-1')).resolves.toBe(false);
    expect(mockFirst).not.toHaveBeenCalled();
  });

  test('returns false when the user has no plan', async () => {
    mockGet.mockResolvedValue(null);
    mockFirst
      .mockResolvedValueOnce({ user: 'user-1', firstVisit: null })
      .mockResolvedValueOnce({ trialDays: 14, plan: null });

    await expect(getBlogHasClickTracking('blog-1')).resolves.toBe(false);
    expect(mockSetEx).not.toHaveBeenCalled();
  });

  test('caches click tracking for two minutes', async () => {
    mockGet.mockResolvedValue(null);
    mockFirst
      .mockResolvedValueOnce({ user: 'user-1', firstVisit: '2000-01-01' })
      .mockResolvedValueOnce({ trialDays: 0, plan: 'plan-1' })
      .mockResolvedValueOnce({ hasClicks: true });
    mockSetEx.mockResolvedValue('OK');

    await expect(getBlogHasClickTracking('blog-1')).resolves.toBe(true);
    expect(mockSetEx).toHaveBeenCalledWith(
      'blog:blog-1:hasClickTracking',
      120,
      JSON.stringify(true)
    );
  });
});
