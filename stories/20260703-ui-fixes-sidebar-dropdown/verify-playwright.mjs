import { chromium } from '@playwright/test'
import { setTimeout } from 'node:timers/promises'
import { existsSync, mkdirSync } from 'node:fs'

const outDir = '/Users/yanwu/Projects/github/journal/stories/20260703-ui-fixes-sidebar-dropdown'
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
})

const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()

const failures = []
const checks = []

function check(name, ok, detail) {
  checks.push({ name, ok, detail })
  if (!ok) failures.push(name)
}

async function runSection(name, fn) {
  try {
    await fn()
  } catch (err) {
    check(`${name} section error`, false, err.message)
    console.error(`Section ${name} error:`, err)
  }
}

try {
  await page.goto('http://localhost:1420', { waitUntil: 'load', timeout: 30000 })
  await setTimeout(2500)

  await runSection('AC-1', async () => {
    const hasLeftDefault = await page.locator('[data-sidebar-panel="left"]').count() > 0
    check('AC-1 default journal shows left sidebar', hasLeftDefault, `count=${await page.locator('[data-sidebar-panel="left"]').count()}`)

    const widthBefore = hasLeftDefault
      ? await page.evaluate(() => document.querySelector('[data-sidebar-panel="left"]')?.getBoundingClientRect().width ?? 0)
      : 0

    for (const label of ['想法', '技能', '自动化']) {
      const btn = page.getByRole('button', { name: label })
      if (await btn.count() > 0) {
        await btn.click({ force: true })
        await setTimeout(800)
      }
      const ideasPanel = await page.locator('[data-sidebar-panel="left"]').count()
      const ideasDivider = await page.locator('[data-sidebar-divider="left"]').count()
      check(`AC-1 ${label} category hides left panel`, ideasPanel === 0, `panel count=${ideasPanel}`)
      check(`AC-1 ${label} category hides left divider`, ideasDivider === 0, `divider count=${ideasDivider}`)
    }

    await page.screenshot({ path: `${outDir}/ac1-ideas.png`, fullPage: false })

    const flowBtn = page.getByRole('button', { name: '流水' })
    if (await flowBtn.count() > 0) {
      await flowBtn.click({ force: true })
      await setTimeout(800)
    }
    const flowPanel = await page.locator('[data-sidebar-panel="left"]').count()
    const widthAfter = flowPanel > 0
      ? await page.evaluate(() => document.querySelector('[data-sidebar-panel="left"]')?.getBoundingClientRect().width ?? 0)
      : 0
    check('AC-1 流水 category restores left panel', flowPanel > 0, `panel count=${flowPanel}`)
    check('AC-1 width preserved across round-trip', Math.abs(widthAfter - widthBefore) < 1, `before=${widthBefore}, after=${widthAfter}`)
    await page.screenshot({ path: `${outDir}/ac1-flow.png`, fullPage: false })
  })

  await runSection('AC-2', async () => {
    // In the current default view the only mounted EngineSwitcher is the
    // WorkspaceView footer chip (conversation-panel bottom input area). The
    // right-panel WorkspaceChatShell does not mount its own EngineSwitcher, so
    // the "top bar" regression case is exercised by the unit tests instead.
    const chips = await page.locator('[data-testid="engine-switcher-chip"]').all()
    check('AC-2 at least one engine switcher chip exists', chips.length > 0, `chip count=${chips.length}`)

    if (chips.length > 0) {
      const chip = chips[chips.length - 1]

      // Log chip DOM context for reporting.
      const chipInfo = await chip.evaluate(el => {
        const rect = el.getBoundingClientRect()
        let ancestor = el.parentElement
        let path = []
        for (let i = 0; i < 6 && ancestor; i++) {
          path.push(`${ancestor.tagName}${ancestor.className ? '.' + ancestor.className.split(' ').slice(0, 3).join('.') : ''}[${ancestor.getAttribute('data-testid') ?? ''}]`)
          ancestor = ancestor.parentElement
        }
        return { rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height }, path }
      })
      check('AC-2 chip DOM context logged', true, JSON.stringify(chipInfo))

      // Flip-up case: the bottom chip sits close to the viewport bottom and
      // there is not enough room below for the popover.
      await page.setViewportSize({ width: 1280, height: 800 })
      await setTimeout(500)
      await chip.scrollIntoViewIfNeeded()
      await setTimeout(200)

      const chipRect = await chip.evaluate(el => el.getBoundingClientRect())
      check('AC-2 bottom chip is near viewport bottom', chipRect.bottom >= 700, `chip.bottom=${chipRect.bottom}`)

      await chip.click({ force: true })
      await setTimeout(400)

      const popover = page.locator('[data-testid="engine-switcher-popover"]')
      const visible = await popover.isVisible().catch(() => false)
      check('AC-2 bottom popover visible after click', visible, `visible=${visible}`)

      if (visible) {
        const rect = await popover.evaluate(el => el.getBoundingClientRect())
        const viewportHeight = await page.evaluate(() => window.innerHeight)
        const isUp = await popover.evaluate(el => el.classList.contains('is-up'))
        check('AC-2 bottom popover within viewport', rect.bottom <= viewportHeight + 1, `rect.bottom=${rect.bottom}, viewport=${viewportHeight}`)
        check('AC-2 bottom popover flips upward', isUp, `is-up=${isUp}`)

        // Verify an option is clickable (all options可点选).
        const firstOption = popover.locator('[role="menuitemradio"], [role="menuitem"]').first()
        const optionVisible = await firstOption.isVisible().catch(() => false)
        check('AC-2 first popover option visible/clickable', optionVisible, `optionVisible=${optionVisible}`)

        await page.screenshot({ path: `${outDir}/ac2-bottom.png`, fullPage: false })
      }

      await page.keyboard.press('Escape')
      await setTimeout(300)
    }
  })

  console.log(JSON.stringify({ checks, failures, failCount: failures.length }, null, 2))
} catch (err) {
  console.error('Verification script error:', err)
  process.exitCode = 1
} finally {
  await context.close()
  await browser.close()
}
