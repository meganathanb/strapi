import { buildPackage } from '@strapi/pack-up';

export default buildPackage({
  bundles: [
    {
      source: './server/src/index.ts',
      import: './dist/server/index.mjs',
      require: './dist/server/index.js',
      types: './dist/server/src/index.d.ts',
      runtime: 'node',
    },
  ],
  dist: './dist',
});

