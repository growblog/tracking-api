export default function isAllowedReferer(
  domain: string | null | undefined,
  newDomain: string | null | undefined,
  referer: string | null | undefined,
  origin?: string | null | undefined
): boolean {
  if (!domain) {
    return true;
  }
  const refererHost = referer ? canonicalHost(referer) : null;
  if (!refererHost) {
    // Missing Referer is common with no-referrer / privacy tools — accept the visit.
    // When Origin is present, validate that instead.
    if (!origin) {
      return true;
    }
    const originHost = canonicalHost(origin);
    if (!originHost) {
      return true;
    }
    return isAllowedHost(domain, newDomain, originHost);
  }
  return isAllowedHost(domain, newDomain, refererHost);
}

function isAllowedHost(
  domain: string | null | undefined,
  newDomain: string | null | undefined,
  host: string
): boolean {
  if (isSameSite(domain, host) || isSameSite(newDomain, host)) {
    return true;
  }
  return isGhostPair(domain, host) || isGhostPair(newDomain, host);
}

function isSameSite(
  configured: string | null | undefined,
  refererHost: string
): boolean {
  const configuredHost = configured ? canonicalHost(configured) : null;
  if (!configuredHost) {
    return false;
  }
  const domain = stripWww(configuredHost);
  const host = stripWww(refererHost);
  if (!domain || !host) {
    return false;
  }
  if (host === domain) {
    return true;
  }
  return host.endsWith(`.${domain}`);
}

/** Same Ghost(Pro) subdomain only — not any *.ghost.io for any blog. */
function isGhostPair(
  configured: string | null | undefined,
  refererHost: string
): boolean {
  const configuredHost = configured ? canonicalHost(configured) : null;
  if (!isGhostHost(refererHost) || !isGhostHost(configuredHost)) {
    return false;
  }
  return stripWww(configuredHost!) === stripWww(refererHost);
}

function isGhostHost(host: string | null): boolean {
  if (!host) {
    return false;
  }
  const normalized = stripWww(host);
  return normalized === 'ghost.io' || normalized.endsWith('.ghost.io');
}

function canonicalHost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    const hostname = new URL(withScheme).hostname
      .replace(/\.$/, '')
      .toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}
