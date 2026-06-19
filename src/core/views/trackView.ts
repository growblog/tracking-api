import { v4 as uuidv4 } from 'uuid';
import turboGeoip from 'turbo-geoip-country';
import libIP from 'ipaddr.js';
import pushToQueue from '../../services/views/pushToQueue';
import isBot from '../../services/views/isBot';
import getBlogFilters from '../../services/blogs/getBlogFilters';
import getBlogForVisits from '../../services/blogs/getBlogForVisits';
import getBlogHasClickTracking from '../../services/blogs/getBlogHasClickTracking';
import getSlug from './getSlug';
import isPreview from './isPreview';
import generateVisitorHash from './generateVisitorHash';

export default async function trackView(
  blogId: string,
  path: string,
  requestReferer: string,
  viewReferer: string,
  lang: string,
  useragent: string,
  userIp: string,
  body: any
): Promise<any> {
  if (!blogId) {
    const error: any = new Error('INVALID_BLOG_ID');
    error.statusCode = 401;
    error.description = 'Invalid Blog Id';
    throw error;
  }
  const isUseragentBot = useragent && isBot(useragent);
  if (isUseragentBot) {
    const error: any = new Error('USERAGENT_IS_BOT');
    error.statusCode = 202;
    throw error;
  }
  const [ipFilters, blog, blogHasClickTracking] = await Promise.all([
    getBlogFilters(blogId),
    getBlogForVisits(blogId),
    getBlogHasClickTracking(blogId),
  ]);
  if (!blog) {
    const error: any = new Error('BLOG_NOT_FOUND');
    error.statusCode = 404;
    error.description = `Blog Id = ${blogId} not found, please check your tracking code`;
    throw error;
  }
  const slug = getSlug(blog, path, true, true);
  if (isPreview(slug)) {
    const error: any = new Error('IS_PREVIEW');
    error.statusCode = 202;
    throw error;
  }
  const enabled = blog && blog.enableClient !== false;
  if (!enabled) {
    const error: any = new Error('INACTIVE_BLOG');
    error.statusCode = 400;
    error.description = 'Please reactivate your blog on Growblog.io';
    throw error;
  }
  const normalizedDomain = blog.domain?.replace(/^www\./, '');
  const normalizedOrigin = requestReferer?.replace(/^www\./, '');
  const domainsMatch =
    blog.domain &&
    requestReferer &&
    normalizedOrigin.includes(normalizedDomain);
  const refererIsGhostPro = requestReferer && requestReferer.includes('.ghost.io');
  const domainIsGhostPro = blog.domain && blog.domain.includes('.ghost.io');
  const isWrong = blog.domain && !domainsMatch && (!refererIsGhostPro || !domainIsGhostPro);
  if (isWrong) {
    const error: any = new Error('INVALID_REFERER');
    error.statusCode = 400;
    error.description = `Not allowed to track from ${requestReferer}`;
    throw error;
  }
  const isPrivateIP = libIP.parse(userIp).range() === 'private';
  const blockIP = !isPrivateIP && ipFilters.includes(userIp);
  if (blockIP) {
    const error: any = new Error('BLOCKED_IP');
    error.statusCode = 202;
    throw error;
  }

  const viewId = uuidv4();
  const country = turboGeoip.getCountry(userIp);
  const url = path || requestReferer;
  const visitorHash = generateVisitorHash(blogId, userIp, useragent || '');
  const queueParams = {
    blogId,
    viewId,
    referer: viewReferer,
    url,
    country,
    useragent,
    lang,
    body,
    visitorHash,
  };
  await pushToQueue(queueParams);
  return {
    id: viewId,
    tc: blogHasClickTracking ? 1 : 0,
  };
}
