import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, PORT: process.env.PORT || '3756' },
  },
});
