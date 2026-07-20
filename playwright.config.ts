import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // Single-threaded to prevent SQLite lock contention
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx tsx server/src/index.ts',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        POS_DISABLE_LICENSE_CHECK: '1',
        PORT: '3001',
        POS_DB_PATH: path.resolve('./scratch-e2e.db'),
      },
    },
    {
      command: 'npx vite --port 5173',
      cwd: './web',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
    },
  ],
});
