import type { Core } from '@strapi/types';

/**
 * Get user information from the request context
 */
const getUserInfo = () => {
  try {
    const ctx = strapi.requestContext.get();
    const user = ctx?.state?.user;

    if (user) {
      return {
        userId: user.id,
        userName: user.username || user.firstname || user.lastname 
          ? `${user.firstname || ''} ${user.lastname || ''}`.trim() 
          : null,
        userEmail: user.email || null,
      };
    }
  } catch (error) {
    // Silently fail if we can't get user info
  }

  return {
    userId: undefined,
    userName: undefined,
    userEmail: undefined,
  };
};

/**
 * Check if audit logging is enabled for a content type
 */
const isAuditEnabled = (contentTypeUid: string): boolean => {
  const config = strapi.config.get('plugin.audit-log', {
    enabled: true,
    excludeContentTypes: [],
  });

  // Check if logging is globally disabled
  if (!config.enabled) {
    return false;
  }

  // Check if this content type is excluded
  if (config.excludeContentTypes.includes(contentTypeUid)) {
    return false;
  }

  // Only log user-created content types (api::*) and some plugin content types
  // Exclude internal Strapi content types
  if (!contentTypeUid.startsWith('api::') && 
      !contentTypeUid.startsWith('plugin::users-permissions')) {
    return false;
  }

  return true;
};

/**
 * Bootstrap phase of the plugin
 * Used to register middleware and lifecycle hooks
 */
export default async ({ strapi }: { strapi: Core.Strapi }) => {
  // Register document middleware to capture create, update, delete operations
  strapi.documents.use(async (context, next) => {
    const { action, contentType, params } = context;

    // Check if we should audit this content type
    if (!isAuditEnabled(contentType.uid)) {
      return next();
    }

    // Only track specific actions
    if (!['create', 'update', 'delete', 'publish', 'unpublish'].includes(action)) {
      return next();
    }

    // Get user info
    const userInfo = getUserInfo();

    // For updates and deletes, fetch the old data before the operation
    let oldData = null;
    if ((action === 'update' || action === 'delete') && params.documentId) {
      try {
        const entries = await strapi.db.query(contentType.uid).findMany({
          where: { documentId: params.documentId },
          limit: 1,
        });
        oldData = entries[0] || null;
      } catch (error) {
        strapi.log.warn('Failed to fetch old data for audit log:', error);
      }
    }

    // Execute the actual operation
    const result = await next();

    // After the operation, create the audit log
    try {
      const auditLogService = strapi.plugin('audit-log').service('audit-log');

      // Determine the record ID
      let recordId: string | undefined;
      
      if (action === 'create') {
        // For create, get the documentId from the result
        recordId = result?.documentId || result?.id;
      } else if (action === 'delete') {
        // For delete, use the old data's documentId
        recordId = oldData?.documentId || oldData?.id;
      } else {
        // For update, publish, unpublish
        recordId = params.documentId || result?.documentId || result?.id;
      }

      if (!recordId) {
        strapi.log.warn('Could not determine record ID for audit log');
        return result;
      }

      // Create audit log entry
      await auditLogService.create({
        contentType: contentType.uid,
        recordId: String(recordId),
        action: action as any,
        ...userInfo,
        payload: action === 'create' ? result : null,
        oldData: oldData,
        newData: action === 'update' ? result : null,
      });
    } catch (error) {
      // Log the error but don't fail the main operation
      strapi.log.error('Failed to create audit log entry:', error);
    }

    return result;
  });

  // Schedule a daily cleanup job to delete old audit logs
  const config = strapi.config.get('plugin.audit-log', {
    retentionDays: 90,
  });

  if (config.retentionDays > 0) {
    // Run cleanup every day at 2 AM
    strapi.cron.add({
      '0 2 * * *': async () => {
        try {
          const auditLogService = strapi.plugin('audit-log').service('audit-log');
          const result = await auditLogService.deleteOlderThan(config.retentionDays);
          strapi.log.info(`Audit log cleanup: deleted ${result?.count || 0} old entries`);
        } catch (error) {
          strapi.log.error('Failed to run audit log cleanup:', error);
        }
      },
    });
  }

  strapi.log.info('Audit log plugin initialized');
};

