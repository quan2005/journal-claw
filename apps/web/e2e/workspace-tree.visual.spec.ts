import { expect, test, type Page, type Route } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../stories/20260730-workspace-tree-prototype-alignment/evidence',
)

const selectedPath = '帮助文档/导入和协同/文件格式与导入说明.md'
const expectWithin = (actual: number, expected: number, tolerance = 2) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (value: string) => {
    const channels = value
      .match(/\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number)
    if (!channels || channels.length !== 3) throw new Error(`Unsupported CSS color: ${value}`)
    const linear = channels.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

async function generateOverlay(page: Page, actualPath: string, outputPath: string) {
  const referenceUrl = `data:image/png;base64,${readFileSync(
    path.join(evidenceDir, 'reference.png'),
  ).toString('base64')}`
  const actualUrl = `data:image/png;base64,${readFileSync(actualPath).toString('base64')}`
  const overlayUrl = await page.evaluate(
    async ({ referenceUrl, actualUrl }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () =>
            reject(new Error(`Failed to load overlay source: ${src.slice(0, 32)}`))
          image.src = src
        })
      const [reference, actual] = await Promise.all([loadImage(referenceUrl), loadImage(actualUrl)])
      if (reference.width !== actual.width || reference.height !== actual.height) {
        throw new Error(
          `Overlay dimensions differ: ${reference.width}x${reference.height} vs ${actual.width}x${actual.height}`,
        )
      }
      const canvas = document.createElement('canvas')
      canvas.width = reference.width
      canvas.height = reference.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas 2D context unavailable')
      context.drawImage(reference, 0, 0)
      context.globalAlpha = 0.5
      context.drawImage(actual, 0, 0)
      return canvas.toDataURL('image/png')
    },
    { referenceUrl, actualUrl },
  )
  writeFileSync(
    outputPath,
    Buffer.from(overlayUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
  )
}

function entry(name: string, isDirectory: boolean, mtime: number, parent = '') {
  return {
    name,
    is_dir: isDirectory,
    path: parent ? `${parent}/${name}` : name,
    created_secs: mtime - 10,
    mtime_secs: mtime,
  }
}

type FixtureEntry = ReturnType<typeof entry>

interface RecordedRequest {
  method: string
  pathname: string
  search: string
}

interface DaemonFixtureState {
  entriesByDirectory: Map<string, FixtureEntry[]>
  deleteRequests: RecordedRequest[]
  blockedFontRequests: string[]
  blockedPreviewRequests: RecordedRequest[]
  unhandledDaemonRequests: string[]
  unexpectedNetworkRequests: string[]
}

function createDaemonFixtureState(): DaemonFixtureState {
  return {
    entriesByDirectory: new Map([
      [
        '',
        [
          entry('帮助文档', true, 900),
          entry('System', true, 400),
          entry('快速开始.html', false, 300),
          entry('快速开始.md', false, 200),
          entry('AGENTS.md', false, 100),
        ],
      ],
      [
        '帮助文档',
        [
          entry('导入和协同', true, 600, '帮助文档'),
          entry('更多玩法', true, 500, '帮助文档'),
          entry('操作技巧与快捷键.md', false, 400, '帮助文档'),
          entry('产品理念.html', false, 300, '帮助文档'),
          entry('AI 同事使用指南.md', false, 200, '帮助文档'),
          entry('Momo 使用指南.md', false, 100, '帮助文档'),
        ],
      ],
      [
        '帮助文档/导入和协同',
        [
          entry('从 Notion 和 Google Drive 迁入.md', false, 400, '帮助文档/导入和协同'),
          entry('接入外部工具.md', false, 300, '帮助文档/导入和协同'),
          entry('文件格式与导入说明.md', false, 200, '帮助文档/导入和协同'),
          entry('邀请你的同事一起来.md', false, 100, '帮助文档/导入和协同'),
        ],
      ],
    ]),
    deleteRequests: [],
    blockedFontRequests: [],
    blockedPreviewRequests: [],
    unhandledDaemonRequests: [],
    unexpectedNetworkRequests: [],
  }
}

