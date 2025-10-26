import type { Core } from '@strapi/types';

export default {
  default: {
    enabled: true,
    excludeContentTypes: [
      'plugin::upload.file',
      'plugin::upload.folder',
      'plugin::audit-log.audit-log',
    ],
    retentionDays: 90, // Keep logs for 90 days by default
  },
  validator(config: any) {
    if (typeof config.enabled !== 'boolean') {
      throw new Error('audit-log config: enabled must be a boolean');
    }
    if (!Array.isArray(config.excludeContentTypes)) {
      throw new Error('audit-log config: excludeContentTypes must be an array');
    }
    if (typeof config.retentionDays !== 'number' || config.retentionDays < 0) {
      throw new Error('audit-log config: retentionDays must be a positive number');
    }
  },
};

