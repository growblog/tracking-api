import turboGeoip from 'turbo-geoip-country';
import pushToNoscriptQueue from '../../services/views/pushToNoscriptQueue';
import isBot from '../../services/views/isBot';
import getBlogFilters from '../../services/blogs/getBlogFilters';
import getBlogForVisits from '../../services/blogs/getBlogForVisits';
import getSlug from './getSlug';
import isPreview from './isPreview';
import isAllowedReferer from './isAllowedReferer';

export default async function trackNoscript(
  blogId: string,
  path: string | undefined,
  useragent: string | undefined,
  lang: string | undefined,
  userIp: string | undefined
): Promise<any> {
  const isValid = blogId && path;
  if (!isValid) {
    return false;
  }
  const isUseragentBot = useragent && isBot(useragent);
  if (isUseragentBot) {
    return false;
  }
  const [ipFilters, blog] = await Promise.all([
    getBlogFilters(blogId),
    getBlogForVisits(blogId),
  ]);
  if (!blog) {
    return false;
  }
  const isEnabled = blog.enableClient === true;
  if (!isEnabled) {
    return false;
  }
  if (!isAllowedReferer(blog.domain, blog.newDomain, path)) {
    return false;
  }
  const isIpBlocked = userIp && ipFilters?.includes(userIp);
  if (isIpBlocked) {
    return false;
  }
  const slug = getSlug(blog, path, true, true);
  const isPostPreview = isPreview(slug);
  if (isPostPreview) {
    return false;
  }
  const country = userIp ? turboGeoip.getCountry(userIp) : null;
  const params = {
    blogId,
    path,
    useragent,
    lang,
    country,
  };
  return pushToNoscriptQueue(params);
}
