export default {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/audit-logs',
        handler: 'audit-log.find',
        config: {
          policies: [
            {
              name: 'admin::hasPermissions',
              config: {
                actions: ['plugin::audit-log.read'],
              },
            },
          ],
        },
      },
      {
        method: 'GET',
        path: '/audit-logs/:id',
        handler: 'audit-log.findOne',
        config: {
          policies: [
            {
              name: 'admin::hasPermissions',
              config: {
                actions: ['plugin::audit-log.read'],
              },
            },
          ],
        },
      },
    ],
  },
};

