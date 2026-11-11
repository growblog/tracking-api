import { jest } from '@jest/globals';
import FormData from 'form-data';
import build from '../../../api';
import * as pushToHeartbeatQueue from '../../../services/views/pushToHeartbeatQueue';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

describe('POST /v3/views/{viewId}/heartbeat', () => {
  const pushToHeartbeatQueueSpy = jest.spyOn(pushToHeartbeatQueue, 'default');
  const useragent =
    'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';

  test('should not track the heartbeat if viewId is not valid', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/test/heartbeat',
      headers: {
        'User-Agent': useragent,
      },
      payload: {},
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToHeartbeatQueueSpy).not.toHaveBeenCalled();
  });

  test('should track the heartbeat', async () => {
    pushToHeartbeatQueueSpy.mockImplementation(() => Promise.resolve(true));

    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/12345678901234/heartbeat',
      headers: {
        'User-Agent': useragent,
      },
      payload: {
        A: '2',
        B: 'unload',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToHeartbeatQueueSpy).toHaveBeenCalled();
  });

  test('should track the heartbeat via beacon', async () => {
    pushToHeartbeatQueueSpy.mockImplementation(() => Promise.resolve(true));

    const useragent =
      'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion';
    const formData = new FormData();
    formData.append('A', '2');
    formData.append('B', 'unload');

    const body = formData.getBuffer();
    const response = await api.inject({
      method: 'POST',
      url: '/v3/views/12345678901234/heartbeat',
      headers: {
        'User-Agent': useragent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload: body,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToHeartbeatQueueSpy).toHaveBeenCalled();
  });
});
