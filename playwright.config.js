import { defineConfig, devices } from '@playwright/test';

const land = { width: 1180, height: 820 };
const port = { width: 820, height: 1180 };
const ipad = { ...devices['iPad Pro 11'], deviceScaleFactor: 2, hasTouch: true };

export default defineConfig({
  testDir: 'tests',
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/dus-noro-3d/', ...ipad },
  webServer: { command: 'npm run build && node tests/serve.mjs', url: 'http://localhost:4173/dus-noro-3d/', reuseExistingServer: true, timeout: 120_000 },
  // Windows WebKit uzun koşuda aralıklı kilitleniyor, nedeni belirlenemedi; yeniden denenen test çıktıda 'flaky' görünür
  projects: [
    { name: 'chromium-yatay', use: { ...ipad, browserName: 'chromium', viewport: land } },
    { name: 'chromium-dikey', use: { ...ipad, browserName: 'chromium', viewport: port } },
    { name: 'webkit-yatay', retries: 1, use: { ...ipad, browserName: 'webkit', viewport: land } },
    { name: 'webkit-dikey', retries: 1, use: { ...ipad, browserName: 'webkit', viewport: port } },
  ],
});