async function fulfillDaemonFixture(
  route: Route,
  theme: 'light' | 'dark',
  fixture: DaemonFixtureState,
) {
  const request = route.request()
  const url = new URL(request.url())
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  }

  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers })
    return
  }

  if (url.pathname === '/health') {
    await route.fulfill({ json: { status: 'ok' }, headers })
    return
  }
  if (url.pathname === '/events/app-event' || url.pathname === '/events') {
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'retry: 60000\n\n',
      headers,
    })
    return
  }
  if (url.pathname === '/settings') {
    await route.fulfill({
      json: {
        theme,
        workspace_tree_sort: 'mtime-desc',
        workspace_tree_manual_order: {},
        pinned: [],
        auto_lint: {
          enabled: false,
          frequency: 'weekly',
          time: '03:00',
          min_entries: 10,
        },
        global_skills_enabled: true,
      },
      headers,
    })
    return
  }
  if (url.pathname === '/onboarding/status') {
    await route.fulfill({ json: { completed: true, last_step: 1 }, headers })
    return
  }
  if (url.pathname === '/config/workspace-path') {
    await route.fulfill({ json: { path: '/fixture' }, headers })
    return
  }
  if (url.pathname === '/config/engine') {
    await route.fulfill({
      json: {
        active_provider: 'fixture',
        providers: [
          {
            protocol: 'openai',
            id: 'fixture',
            label: 'Fixture',
            api_key: 'configured',
            base_url: 'http://127.0.0.1',
            models: ['fixture-model'],
          },
        ],
      },
      headers,
    })
    return
  }
  if (request.method() === 'DELETE' && url.pathname === '/files') {
    const relativePath = url.searchParams.get('relativePath') ?? ''
    fixture.deleteRequests.push({
      method: request.method(),
      pathname: url.pathname,
      search: url.search,
    })
    const parent = path.posix.dirname(relativePath)
    const directory = parent === '.' ? '' : parent
    const entries = fixture.entriesByDirectory.get(directory) ?? []
    fixture.entriesByDirectory.set(
      directory,
      entries.filter((candidate) => candidate.path !== relativePath),
    )
    await route.fulfill({ status: 204, headers })
    return
  }
  if (request.method() === 'GET' && url.pathname === '/files') {
    const directory = url.searchParams.get('relativePath') ?? ''
    await route.fulfill({ json: fixture.entriesByDirectory.get(directory) ?? [], headers })
    return
  }
  if (
    url.pathname === '/journal/months' ||
    url.pathname === '/journal/entries' ||
    url.pathname === '/identity' ||
    url.pathname === '/work-queue' ||
    url.pathname === '/todos' ||
    url.pathname === '/event-log/events' ||
    url.pathname === '/conversation/list'
  ) {
    await route.fulfill({ json: [], headers })
    return
  }
  if (request.method() === 'GET' && url.pathname === '/journal/content') {
    await route.fulfill({ json: '', headers })
    return
  }

  fixture.unhandledDaemonRequests.push(`${request.method()} ${url.pathname}`)
  await route.fulfill({ json: [], headers })
}

async function openFixture(page: Page, theme: 'light' | 'dark') {
  const fixture = createDaemonFixtureState()
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:17510') {
      await fulfillDaemonFixture(route, theme, fixture)
      return
    }
    if (url.origin === 'http://localhost:4173') {
      if (request.method() === 'GET' || request.method() === 'HEAD') {
        await route.continue()
        return
      }
      fixture.blockedPreviewRequests.push({
        method: request.method(),
        pathname: url.pathname,
        search: url.search,
      })
      await route.abort('blockedbyclient')
      return
    }
    if (url.origin === 'https://fonts.googleapis.com') {
      fixture.blockedFontRequests.push(`${route.request().method()} ${route.request().url()}`)
      await route.abort('blockedbyclient')
      return
    }
    fixture.unexpectedNetworkRequests.push(`${route.request().method()} ${route.request().url()}`)
    await route.abort('blockedbyclient')
  })
  await page.addInitScript(
    ({ selectionPath }) => {
      localStorage.removeItem('JOURNAL_DAEMON_URL')
      localStorage.setItem('journal_base_width', '298')
      localStorage.setItem(
        'journal_topics_expanded_dirs_v1',
        JSON.stringify(['帮助文档', '帮助文档/导入和协同']),
      )
      localStorage.setItem(
        'journal_tree_selection_v1',
        JSON.stringify({
          view: 'journal',
          treeSelection: {
            type: 'topic-file',
            path: selectionPath,
            name: '文件格式与导入说明.md',
          },
          showIdeas: false,
          activeCategory: 'topics',
        }),
      )
    },
    { selectionPath: selectedPath },
  )

  await page.goto('/')
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  })
  await expect(page.getByRole('tree', { name: '个人空间' })).toBeVisible()
  await expect(page.locator(`[role="treeitem"][data-path="${selectedPath}"]`)).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  return fixture
}

