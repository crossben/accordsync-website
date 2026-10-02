import { defineConfig } from 'vitest/config';

// Workspace packages export `./src/index.ts` under the `@accordsync/source` condition, so tests run
// against sources without building dependencies first.
export default defineConfig({
  resolve: { conditions: ['@accordsync/source'] },
  ssr: { resolve: { conditions: ['@accordsync/source'] } },
  test: { include: ['src/**/*.test.ts', 'test/**/*.test.ts'] },
});
