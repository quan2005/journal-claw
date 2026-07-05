import { test, expect } from '@playwright/test'

// Minimal smoke test — verifies the React app builds and mounts its UI shell.
// Intentionally daemon-agnostic: no assertion depends on backend data, so this
// is stable to run in CI with no daemon online.
//
// Prerequisite: `npx playwright install chromium` (browser binary).

test.describe('App smoke', () => {
  test('mounts and renders a UI shell', async ({ page }) => {
    await page.goto('/')

    // React mounts its tree into #root (see src/main.tsx). A non-empty #root
    // means the app shell rendered successfully.
    await expect(page.locator('#root')).not.toBeEmpty()

    // The static <title> from index.html must be present.
    await expect(page).toHaveTitle(/.+/)
  })
})
