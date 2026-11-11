import logger from './logger';

export interface NodeRedisConfig {
  host?: string;
  port?: number;
  url?: string;
  password?: string;
  tls?: object;
  no_ready_check?: boolean;
  enable_offline_queue: false;
}

export interface BullmqConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: object;
}

interface ResolvedRedis {
  url?: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls: boolean;
  db?: number;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6379;

export function getNodeRedisConfig(
  env: NodeJS.ProcessEnv = process.env
): NodeRedisConfig {
  const resolved = resolveRedis(env);
  if (resolved.url) {
    return {
      url: resolved.url,
      enable_offline_queue: false,
    };
  }
  const config: NodeRedisConfig = {
    host: resolved.host,
    port: resolved.port,
    enable_offline_queue: false,
  };
  if (resolved.password) {
    config.password = resolved.password;
    config.no_ready_check = true;
    config.tls = {};
  }
  return config;
}

export function getBullmqConnection(
  env: NodeJS.ProcessEnv = process.env
): BullmqConnection {
  const resolved = resolveRedis(env);
  const connection: BullmqConnection = {
    host: resolved.host,
    port: resolved.port,
  };
  if (resolved.username) {
    connection.username = resolved.username;
  }
  if (resolved.password) {
    connection.password = resolved.password;
  }
  if (resolved.tls) {
    connection.tls = {};
  }
  if (resolved.db !== undefined) {
    connection.db = resolved.db;
  }
  return connection;
}

function resolveRedis(env: NodeJS.ProcessEnv): ResolvedRedis {
  const rawUrl = env.REDIS_URL?.trim();
  const normalizedUrl = rawUrl ? normalizeRedisUrl(rawUrl) : null;
  if (rawUrl && !normalizedUrl) {
    logger.error('REDIS_URL must use redis:// or rediss://');
  }
  if (normalizedUrl) {
    const parsed = parseRedisUrl(normalizedUrl);
    if (parsed) {
      return parsed;
    }
    logger.error('REDIS_URL could not be parsed');
  }
  const password = env.REDIS_PASSWORD || undefined;
  return {
    host: env.REDIS_HOST?.trim() || DEFAULT_HOST,
    port: parsePort(env.REDIS_PORT),
    password,
    tls: Boolean(password),
  };
}

function normalizeRedisUrl(value: string): string | null {
  if (value.startsWith('redis://') || value.startsWith('rediss://')) {
    return value;
  }
  if (value.startsWith('//')) {
    return `redis:${value}`;
  }
  return null;
}

function parseRedisUrl(value: string): ResolvedRedis | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    return null;
  }
  const dbText = url.pathname.replace(/^\//, '');
  const dbNumber = dbText ? Number(dbText) : undefined;
  const username = url.username ? safeDecode(url.username) : undefined;
  const password = url.password ? safeDecode(url.password) : undefined;
  return {
    url: value,
    host: url.hostname.replace(/^\[|\]$/g, '') || DEFAULT_HOST,
    port: url.port ? parsePort(url.port) : DEFAULT_PORT,
    username,
    password,
    tls: url.protocol === 'rediss:',
    db:
      dbNumber !== undefined && Number.isInteger(dbNumber) ? dbNumber : undefined,
  };
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return DEFAULT_PORT;
  }
  return port;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
