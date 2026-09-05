import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

import { resolveTsFromJsSpecifier } from './vitest.plugins.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.service.ts'],
      exclude: ['src/generated/**', 'src/app.service.ts'],
      reporter: ['text', 'html'],
    },
  },
  plugins: [
    resolveTsFromJsSpecifier(),
    // NestJS dependency injection reads design-time type metadata, which
    // esbuild does not emit. SWC does.
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
