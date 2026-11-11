import build from '../api';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

describe('GET /', () => {
  test('return success response', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual('');
  });
});
