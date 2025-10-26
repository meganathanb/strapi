export default () => ({
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      excludeContentTypes: [
        'plugin::upload.file',
        'plugin::upload.folder',
      ],
      retentionDays: 90,
    },
  },
});
