import { jest } from '@jest/globals';
import build from '../../../api';
import logger from '../../../sources/logger';
import * as pushToQueue from '../../../services/views/pushToQueue';
import * as getBlogForVisits from '../../../services/blogs/getBlogForVisits';
import * as getBlogFilters from '../../../services/blogs/getBlogFilters';
import * as getBlogHasClickTracking from '../../../services/blogs/getBlogHasClickTracking';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

describe('POST /v3/views/{blogId}', () => {
  const getBlogForVisitsSpy = jest.spyOn(getBlogForVisits, 'default');
  const getBlogFiltersSpy = jest.spyOn(getBlogFilters, 'default');
  const getBlogHasClickTrackingSpy = jest.spyOn(
    getBlogHasClickTracking,
    'default'
  );
  const pushToQueueSpy = jest.spyOn(pushToQueue, 'default');
  const useragent =
    'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';

  test('should not track the view if missing blogId', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/',
      headers: {
        'User-Agent': useragent,
      },
      payload: {},
    });
    expect(response.statusCode).toEqual(401);
    expect(response.body).toEqual('INVALID_BLOG_ID');
    expect(pushToQueueSpy).not.toHaveBeenCalled();
  });

  test('should not track the view if the useragent is a bot', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': 'bot test',
      },
      payload: {},
    });
    expect(response.statusCode).toEqual(202);
    expect(response.body).toEqual('USERAGENT_IS_BOT');
    expect(pushToQueueSpy).not.toHaveBeenCalled();
  });

  test('should not track the view if the blog is not found', async () => {
    getBlogForVisitsSpy.mockReturnValue(Promise.resolve(false));
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    getBlogHasClickTrackingSpy.mockReturnValue(Promise.resolve(false));
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': useragent,
      },
      payload: {},
    });
    expect(response.statusCode).toEqual(404);
    expect(response.body).toEqual('BLOG_NOT_FOUND');
    expect(pushToQueueSpy).not.toHaveBeenCalled();
  });

  test('should not track the view if it is a post preview', async () => {
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true })
    );
    getBlogHasClickTrackingSpy.mockReturnValue(Promise.resolve(false));
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': useragent,
      },
      payload: {
        U: 'http://test.com/p/preview-123',
      },
    });
    expect(response.statusCode).toEqual(202);
    expect(response.body).toEqual('IS_PREVIEW');
    expect(pushToQueueSpy).not.toHaveBeenCalled();
  });

  test('should not track the view if the user IP is blocked', async () => {
    const requestIp = '12.34.56.78';
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([requestIp]));
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true, domain: 'test.com' })
    );
    getBlogHasClickTrackingSpy.mockReturnValue(Promise.resolve(false));
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': useragent,
        'X-Forwarded-For': requestIp,
        Referer: 'http://test.com',
      },
      payload: {
        U: 'http://test.com/cool-post',
      },
    });
    expect(response.statusCode).toEqual(202);
    expect(response.body).toEqual('BLOCKED_IP');
    expect(pushToQueueSpy).not.toHaveBeenCalled();
  });

  test('should not track the view if the blog is inactive', async () => {
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: false })
    );
    getBlogHasClickTrackingSpy.mockReturnValue(Promise.resolve(false));
    const requestIp = '12.34.56.78';
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': useragent,
        'X-Forwarded-For': requestIp,
        Referer: 'http://test.com',
      },
      payload: {
        U: 'http://test.com/cool-post',
      },
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body).toEqual('INACTIVE_BLOG');
    expect(pushToQueueSpy).not.toHaveBeenCalled();
  });

  test('should not track the view if it is a different domain', async () => {
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true, domain: 'test.com' })
    );
    getBlogHasClickTrackingSpy.mockReturnValue(Promise.resolve(false));
    const requestIp = '12.34.56.78';
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': useragent,
        'X-Forwarded-For': requestIp,
        Referer: 'http://invalid.com',
      },
      payload: {
        U: 'http://test.com/cool-post',
      },
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body).toEqual('INVALID_REFERER');
    expect(pushToQueueSpy).not.toHaveBeenCalled();
  });

  test('should track the view and include click tracking', async () => {
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true, domain: 'test.com' })
    );
    getBlogHasClickTrackingSpy.mockReturnValue(Promise.resolve(true));
    pushToQueueSpy.mockImplementation(() => Promise.resolve(true));
    const requestIp = '12.34.56.78';
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': useragent,
        'X-Forwarded-For': requestIp,
        Referer: 'http://test.com',
      },
      payload: {
        U: 'http://test.com/',
      },
    });
    expect(response.statusCode).toEqual(200);
    const output = JSON.parse(response.body);
    expect(output).toHaveProperty('id');
    expect(output).toHaveProperty('tc');
    expect(output.tc).toEqual(1);
    expect(pushToQueueSpy).toHaveBeenCalled();
  });

  test('returns 500 without the driver error when postgres fails', async () => {
    const errorSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => logger);
    getBlogForVisitsSpy.mockRejectedValue(
      new Error('connect ECONNREFUSED user=secret')
    );
    getBlogFiltersSpy.mockResolvedValue([]);
    getBlogHasClickTrackingSpy.mockResolvedValue(false);
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test',
      headers: {
        'User-Agent': useragent,
        Referer: 'https://example.com',
      },
      payload: {},
    });
    expect(response.statusCode).toEqual(500);
    expect(response.body).toEqual('Internal Server Error');
    expect(response.body).not.toContain('secret');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
