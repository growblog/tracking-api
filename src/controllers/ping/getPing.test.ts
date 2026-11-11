import build from '../../api';

let api;
beforeAll(async () => {
  api = await build();
  await api.ready();
});

afterAll(() => api?.close());

test('GET /ping', async () => {
  const response = await api.inject({
    method: 'GET',
    url: '/ping',
  });
  expect(response.statusCode).toEqual(200);
  expect(response.body).toEqual('');
});
