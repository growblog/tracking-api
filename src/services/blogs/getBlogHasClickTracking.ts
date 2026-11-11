import moment from 'moment';
import db from '../../sources/postgres';
import logger from '../../sources/logger';
import formatError from '../../lib/formatError';
import { parseCachedJson, readCache, writeCache } from '../../sources/cache';

const EXPIRATION_SECONDS = 2 * 60;

export default async function getBlogHasClickTracking(
  blogId: string
): Promise<boolean> {
  const key = `blog:${blogId}:hasClickTracking`;
  const cached = await readCachedFlag(key);
  if (cached !== null) {
    return cached;
  }
  try {
    const blog: any = await db('blogs')
      .select('user', 'firstVisit')
      .where('id', blogId)
      .orWhere('trackingId', blogId)
      .first();
    if (!blog?.user) {
      return false;
    }
    const user: any = await db('users')
      .select('trialDays', 'plan')
      .where('id', blog.user)
      .first();
    if (!user?.plan) {
      logger.error(
        `User plan not found blogId=${blogId} user=${user ? 'exists' : 'undefined'} plan=${user?.plan || 'undefined'}`
      );
      return false;
    }
    const plan: any = await db('plans').where('id', user.plan).first();
    const daysFromFirstVisit = blog.firstVisit
      ? moment().diff(moment(blog.firstVisit), 'days')
      : 0;
    const trialDaysLeft = user.trialDays - daysFromFirstVisit;
    const isFreeTrial = !blog.firstVisit || trialDaysLeft >= 0;
    const output = isFreeTrial || plan?.hasClicks === true;
    writeCache(key, EXPIRATION_SECONDS, JSON.stringify(output));
    return output;
  } catch (error) {
    logger.error(`getBlogHasClickTracking(${blogId}) ${formatError(error)}`);
    throw error;
  }
}

async function readCachedFlag(key: string): Promise<boolean | null> {
  let raw: string | null;
  try {
    raw = await readCache(key);
  } catch (error) {
    logger.error(
      `getBlogHasClickTracking cache read ${key} ${formatError(error)}`
    );
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const data = parseCachedJson<unknown>(raw);
    if (typeof data === 'boolean') {
      return data;
    }
  } catch (error) {
    logger.error(
      `getBlogHasClickTracking cache parse ${key} ${formatError(error)}`
    );
  }
  return null;
}
