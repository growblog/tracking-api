import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import trackView from '../../../core/views/trackView';
import logger from '../../../sources/logger';
import formatError from '../../../lib/formatError';

export default function (fastify: FastifyInstance) {
  fastify.route({
    method: 'POST',
    url: '/v3/views/:blogId',
    handler: async function (
      req: FastifyRequest,
      res: FastifyReply
    ): Promise<any> {
      const params = req.params as any;
      const body = req.body as any;
      const { blogId } = params;
      const useragent = headerValue(req.headers['user-agent']);
      const requestReferer = headerValue(req.headers['referer']);
      const lang = body.C;
      const viewReferer = body.D;
      const path = body.U;
      const userIp = req.ip;
      try {
        const output = await trackView(
          blogId,
          path,
          requestReferer,
          viewReferer,
          lang,
          useragent,
          userIp,
          body
        );
        return res.code(200).send(output);
      } catch (error: any) {
        const statusCode = error?.statusCode || 500;
        if (statusCode >= 500) {
          logger.error(`POST /v3/views/${blogId} ${formatError(error)}`);
          return res.code(statusCode).send('Internal Server Error');
        }
        return res.code(statusCode).send(error?.message || '');
      }
    },
  });
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}
