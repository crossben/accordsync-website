import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Starts PostgreSQL and the reference server unless ACCORD_URL points at a server already.
      globalSetup: ['./global-setup.ts'],
      // One server, one database: tests reset it, so they must not run at the same time.
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
