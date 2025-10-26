import type { Core } from '@strapi/types';

const createAuditLogController = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /audit-logs
   * Find audit logs with filters, pagination, and sorting
   */
  async find(ctx: any) {
    const { query } = ctx.request;

    // Extract query parameters
    const params = {
      contentType: query.contentType,
      userId: query.userId ? parseInt(query.userId, 10) : undefined,
      action: query.action,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 25,
      sort: query.sort || 'timestamp:desc',
    };

    // Validate pageSize (max 100)
    if (params.pageSize > 100) {
      params.pageSize = 100;
    }

    try {
      const result = await strapi
        .plugin('audit-log')
        .service('audit-log')
        .find(params);

      ctx.body = result;
    } catch (error) {
      ctx.throw(500, 'Failed to fetch audit logs');
    }
  },

  /**
   * GET /audit-logs/:id
   * Find a single audit log by ID
   */
  async findOne(ctx: any) {
    const { id } = ctx.params;

    try {
      const log = await strapi
        .plugin('audit-log')
        .service('audit-log')
        .findOne(parseInt(id, 10));

      if (!log) {
        return ctx.notFound('Audit log not found');
      }

      ctx.body = { data: log };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch audit log');
    }
  },
});

export default createAuditLogController;

