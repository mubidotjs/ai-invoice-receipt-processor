import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['shared/src/**/*.test.ts', 'worker/src/**/*.test.ts', 'web/src/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 15000,
  },
});
