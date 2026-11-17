import isAllowedReferer from './isAllowedReferer';

describe('isAllowedReferer', () => {
  test('accepts the visit when Referer is missing', () => {
    expect(isAllowedReferer('example.com', null, null)).toBe(true);
    expect(isAllowedReferer('example.com', null, '')).toBe(true);
    expect(isAllowedReferer('example.com', null, undefined)).toBe(true);
  });

  test('when Referer is missing, validates Origin if present', () => {
    expect(
      isAllowedReferer('example.com', null, null, 'https://example.com')
    ).toBe(true);
    expect(
      isAllowedReferer('example.com', null, '', 'https://evil.com')
    ).toBe(false);
  });

  test('allows matching referer hosts', () => {
    expect(
      isAllowedReferer('example.com', null, 'https://www.example.com/post')
    ).toBe(true);
    expect(
      isAllowedReferer(
        'old.example.com',
        'new.example.com',
        'https://new.example.com/'
      )
    ).toBe(true);
  });

  test('rejects lookalike and cross-site referers', () => {
    expect(
      isAllowedReferer('example.com', null, 'https://evilexample.com/')
    ).toBe(false);
    expect(
      isAllowedReferer('example.com', null, 'https://example.com.evil.com/')
    ).toBe(false);
  });

  test('ghost.io pair only matches the blog subdomain', () => {
    expect(
      isAllowedReferer(
        'my-site.ghost.io',
        null,
        'https://my-site.ghost.io/welcome'
      )
    ).toBe(true);
    expect(
      isAllowedReferer(
        'my-site.ghost.io',
        null,
        'https://preview.ghost.io/welcome'
      )
    ).toBe(false);
    expect(
      isAllowedReferer(
        'my-site.ghost.io',
        null,
        'https://other-blog.ghost.io/post'
      )
    ).toBe(false);
  });

  test('custom-domain blogs do not get a free pass from any ghost.io host', () => {
    expect(
      isAllowedReferer('example.com', null, 'https://my-site.ghost.io/')
    ).toBe(false);
  });
});
