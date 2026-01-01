import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2d',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
    serviceWorkers: 'allow',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: !process.env.HEADED },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], headless: !process.env.HEADED },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
  },
});
