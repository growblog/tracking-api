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
import getBlogForVisits from './getBlogForVisits';

describe('getBlogForVisits', () => {
  beforeEach(() => {
    mockFirst.mockReset();
    mockGet.mockReset();
    mockSetEx.mockReset();
    jest.mocked(logger.error).mockClear();
  });

  test('rejects when postgres fails instead of hanging', async () => {
    mockGet.mockResolvedValue(null);
    mockFirst.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(getBlogForVisits('blog-1')).rejects.toThrow('ECONNREFUSED');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
  });

  test('reads postgres when redis get fails', async () => {
    mockGet.mockRejectedValue(new Error('Redis connection is closed'));
    mockFirst.mockResolvedValue({
      id: 'blog-1',
      domain: 'example.com',
      firstVisit: null,
    });

    await expect(getBlogForVisits('blog-1')).resolves.toMatchObject({
      id: 'blog-1',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Redis connection is closed')
    );
    expect(mockSetEx).not.toHaveBeenCalled();
  });

  test('does not hang when redis never replies', async () => {
    jest.useFakeTimers();
    mockGet.mockImplementation(() => new Promise(() => undefined));
    mockFirst.mockResolvedValue({
      id: 'blog-1',
      firstVisit: null,
    });

    const pending = getBlogForVisits('blog-1');
    try {
      await jest.advanceTimersByTimeAsync(2000);
      await expect(pending).resolves.toMatchObject({ id: 'blog-1' });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('timed out')
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test('returns a cached blog and keeps the two minute ttl on write', async () => {
    mockGet.mockResolvedValue(
      JSON.stringify({ id: 'blog-1', domain: 'example.com' })
    );

    await expect(getBlogForVisits('blog-1')).resolves.toMatchObject({
      id: 'blog-1',
    });
    expect(mockFirst).not.toHaveBeenCalled();

    mockGet.mockResolvedValue(null);
    mockFirst.mockResolvedValue({
      id: 'blog-1',
      firstVisit: '2020-01-01',
    });
    mockSetEx.mockResolvedValue('OK');
    await getBlogForVisits('blog-1');
    expect(mockSetEx).toHaveBeenCalledWith(
      'blog:blog-1:for_visits',
      120,
      expect.any(String)
    );
  });

  test('reads a double-encoded cache value and falls through when it is corrupt', async () => {
    mockGet.mockResolvedValue(
      JSON.stringify(JSON.stringify({ id: 'blog-1', domain: 'example.com' }))
    );
    await expect(getBlogForVisits('blog-1')).resolves.toMatchObject({
      id: 'blog-1',
    });

    mockGet.mockResolvedValue('{not-json');
    mockFirst.mockResolvedValue({ id: 'blog-2', firstVisit: null });
    await expect(getBlogForVisits('blog-1')).resolves.toMatchObject({
      id: 'blog-2',
    });
  });
});
