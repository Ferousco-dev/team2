import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: true,
    workers: 2,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}
    },
    webServer: {
        command: 'node scripts/serve.mjs',
        env: { PORT: '4173' },
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI
    }
});
