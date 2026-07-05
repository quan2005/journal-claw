import { createRequire } from 'node:module'
import { setTimeout } from 'node:timers/promises'

// Resolve @playwright/test from the @journal/web package so this script can be
// executed from the stories directory while still using the workspace's
// playwright installation.
const require = createRequire(import.meta.url)
const { chromium } = require('/Users/yanwu/Projects/github/journal/apps/web/node_modules/@playwright/test/index.js')

const outDir = '/Users/yanwu/Projects/github/journal/stories/20260703-ui-fixes-sidebar-dropdown'

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
})

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
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

async function openEnginePopover(viewName) {
  const chips = await page.locator('[data-testid="engine-switcher-chip"]').all()
  check(`${viewName}: at least one engine switcher chip exists`, chips.length > 0, `chip count=${chips.length}`)
  if (chips.length === 0) return null

  const chip = chips[chips.length - 1]
  await chip.scrollIntoViewIfNeeded()
  await setTimeout(200)
  await chip.click({ force: true })
  await setTimeout(500)

  const popover = page.locator('[data-testid="engine-switcher-popover"]')
  const visible = await popover.isVisible().catch(() => false)
  check(`${viewName}: popover visible after click`, visible, `visible=${visible}`)
  if (!visible) return null

  const info = await popover.evaluate(el => {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    const parent = el.parentElement
    const seg = el.querySelector('.engine-switcher__seg')
    const segRect = seg?.getBoundingClientRect()
    const segBtns = Array.from(el.querySelectorAll('.engine-switcher__seg-btn'))
    const btnRects = segBtns.map(b => {
      const r = b.getBoundingClientRect()
      return { text: b.textContent, width: r.width, height: r.height }
    })
    return {
      position: style.position,
      zIndex: style.zIndex,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
      parentIsBody: parent === document.body,
      parentTag: parent?.tagName ?? null,
      segRect: segRect ? { top: segRect.top, bottom: segRect.bottom, left: segRect.left, right: segRect.right } : null,
      btnRects,
    }
  })

  check(`${viewName}: popover position is fixed`, info.position === 'fixed', `position=${info.position}`)
  check(`${viewName}: popover mounted on document.body`, info.parentIsBody, `parentTag=${info.parentTag}`)
  check(`${viewName}: popover within viewport`, info.rect.bottom <= 900 && info.rect.top >= 0 && info.rect.left >= 0 && info.rect.right <= 1440, JSON.stringify(info.rect))

  for (const btn of info.btnRects) {
    const singleLine = btn.height < 40 && btn.text && !btn.text.includes('\n')
    check(`${viewName}: seg-btn "${btn.text?.trim()}" not wrapped`, singleLine, JSON.stringify(btn))
  }

  check(`${viewName}: popover z-index is a number`, /^\d+$/.test(String(info.zIndex)), `zIndex=${info.zIndex}`)

  if (info.segRect) {
    check(`${viewName}: segmented control visible above middle column`, info.segRect.left > 200 && info.segRect.top > 0 && info.segRect.bottom < 900, JSON.stringify(info.segRect))
  }

  return popover
}

try {
  await page.goto('http://localhost:1420', { waitUntil: 'load', timeout: 30000 })
  await setTimeout(3000)

  // --- Chat view (流水 / journal) ---
  await runSection('Chat', async () => {
    const flowBtn = page.getByRole('button', { name: '流水' })
    if (await flowBtn.count() > 0) {
      await flowBtn.click({ force: true })
      await setTimeout(1000)
    }
    const popover = await openEnginePopover('chat')
    if (popover) {
      await page.screenshot({ path: `${outDir}/ac2-chat-after.png`, fullPage: false })
      await page.keyboard.press('Escape')
      await setTimeout(300)
    }
  })

  // --- Workspace view (技能 / fullscreen workbench) ---
  // The right conversation panel is collapsed by default in fullscreen workbench
  // views; pin it first so the engine chip is within the viewport.
  await runSection('Workspace', async () => {
    const pinBtn = page.getByRole('button', { name: '固定右侧栏（切换内容时不收起）' })
    if (await pinBtn.count() > 0) {
      await pinBtn.click({ force: true })
      await setTimeout(800)
    }

    const skillsBtn = page.getByRole('button', { name: '技能' })
    if (await skillsBtn.count() > 0) {
      await skillsBtn.click({ force: true })
      await setTimeout(1500)
    }
    const popover = await openEnginePopover('workspace')
    if (popover) {
      await page.screenshot({ path: `${outDir}/ac2-workspace-after.png`, fullPage: false })
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
