import { jest } from '@jest/globals';
import build from '../../../api';
import * as pushToHeartbeatQueue from '../../../services/views/pushToHeartbeatQueue';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

describe('GET /views/{viewId}/heartbeat', () => {
  const pushToHeartbeatQueueSpy = jest.spyOn(pushToHeartbeatQueue, 'default');
  const useragent =
    'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';

  test('should not track the heartbeat view if viewId is not valid', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/views/test/heartbeat',
      headers: {
        'User-Agent': useragent,
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToHeartbeatQueueSpy).not.toHaveBeenCalled();
  });

  test('should track the view heartbeat', async () => {
    pushToHeartbeatQueueSpy.mockImplementation(() => Promise.resolve(true));

    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const response = await api.inject({
      method: 'GET',
      url: '/views/12345678901234/heartbeat',
      headers: {
        'User-Agent': useragent,
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToHeartbeatQueueSpy).toHaveBeenCalled();
  });
});