test.use({
  viewport: { width: 1200, height: 588 },
  deviceScaleFactor: 2,
})

test.describe('Workspace tree prototype alignment', () => {
  test('matches the approved hierarchy and geometry in light and dark themes', async ({ page }) => {
    const fixture = await openFixture(page, 'light')

    const panel = page.locator('[data-sidebar-panel="left"]')
    const tree = page.getByRole('tree', { name: '个人空间' })
    const title = page.getByText('个人空间', { exact: true })
    const sortButton = page.getByRole('button', { name: '排序' })

    await expect(title).toBeVisible()
    await expect(sortButton).toHaveCount(1)
    await expect(sortButton).toBeVisible()
    await expect(page.getByText('Workspace', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Search' })).toHaveCount(0)
    await expect(tree).toBeVisible()

    const panelBox = await panel.boundingBox()
    const treeBox = await tree.boundingBox()
    const titleBox = await title.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(treeBox).not.toBeNull()
    expect(titleBox).not.toBeNull()
    expectWithin(panelBox!.width, 298)
    expectWithin(panelBox!.height, 550)
    expectWithin(titleBox!.x - panelBox!.x, 15)
    expectWithin(treeBox!.x - panelBox!.x, 8)
    expectWithin(treeBox!.width, 282)
    const titleStyle = await title.evaluate((node) => {
      const style = getComputedStyle(node)
      const tokenProbe = document.createElement('span')
      tokenProbe.style.color = 'var(--item-meta)'
      document.body.appendChild(tokenProbe)
      const resolvedMutedColor = getComputedStyle(tokenProbe).color
      tokenProbe.remove()
      return {
        color: style.color,
        resolvedMutedColor,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
      }
    })
    expect(titleStyle.color).toBe(titleStyle.resolvedMutedColor)
    expectWithin(titleStyle.fontSize, 14)
    expect(titleStyle.fontWeight).toBe(500)

    const rows = tree.locator('[role="treeitem"]')
    await expect(rows).toHaveCount(15)
    const rowBoxes = await rows.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }),
    )
    for (const box of rowBoxes) {
      expectWithin(box.height, 34)
      expectWithin(box.width, 282)
    }
    for (let index = 1; index < rowBoxes.length; index += 1) {
      expectWithin(rowBoxes[index].y - rowBoxes[index - 1].y, 34)
    }

    const rootFolder = tree.locator('[data-path="帮助文档"]')
    const levelOneFolder = tree.locator('[data-path="帮助文档/导入和协同"]')
    const levelTwoFile = tree.locator(
      '[data-path="帮助文档/导入和协同/从 Notion 和 Google Drive 迁入.md"]',
    )
    const levelOneFile = tree.locator('[data-path="帮助文档/操作技巧与快捷键.md"]')
    const rootFile = tree.locator('[data-path="快速开始.md"]')
    await expect(rootFolder).toHaveAttribute('data-depth', '0')
    await expect(levelOneFolder).toHaveAttribute('data-depth', '1')
    await expect(levelOneFile).toHaveAttribute('data-depth', '1')
    await expect(levelTwoFile).toHaveAttribute('data-depth', '2')

    const nameXs = await Promise.all(
      [rootFolder, levelOneFolder, levelTwoFile, rootFile, levelOneFile].map((row) =>
        row.locator('.workspace-tree-name').evaluate((node) => node.getBoundingClientRect().x),
      ),
    )
    expectWithin(nameXs[1] - nameXs[0], 10)
    expectWithin(nameXs[2] - nameXs[1], 10)
    expectWithin(nameXs[3], nameXs[0])
    expectWithin(nameXs[4], nameXs[1])

    const guides = tree.locator('.workspace-tree-children')
    await expect(guides).toHaveCount(2)
    await expect(tree.locator('.workspace-tree-child-count')).toHaveCount(0)
    const guideXs = await guides.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node, '::before')
        return rect.x + Number.parseFloat(style.left)
      }),
    )
    expectWithin(guideXs[0] - panelBox!.x, 19)
    expectWithin(guideXs[1] - panelBox!.x, 29)

    await expect(levelTwoFile.getByRole('img', { name: 'Markdown 文件' })).toBeVisible()
    await expect(tree.getByRole('img', { name: 'HTML 文件' })).toHaveCount(2)
    const markdownIcon = rootFile.getByRole('img', { name: 'Markdown 文件' })
    const htmlIcon = tree
      .locator('[data-path="帮助文档/产品理念.html"]')
      .getByRole('img', { name: 'HTML 文件' })
    await expect(markdownIcon).toHaveAttribute('data-file-kind', 'markdown')
    await expect(markdownIcon).toHaveAttribute('data-file-icon-variant', 'glyph-tile')
    await expect(htmlIcon).toHaveAttribute('data-file-kind', 'html')
    await expect(htmlIcon).toHaveAttribute('data-file-icon-variant', 'glyph-tile')
    const iconStyles = await Promise.all(
      [markdownIcon, htmlIcon].map((icon) =>
        icon.evaluate((node) => {
          const style = getComputedStyle(node)
          const rect = node.getBoundingClientRect()
          const tokenProbe = document.createElement('span')
          tokenProbe.style.borderRadius = 'var(--radius-sm)'
          document.body.appendChild(tokenProbe)
          const resolvedRadius = Number.parseFloat(getComputedStyle(tokenProbe).borderRadius)
          tokenProbe.remove()
          return {
            width: rect.width,
            height: rect.height,
            color: style.color,
            borderStyle: style.borderStyle,
            borderRadius: Number.parseFloat(style.borderRadius),
            resolvedRadius,
          }
        }),
      ),
    )
    expectWithin(iconStyles[0].width, 16, 1)
    expectWithin(iconStyles[0].height, 16, 1)
    expectWithin(iconStyles[1].width, 16, 1)
    expectWithin(iconStyles[1].height, 16, 1)
    expect(iconStyles[0].borderStyle).toBe('solid')
    expect(iconStyles[0].borderRadius).toBe(iconStyles[0].resolvedRadius)
    expect(iconStyles[1].borderRadius).toBe(iconStyles[1].resolvedRadius)
    expect(iconStyles[0].color).not.toBe(iconStyles[1].color)
    const lightIconColors = iconStyles.map((style) => style.color)
    const sentinelRadii = await page.evaluate(() => {
      const root = document.documentElement
      const previousValue = root.style.getPropertyValue('--radius-sm')
      const previousPriority = root.style.getPropertyPriority('--radius-sm')
      root.style.setProperty('--radius-sm', '11px')
      const radii = ['markdown', 'html'].map(
        (kind) =>
          getComputedStyle(
            document.querySelector(
              `[data-file-icon-variant="glyph-tile"][data-file-kind="${kind}"]`,
            )!,
          ).borderRadius,
      )
      if (previousValue) root.style.setProperty('--radius-sm', previousValue, previousPriority)
      else root.style.removeProperty('--radius-sm')
      return radii
    })
    expect(sentinelRadii).toEqual(['11px', '11px'])

    const selected = tree.locator(`[data-path="${selectedPath}"]`)
    const selectedColors = await selected.evaluate((node) => ({
      icon: getComputedStyle(node.querySelector('[data-file-icon-variant="glyph-tile"]')!).color,
      text: getComputedStyle(node.querySelector('.workspace-tree-name')!).color,
    }))
    expect(selectedColors.icon).toBe(selectedColors.text)
    const selectedBox = await selected.boundingBox()
    expect(selectedBox).not.toBeNull()
    expectWithin(selectedBox!.x - panelBox!.x, 8)
    expectWithin(selectedBox!.width, 282)
    const selectedStyle = await selected.evaluate((node) => {
      const style = getComputedStyle(node)
      const rootStyle = getComputedStyle(document.documentElement)
      const tokenProbe = document.createElement('span')
      tokenProbe.style.backgroundColor = 'var(--item-selected-bg)'
      document.body.appendChild(tokenProbe)
      const resolvedSelectedToken = getComputedStyle(tokenProbe).backgroundColor
      tokenProbe.remove()
      return {
        background: style.backgroundColor,
        selectedToken: rootStyle.getPropertyValue('--item-selected-bg').trim(),
        resolvedSelectedToken,
        borderRadius: Number.parseFloat(style.borderRadius),
      }
    })
    expect(selectedStyle.selectedToken).not.toBe('')
    expect(selectedStyle.background).toBe(selectedStyle.resolvedSelectedToken)
    expect(selectedStyle.borderRadius).toBeGreaterThanOrEqual(17)
    await expect(selected.getByRole('button')).toHaveCount(2)
    await expect(selected.getByRole('button', { name: '更多' })).toBeVisible()
    await expect(selected.getByRole('button', { name: '引用' })).toBeVisible()
    expect(
      await selected
        .getByRole('button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label'))),
    ).toEqual(['更多', '引用'])

    const actualLightPath = path.join(evidenceDir, 'actual-light.png')
    await panel.screenshot({ path: actualLightPath })

    await rootFile.hover()
    await expect(rootFile.getByRole('button', { name: '更多' })).toBeVisible()
    const hoverStyle = await rootFile.evaluate((node) => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = 'var(--item-hover-bg)'
      document.body.appendChild(probe)
      const expected = getComputedStyle(probe).backgroundColor
      probe.remove()
      return { actual: getComputedStyle(node).backgroundColor, expected }
    })
    expect(hoverStyle.actual).toBe(hoverStyle.expected)
    await panel.screenshot({ path: path.join(evidenceDir, 'actual-light-hover.png') })

    await selected.click({ button: 'right' })
    await expect(page.getByText('重命名', { exact: true })).toBeVisible()
    await page.getByText('复制路径', { exact: true }).click()
    await expect(page.getByText('重命名', { exact: true })).toBeHidden()
    await selected.getByRole('button', { name: '更多' }).click()
    await expect(page.getByText('重命名', { exact: true })).toBeVisible()
    await page.getByText('复制路径', { exact: true }).click()
    await expect(page.getByText('重命名', { exact: true })).toBeHidden()

    await selected.getByRole('button', { name: '引用' }).click()
    await expect(page.getByPlaceholder('Ask me anything')).toHaveValue(`@${selectedPath}`)

    await sortButton.click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.getByRole('menuitem', { name: '最近修改' }).click()
    await expect(sortButton).toHaveAttribute('data-active-sort', 'mtime-desc')

    await rootFolder.click()
    await expect(rootFolder).toHaveAttribute('aria-expanded', 'false')
    await expect(levelOneFolder).toBeHidden()
    await rootFolder.click()
    await expect(rootFolder).toHaveAttribute('aria-expanded', 'true')
    await expect(levelOneFolder).toBeVisible()

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(selected).toBeVisible()
    const darkIconColors = await Promise.all(
      [markdownIcon, htmlIcon].map((icon) =>
        icon.evaluate((node) => ({
          foreground: getComputedStyle(node).color,
          background: getComputedStyle(
            node.closest('[data-sidebar-panel="left"]') ?? document.documentElement,
          ).backgroundColor,
        })),
      ),
    )
    expect(darkIconColors[0].foreground).not.toBe(darkIconColors[1].foreground)
    expect(darkIconColors[0].foreground).not.toBe(lightIconColors[0])
    expect(darkIconColors[1].foreground).not.toBe(lightIconColors[1])
    expect(
      contrastRatio(darkIconColors[0].foreground, darkIconColors[0].background),
    ).toBeGreaterThan(3)
    expect(
      contrastRatio(darkIconColors[1].foreground, darkIconColors[1].background),
    ).toBeGreaterThan(3)
    const darkSelectedColors = await selected.evaluate((node) => ({
      icon: getComputedStyle(node.querySelector('[data-file-icon-variant="glyph-tile"]')!).color,
      text: getComputedStyle(node.querySelector('.workspace-tree-name')!).color,
    }))
    expect(darkSelectedColors.icon).toBe(darkSelectedColors.text)
    await page.mouse.move(1100, 500)
    await panel.screenshot({ path: path.join(evidenceDir, 'actual-dark.png') })

    await levelOneFile.hover()
    await expect(levelOneFile.getByRole('button', { name: '更多' })).toBeVisible()
    await panel.screenshot({ path: path.join(evidenceDir, 'actual-dark-hover.png') })
    await page.mouse.move(1100, 500)

    await tree.focus()
    await page.keyboard.press('ArrowDown')
    await expect(rootFolder).toBeFocused()
    const focusStyle = await rootFolder.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      }
    })
    expect(focusStyle.outlineStyle).toBe('solid')
    expectWithin(focusStyle.outlineWidth, 2, 0.5)
    await panel.screenshot({ path: path.join(evidenceDir, 'actual-dark-focus.png') })

    await page.keyboard.press('ArrowRight')
    await expect(levelOneFolder).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(levelTwoFile).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(levelTwoFile).toHaveAttribute('aria-selected', 'true')

    await generateOverlay(page, actualLightPath, path.join(evidenceDir, 'overlay.png'))
    expect(fixture.blockedPreviewRequests).toEqual([])
    expect(fixture.unhandledDaemonRequests).toEqual([])
    expect(fixture.unexpectedNetworkRequests).toEqual([])
  })

  test('cancelling the browser confirmation preserves the file without DELETE', async ({
    page,
  }) => {
    const fixture = await openFixture(page, 'light')

    const agentsRow = page.locator('[role="treeitem"][data-path="AGENTS.md"]')
    await agentsRow.click({ button: 'right' })
    await expect(page.getByText('删除条目', { exact: true })).toBeVisible()
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByText('删除条目', { exact: true }).click()

    await expect(agentsRow).toBeVisible()
    await page.reload()
    await expect(page.getByRole('tree', { name: '个人空间' })).toBeVisible()
    await expect(agentsRow).toBeVisible()
    expect(fixture.deleteRequests).toEqual([])
    expect(fixture.blockedPreviewRequests).toEqual([])
    expect(fixture.unhandledDaemonRequests).toEqual([])
    expect(fixture.unexpectedNetworkRequests).toEqual([])
  })

  test('accepting the browser confirmation deletes AGENTS.md from the isolated fixture', async ({
    page,
  }) => {
    const fixture = await openFixture(page, 'light')

    const agentsRow = page.locator('[role="treeitem"][data-path="AGENTS.md"]')
    await agentsRow.click({ button: 'right' })
    await expect(page.getByText('删除条目', { exact: true })).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByText('删除条目', { exact: true }).click()

    await expect(agentsRow).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('tree', { name: '个人空间' })).toBeVisible()
    await expect(agentsRow).toHaveCount(0)
    expect(fixture.deleteRequests).toEqual([
      {
        method: 'DELETE',
        pathname: '/files',
        search: '?relativePath=AGENTS.md',
      },
    ])
    expect(fixture.blockedPreviewRequests).toEqual([])
    expect(fixture.unhandledDaemonRequests).toEqual([])
    expect(fixture.unexpectedNetworkRequests).toEqual([])
  })

  test('accepting the browser confirmation deletes the System folder from the isolated fixture', async ({
    page,
  }) => {
    const fixture = await openFixture(page, 'light')

    const systemRow = page.locator('[role="treeitem"][data-path="System"]')
    await systemRow.click({ button: 'right' })
    await expect(page.getByText('删除文件夹', { exact: true })).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByText('删除文件夹', { exact: true }).click()

    await expect(systemRow).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('tree', { name: '个人空间' })).toBeVisible()
    await expect(systemRow).toHaveCount(0)
    expect(fixture.deleteRequests).toEqual([
      {
        method: 'DELETE',
        pathname: '/files',
        search: '?relativePath=System',
      },
    ])
    expect(fixture.blockedPreviewRequests).toEqual([])
    expect(fixture.unhandledDaemonRequests).toEqual([])
    expect(fixture.unexpectedNetworkRequests).toEqual([])
  })
})
