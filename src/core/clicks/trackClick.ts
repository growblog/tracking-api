import turboGeoip from 'turbo-geoip-country';
import pushToQueue from '../../services/clicks/pushToQueue';
import logger from '../../sources/logger';
import formatError from '../../lib/formatError';

export default async function trackClick(
  blogId: string,
  origin: string,
  target: string,
  title: string,
  text: string,
  image: string,
  useragent: string,
  ip: string
): Promise<any> {
  try {
    const country = ip ? turboGeoip.getCountry(ip) : null;
    const params = {
      blogId,
      origin,
      target,
      title,
      text,
      image,
      useragent,
      country,
    };
    return await pushToQueue(params);
  } catch (error: any) {
    logger.error(
      `trackClick(${blogId}, ${origin}, ${target}) ${formatError(error)}`
    );
  }
}
