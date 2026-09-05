import 'dotenv/config';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

import { testDatabaseUrl } from './test/database-url.js';
import { resolveTsFromJsSpecifier } from './vitest.plugins.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Every spec shares one database, so files must not run concurrently.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
    },
  },
  plugins: [
    resolveTsFromJsSpecifier(),
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
});
