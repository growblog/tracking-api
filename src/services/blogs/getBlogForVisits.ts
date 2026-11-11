import db from '../../sources/postgres';
import logger from '../../sources/logger';
import formatError from '../../lib/formatError';
import { parseCachedJson, readCache, writeCache } from '../../sources/cache';

const EXPIRATION_SECONDS = 2 * 60;

export default async function getBlogForVisits(blogId: string): Promise<any> {
  const key = `blog:${blogId}:for_visits`;
  const cached = await readOptionalJson<any>(key, 'getBlogForVisits');
  if (cached && cached.id) {
    return cached;
  }
  try {
    const blog = await db('blogs')
      .select(
        'id',
        'url',
        'domain',
        'newDomain',
        'enableClient',
        'firstVisit',
        'filterOwnIP',
        'filterTeamIP',
        'user',
        'active'
      )
      .where('id', blogId)
      .orWhere('trackingId', blogId)
      .first();
    if (blog && blog.firstVisit) {
      writeCache(key, EXPIRATION_SECONDS, JSON.stringify(blog));
    }
    return blog;
  } catch (error) {
    logger.error(`getBlogForVisits(${blogId}) ${formatError(error)}`);
    throw error;
  }
}

async function readOptionalJson<T>(
  key: string,
  label: string
): Promise<T | null> {
  let raw: string | null;
  try {
    raw = await readCache(key);
  } catch (error) {
    logger.error(`${label} cache read ${key} ${formatError(error)}`);
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    return parseCachedJson<T>(raw);
  } catch (error) {
    logger.error(`${label} cache parse ${key} ${formatError(error)}`);
    return null;
  }
}
