import { defineConfig, devices } from '@playwright/test'

// E2E smoke config for @journal/web.
//
// The webServer runs a production build + `vite preview`, so tests hit the real
// built bundle — no daemon backend is required for the smoke to pass.
//
// Before the first run, install the browser binary once (NOT done automatically):
//   npx playwright install chromium

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build the bundle, then serve `dist` on a fixed port matching `baseURL`.
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
