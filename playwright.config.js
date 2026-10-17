import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 20000,
  use: { baseURL: 'http://localhost:5176' },
  webServer: { command: 'npx vite --port 5176 --strictPort', url: 'http://localhost:5176', reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
