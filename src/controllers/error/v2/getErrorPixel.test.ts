import build from '../../../api';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

describe('GET /v2/blogs/{blogId}/errors', () => {
  test('should track the error', async () => {
    jest.mock('../../../services/errors/pushToQueue', () => {
      return true;
    });
    const pushToQueue = require('../../../services/errors/pushToQueue');
    const response = await api.inject({
      method: 'GET',
      url: '/v2/blogs/test/errors?l=test&e=test',
      headers: {
        'User-Agent': 'test',
        Referer: 'test',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(pushToQueue).toEqual(true);
  });

  test('should not track the error', async () => {
    jest.mock('../../../sources/queues/TrackingErrorQueue', () => {
      return {
        add: jest.fn(() => false),
      };
    });
    const TrackingErrorQueue = require('../../../sources/queues/TrackingErrorQueue');
    const response = await api.inject({
      method: 'GET',
      url: '/v2/blogs/test/errors',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
    expect(TrackingErrorQueue.add).toHaveBeenCalledTimes(0);
  });
});
