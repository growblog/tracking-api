import { jest } from '@jest/globals';
import build from '../../../api';
import * as getBlogForVisits from '../../../services/blogs/getBlogForVisits';
import * as getBlogFilters from '../../../services/blogs/getBlogFilters';
import * as pushToNoscriptQueue from '../../../services/views/pushToNoscriptQueue';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

describe('GET /noscript/{blogId}/pixel.gif', () => {
  const getBlogForVisitsSpy = jest.spyOn(getBlogForVisits, 'default');
  const getBlogFiltersSpy = jest.spyOn(getBlogFilters, 'default');
  const pushToNoscriptQueueSpy = jest.spyOn(pushToNoscriptQueue, 'default');
  const useragent =
    'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';

  test('should not track the noscript view if missing path', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/noscript/test/pixel.gif',
      headers: {
        'User-Agent': useragent,
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToNoscriptQueueSpy).not.toHaveBeenCalled();
  });

  test('should not track the noscript view if useragent is a bot', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/noscript/test/pixel.gif',
      headers: {
        'User-Agent': 'Bot Test',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToNoscriptQueueSpy).not.toHaveBeenCalled();
  });

  test('should track the noscript view via pixel', async () => {
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true })
    );
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    pushToNoscriptQueueSpy.mockImplementation(() => Promise.resolve(true));

    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const response = await api.inject({
      method: 'GET',
      url: '/noscript/test/pixel.gif',
      headers: {
        'User-Agent': useragent,
        Referer: 'https://test.com/valid-url',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToNoscriptQueueSpy).toHaveBeenCalled();
  });
});
