import type { Core } from '@strapi/types';
import { isEqual } from 'lodash';

interface CreateAuditLogParams {
  contentType: string;
  recordId: string;
  action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
  userId?: number;
  userName?: string;
  userEmail?: string;
  payload?: any;
  oldData?: any;
  newData?: any;
}

interface FindAuditLogsParams {
  contentType?: string;
  userId?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

/**
 * Calculate the difference between old and new data
 */
const calculateChanges = (oldData: any, newData: any): any => {
  if (!oldData || !newData) {
    return null;
  }

  const changes: any = {};

  // Find changed, added, or removed keys
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    // Skip system fields and relations that might be too verbose
    if (['id', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy'].includes(key)) {
      continue;
    }

    const oldValue = oldData[key];
    const newValue = newData[key];

    if (!isEqual(oldValue, newValue)) {
      changes[key] = {
        from: oldValue,
        to: newValue,
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
};

const createAuditLogService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Create an audit log entry
   */
  async create(params: CreateAuditLogParams) {
    const { contentType, recordId, action, userId, userName, userEmail, payload, oldData, newData } = params;

    // Calculate changes for update actions
    const changes = action === 'update' && oldData && newData ? calculateChanges(oldData, newData) : null;

    // Don't create a log if there are no changes
    if (action === 'update' && !changes) {
      return null;
    }

    try {
      const auditLog = await strapi.db.query('plugin::audit-log.audit-log').create({
        data: {
          contentType,
          recordId: String(recordId),
          action,
          userId: userId || null,
          userName: userName || null,
          userEmail: userEmail || null,
          payload: payload || null,
          changes: changes || null,
          timestamp: new Date(),
        },
      });

      return auditLog;
    } catch (error) {
      // Log error but don't break the main operation
      strapi.log.error('Failed to create audit log:', error);
      return null;
    }
  },

  /**
   * Find audit logs with filters, pagination, and sorting
   */
  async find(params: FindAuditLogsParams = {}) {
    const {
      contentType,
      userId,
      action,
      startDate,
      endDate,
      page = 1,
      pageSize = 25,
      sort = 'timestamp:desc',
    } = params;

    // Build filters
    const where: any = {};

    if (contentType) {
      where.contentType = contentType;
    }

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.$lte = new Date(endDate);
      }
    }

    // Execute query with pagination
    const [logs, total] = await Promise.all([
      strapi.db.query('plugin::audit-log.audit-log').findMany({
        where,
        orderBy: sort.split(':').reduce((acc, val, idx) => {
          if (idx === 0) {
            acc[val] = 'desc'; // default
          } else {
            const keys = Object.keys(acc);
            acc[keys[0]] = val as 'asc' | 'desc';
          }
          return acc;
        }, {} as any),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      strapi.db.query('plugin::audit-log.audit-log').count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      },
    };
  },

  /**
   * Find a single audit log by ID
   */
  async findOne(id: number) {
    return strapi.db.query('plugin::audit-log.audit-log').findOne({
      where: { id },
    });
  },

  /**
   * Delete old audit logs (for cleanup jobs)
   */
  async deleteOlderThan(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);

    const result = await strapi.db.query('plugin::audit-log.audit-log').deleteMany({
      where: {
        timestamp: {
          $lt: date,
        },
      },
    });

    return result;
  },
});

export default createAuditLogService;

