import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('app loads and shows title bar', async ({ page }) => {
    await page.goto('/')
    // The app should load without errors
    await expect(page.locator('[data-tauri-drag-region]')).toBeVisible({ timeout: 10000 })
  })

  test('sidebar tabs are visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-tauri-drag-region]')).toBeVisible({ timeout: 10000 })
    // Both sidebar tab buttons should be present
    const buttons = page.locator('button')
    await expect(buttons.first()).toBeVisible()
  })

  test('theme toggle is present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-tauri-drag-region]')).toBeVisible({ timeout: 10000 })
    // Theme toggle buttons (light/dark/system)
    const themeButtons = page.locator('button[title="light"], button[title="dark"], button[title="system"]')
    await expect(themeButtons.first()).toBeVisible()
  })
})
