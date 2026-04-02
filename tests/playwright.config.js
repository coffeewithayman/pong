const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'PORT=3001 NODE_ENV=test node server.js',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    cwd: require('path').join(__dirname, '..'),
  },
});
