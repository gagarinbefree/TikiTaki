import { defineConfig } from '@playwright/test';
import { BROWSER_CONFIG, SERVER_CONFIG } from './tooling.config.mjs';

const baseURL = `http://${SERVER_CONFIG.host}:${String(SERVER_CONFIG.testPort)}`;
const developmentURL = `http://${SERVER_CONFIG.host}:${String(SERVER_CONFIG.developmentPort)}`;

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: BROWSER_CONFIG.workers,
  timeout: BROWSER_CONFIG.timeout,
  reporter: [['list'], ['json', { outputFile: BROWSER_CONFIG.reportPath }]],
  use: { baseURL, headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'google-chrome', use: { channel: BROWSER_CONFIG.channel, viewport: BROWSER_CONFIG.desktop } },
    {
      name: 'google-chrome-touch',
      use: { channel: BROWSER_CONFIG.channel, viewport: BROWSER_CONFIG.touch, hasTouch: true, isMobile: true },
    },
  ],
  webServer: [
    { command: 'node tests/browser/server.mjs', url: baseURL, reuseExistingServer: false, timeout: BROWSER_CONFIG.serverTimeout },
    {
      command: `node node_modules/vite/bin/vite.js --configLoader native --host ${SERVER_CONFIG.host} --port ${String(SERVER_CONFIG.developmentPort)} --strictPort`,
      url: developmentURL,
      reuseExistingServer: false,
      timeout: BROWSER_CONFIG.timeout,
    },
  ],
});
