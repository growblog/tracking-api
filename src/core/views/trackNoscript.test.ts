import { jest } from '@jest/globals';
import * as getBlogForVisits from '../../services/blogs/getBlogForVisits';
import * as getBlogFilters from '../../services/blogs/getBlogFilters';
import * as pushToNoscriptQueue from '../../services/views/pushToNoscriptQueue';
import trackNoscript from './trackNoscript';

describe('core/views/trackNoscript', () => {
  const getBlogForVisitsSpy = jest.spyOn(getBlogForVisits, 'default');
  const getBlogFiltersSpy = jest.spyOn(getBlogFilters, 'default');
  const pushToNoscriptQueueSpy = jest.spyOn(pushToNoscriptQueue, 'default');

  test('should not track the noscript view if missing blogId', async () => {
    const output = await trackNoscript(
      '',
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(output).toEqual(false);
  });

  test('should not track the noscript view if missing path', async () => {
    const output = await trackNoscript(
      'test',
      '',
      undefined,
      undefined,
      undefined
    );
    expect(output).toEqual(false);
  });

  test('should not track the noscript view if useragent is a bot', async () => {
    const output = await trackNoscript(
      'test',
      '/',
      'Bot Test',
      undefined,
      undefined
    );
    expect(output).toEqual(false);
  });

  test('should not track the noscript view if blog data is not valid', async () => {
    getBlogForVisitsSpy.mockReturnValue(Promise.resolve(null));
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const output = await trackNoscript(
      'test',
      '/',
      useragent,
      undefined,
      undefined
    );
    expect(output).toEqual(false);
  });

  test('should not track the noscript view if blog has not enabled client tracking', async () => {
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: false })
    );
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const output = await trackNoscript(
      'test',
      '/',
      useragent,
      undefined,
      undefined
    );
    expect(output).toEqual(false);
  });

  test('should not track the noscript view if blog is filtering the IP', async () => {
    const requestIp = '123.456.789.123';
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true })
    );
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([requestIp]));
    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const output = await trackNoscript(
      'test',
      '/',
      useragent,
      undefined,
      requestIp
    );
    expect(output).toEqual(false);
  });

  test('should not track the noscript view if it is a preview page', async () => {
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true })
    );
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const output = await trackNoscript(
      'test',
      '/p/12345',
      useragent,
      'es',
      undefined
    );
    expect(output).toEqual(false);
  });

  test('should track the noscript view', async () => {
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true })
    );
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    pushToNoscriptQueueSpy.mockImplementation(() => Promise.resolve(true));

    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const output = await trackNoscript(
      'test',
      '/valid-url',
      useragent,
      'es',
      undefined
    );
    expect(output).toEqual(true);
    expect(pushToNoscriptQueueSpy).toHaveBeenCalled();
  });

  test('should track the noscript view from the blog host', async () => {
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true, domain: 'example.com' })
    );
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    pushToNoscriptQueueSpy.mockImplementation(() => Promise.resolve(true));
    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const output = await trackNoscript(
      'test',
      'https://www.example.com/post',
      useragent,
      'es',
      undefined
    );
    expect(output).toEqual(true);
  });

  test('should not track the noscript view from another host', async () => {
    pushToNoscriptQueueSpy.mockClear();
    getBlogForVisitsSpy.mockReturnValue(
      Promise.resolve({ enableClient: true, domain: 'example.com' })
    );
    getBlogFiltersSpy.mockReturnValue(Promise.resolve([]));
    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const output = await trackNoscript(
      'test',
      'https://evilexample.com/post',
      useragent,
      'es',
      undefined
    );
    expect(output).toEqual(false);
    expect(pushToNoscriptQueueSpy).not.toHaveBeenCalled();
  });
});
