export default function isAllowedReferer(
  domain: string | null | undefined,
  newDomain: string | null | undefined,
  referer: string | null | undefined
): boolean {
  if (!domain) {
    return true;
  }
  const refererHost = referer ? canonicalHost(referer) : null;
  if (!refererHost) {
    return false;
  }
  if (isSameSite(domain, refererHost) || isSameSite(newDomain, refererHost)) {
    return true;
  }
  return isGhostPair(domain, refererHost) || isGhostPair(newDomain, refererHost);
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

function isGhostPair(
  configured: string | null | undefined,
  refererHost: string
): boolean {
  const configuredHost = configured ? canonicalHost(configured) : null;
  return isGhostHost(refererHost) && isGhostHost(configuredHost);
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
