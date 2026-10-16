import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:'rgbpp.spec.ts',reporter:'line',
 use:{baseURL:'http://127.0.0.1:4190',trace:'retain-on-failure'},
 projects:[{name:'rgbpp',use:{...devices['Desktop Chrome'],channel:process.env.PLAYWRIGHT_CHANNEL}}],
 webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4190',port:4190,reuseExistingServer:!process.env.CI},
});
