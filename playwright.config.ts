import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5401',
    browserName: 'chromium',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1'
      ? undefined
      : [
          {
            command: 'npm run preview -w web',
            url: 'http://127.0.0.1:5401',
            reuseExistingServer: false,
            timeout: 30000,
          },
          {
            command: 'node tests/browser/mock-server.mjs',
            url: 'http://127.0.0.1:5402',
            reuseExistingServer: false,
            timeout: 30000,
          },
        ],
});
