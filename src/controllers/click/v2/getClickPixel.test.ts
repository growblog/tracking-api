import build from '../../../api';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

describe('GET /v2/clicks/{blogId}', () => {
  test('should track the click', async () => {
    jest.mock('../../../services/clicks/pushToQueue', () => {
      return true;
    });
    const pushToQueue = require('../../../services/clicks/pushToQueue');
    const response = await api.inject({
      method: 'GET',
      url: '/v2/clicks/test?l=test&a=test',
      headers: {
        'User-Agent': 'test',
        Referer: 'test',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToQueue).toEqual(true);
  });

  test('should not track the click', async () => {
    jest.mock('../../../sources/queues/TrackingClickQueue', () => {
      return {
        add: jest.fn(() => false),
      };
    });
    const TrackingClickQueue = require('../../../sources/queues/TrackingClickQueue');
    const response = await api.inject({
      method: 'GET',
      url: '/v2/clicks/test',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(TrackingClickQueue.add).toHaveBeenCalledTimes(0);
  });
});
