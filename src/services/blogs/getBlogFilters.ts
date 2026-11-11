import db from '../../sources/postgres';
import logger from '../../sources/logger';
import formatError from '../../lib/formatError';
import { parseCachedJson, readCache, writeCache } from '../../sources/cache';

const EXPIRATION_SECONDS = 5 * 60;

export default async function getBlogFilters(
  blogId: string
): Promise<string[]> {
  const key = `blog:${blogId}:ip_filters`;
  const cached = await readCachedList(key);
  if (cached) {
    return cached;
  }
  try {
    const filters = await db('blog_filters')
      .select('ip')
      .where('blog', blogId)
      .whereNull('deleted');
    const ipList = filters.map((item: { ip: string }) => item.ip);
    writeCache(key, EXPIRATION_SECONDS, JSON.stringify(ipList));
    return ipList;
  } catch (error) {
    logger.error(`getBlogFilters(${blogId}) ${formatError(error)}`);
    throw error;
  }
}

async function readCachedList(key: string): Promise<string[] | null> {
  let raw: string | null;
  try {
    raw = await readCache(key);
  } catch (error) {
    logger.error(`getBlogFilters cache read ${key} ${formatError(error)}`);
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const data = parseCachedJson<unknown>(raw);
    if (Array.isArray(data)) {
      return data;
    }
  } catch (error) {
    logger.error(`getBlogFilters cache parse ${key} ${formatError(error)}`);
  }
  return null;
}
