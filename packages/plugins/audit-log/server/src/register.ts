import type { Core } from '@strapi/types';

/**
 * Register phase of the plugin
 * Used to register permissions and other plugin capabilities
 */
export default async ({ strapi }: { strapi: Core.Strapi }) => {
  // Register plugin permissions
  await strapi.admin.services.permission.actionProvider.registerMany([
    {
      section: 'plugins',
      displayName: 'Read',
      uid: 'read',
      pluginName: 'audit-log',
    },
  ]);
};

