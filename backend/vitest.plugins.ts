import type { Plugin } from 'vite';

/**
 * The backend is ESM with `moduleResolution: nodenext`, so every relative
 * import in src/ carries a `.js` extension that points at a file which only
 * exists as `.ts` on disk. Node resolves this at runtime after compilation;
 * Vite does not, so tests would fail to resolve any internal import.
 *
 * This rewrites relative `./x.js` specifiers to `./x.ts` during test runs.
 * It touches nothing outside the test pipeline.
 */
export function resolveTsFromJsSpecifier(): Plugin {
  return {
    name: 'resolve-ts-from-js-specifier',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !source.startsWith('.') || !source.endsWith('.js')) {
        return null;
      }

      const candidate = `${source.slice(0, -'.js'.length)}.ts`;
      const resolved = await this.resolve(candidate, importer, {
        ...options,
        skipSelf: true,
      });

      return resolved ?? null;
    },
  };
}
