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

  test('accepts domain with port and without scheme', () => {
    expect(
      isAllowedReferer('example.com:8080', null, 'http://example.com:8080/post')
    ).toBe(true);
    expect(
      isAllowedReferer('example.com:8080', null, 'https://example.com/post')
    ).toBe(true);
    expect(
      isAllowedReferer('localhost:3000', null, 'http://localhost:3000/')
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
    // Decision: only the same Ghost(Pro) subdomain is allowed — never any
    // arbitrary *.ghost.io blog for another *.ghost.io blog.
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
    expect(
      isAllowedReferer(
        'alpha.ghost.io',
        null,
        'https://beta.ghost.io/hello'
      )
    ).toBe(false);
  });

  test('custom-domain blogs do not get a free pass from any ghost.io host', () => {
    expect(
      isAllowedReferer('example.com', null, 'https://my-site.ghost.io/')
    ).toBe(false);
  });
});

