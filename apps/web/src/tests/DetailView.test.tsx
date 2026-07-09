import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from './setup'
import { DetailView } from '../components/DetailView'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('../lib/hostBridge', () => ({
  hostConvertFileSrc: (path: string) => `asset://${path}`,
  hostAsk: vi.fn().mockResolvedValue(false),
  hostOpenWithSystem: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: mocks.invoke,
    subscribe: () => () => {},
    getWorkspaceFileUrl: (relativePath: string) => `mock://files/${relativePath}`,
  }),
}))

vi.mock('../lib/markdown', () => ({
  renderMarkdown: vi.fn(() => null),
}))

vi.mock('../components/SandboxPreview', () => ({
  SandboxPreview: ({ html, title }: { html: string; title?: string }) => (
    <div data-testid="sandbox-preview" data-title={title}>
      {html}
    </div>
  ),
}))

function expectSourceViewToContain(text: string) {
  expect(screen.getByTestId('source-view').textContent).toContain(text)
}

const TOPIC_MARKDOWN_CONTENT = `---
tags: ["journal","mdx-manual","template","hr-operations"]
summary: "HR 与运营 / customer-profile 模板的独立使用说明。"
sources: ["../../Projects/github/journal/.agents/skills/journal/references/template-registry.md","../../Projects/github/journal/.agents/skills/journal/references/writing-rules.md"]
---

# customer-profile

<Subtitle>HR 与运营 family / customer-profile template.</Subtitle>`

describe('DetailView topic file rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    })
    mocks.invoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_workspace_path') return '/Users/yanwu/Documents/journal'
      if (cmd === 'get_identity_content') return ''
      if (cmd === 'get_workspace_prompt') return ''
      if (cmd === 'reset_workspace_prompt') return ''
      if (cmd === 'get_journal_entry_content') {
        const path = (args?.path as string) ?? ''
        if (path.match(/\.tsx?$/)) {
          return 'const answer: number = 42\nconsole.log(answer)'
        }
        return path.match(/\.mdx?$/) ? TOPIC_MARKDOWN_CONTENT : '<main><h1>Deck</h1></main>'
      }
      return undefined
    })
  })

  // story 20260708-tree-select-regression · AC-1
  it('loads topic files by workspace-relative path without forcing a topics/ prefix', async () => {
    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'notes.md',
          path: 'tmp_roundtable/notes.md',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('get_journal_entry_content', {
        path: '/Users/yanwu/Documents/journal/tmp_roundtable/notes.md',
      }),
    )
  })

  // story 20260708-unknown-type-plaintext
  describe('unknown file type plain-text option', () => {
    const unknownFile = {
      name: 'run.log',
      path: 'logs/run.log',
      is_dir: false,
      created_secs: 1_714_435_200,
      mtime_secs: 1_714_521_600,
    }

    // AC-1 · 提示面板：两个操作，不自动加载内容
    it('offers plain-text and system-open choices without auto-loading content', async () => {
      renderWithProviders(<DetailView type="topic-file" file={unknownFile} />)

      expect(await screen.findByRole('button', { name: '以纯文本查看' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '用系统应用打开' })).toBeTruthy()
      expect(mocks.invoke).not.toHaveBeenCalledWith(
        'get_journal_entry_content',
        expect.anything(),
      )
    })

    // AC-2 · 点击后以纯文本渲染
    it('renders content as plain text after choosing plain-text view', async () => {
      mocks.invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_workspace_path') return '/Users/yanwu/Documents/journal'
        if (cmd === 'get_journal_entry_content') return 'plain log line'
        return undefined
      })
      renderWithProviders(<DetailView type="topic-file" file={unknownFile} />)

      await act(async () => {
        fireEvent.click(await screen.findByRole('button', { name: '以纯文本查看' }))
      })

      expect(await screen.findByText('plain log line')).toBeTruthy()
    })

    // AC-3 · 会话内按文件记忆，切走再切回不重复问
    it('remembers the per-file choice when switching away and back', async () => {
      mocks.invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_workspace_path') return '/Users/yanwu/Documents/journal'
        if (cmd === 'get_journal_entry_content') return 'plain log line'
        return undefined
      })
      const { rerender } = renderWithProviders(<DetailView type="topic-file" file={unknownFile} />)

      await act(async () => {
        fireEvent.click(await screen.findByRole('button', { name: '以纯文本查看' }))
      })
      expect(await screen.findByText('plain log line')).toBeTruthy()

      rerender(
        <DetailView
          type="topic-file"
          file={{ name: 'other.bin', path: 'logs/other.bin', is_dir: false, mtime_secs: 0 }}
        />,
      )
      expect(await screen.findByRole('button', { name: '以纯文本查看' })).toBeTruthy()

      rerender(<DetailView type="topic-file" file={unknownFile} />)
      expect(await screen.findByText('plain log line')).toBeTruthy()
      expect(screen.queryByRole('button', { name: '以纯文本查看' })).toBeNull()
    })

    // AC-4 · 已识别类型不出现提示
    it('does not show the plain-text prompt for recognized types', async () => {
      renderWithProviders(
        <DetailView
          type="topic-file"
          file={{ name: 'notes.md', path: 'logs/notes.md', is_dir: false, mtime_secs: 0 }}
        />,
      )
      await screen.findByText('notes.md')
      expect(screen.queryByRole('button', { name: '以纯文本查看' })).toBeNull()
    })
  })

  it('renders html topic files with path, file metadata, preview/code toggle, and fullscreen control', async () => {
    const onNavigateToTopicPath = vi.fn()

    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Deck.html',
          path: '可视化一切/Deck.html',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
        onNavigateToTopicPath={onNavigateToTopicPath}
      />,
    )

    const topicButton = await screen.findByRole('button', { name: '定位到工作空间 可视化一切' })
    expect(topicButton).toBeTruthy()
    expect(screen.getByText('Deck.html')).toBeTruthy()
    // AC-1 (fix-breadcrumb-path): breadcrumb has no bogus "专题" prefix segment
    // ahead of the real path — only real path segments are visible content.
    expect(screen.queryByText('专题')).toBeNull()
    expect(screen.queryByText(/创建于/)).toBeNull()
    expect(screen.queryByText(/修改于/)).toBeNull()
    expect(screen.getByLabelText(/最后修改/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('false')
    expect(await screen.findByTestId('sandbox-preview')).toBeTruthy()

    fireEvent.click(topicButton)
    expect(onNavigateToTopicPath).toHaveBeenCalledWith('可视化一切', false)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('sandbox-preview')).toBeNull()
    const sourceView = screen.getByTestId('source-view')
    expect(sourceView.getAttribute('data-wrap')).toBe('true')
    expect(sourceView.style.background).toBe('var(--detail-bg)')
    expect(sourceView.style.borderStyle).toBe('none')
    expect(sourceView.querySelector('code')?.getAttribute('data-source-code')).toBe('true')
    expect((sourceView.querySelector('code') as HTMLElement | null)?.style.background).toBe(
      'transparent',
    )
    expect(screen.getAllByTestId('source-line-number')).toHaveLength(1)
    expect(sourceView.querySelector('.hljs-tag')).toBeTruthy()
    expectSourceViewToContain('<main><h1>Deck</h1></main>')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '进入全屏' }))
    })

    expect(screen.getByTestId('file-view-shell').getAttribute('data-fullscreen')).toBe('true')
    expect(screen.getByRole('button', { name: '退出全屏' })).toBeTruthy()
  })

  it('supports Cmd+F search inside source view content', async () => {
    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Deck.html',
          path: '可视化一切/Deck.html',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    expect(await screen.findByTestId('sandbox-preview')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByTestId('source-view')).toBeTruthy()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', metaKey: true })
    })

    const searchInput = screen.getByPlaceholderText('搜索…')
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Deck' } })
    })

    expect(screen.getByText('1/1')).toBeTruthy()
  })

  it('renders source code files with syntax highlighting and Cmd+F search', async () => {
    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Snippet.ts',
          path: '可视化一切/Snippet.ts',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    const sourceView = await screen.findByTestId('source-view')
    expect(sourceView.querySelector('.hljs-keyword')?.textContent).toBe('const')
    expect(sourceView.querySelector('.hljs-number')?.textContent).toBe('42')

    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', metaKey: true })
    })

    const searchInput = screen.getByPlaceholderText('搜索…')
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'answer' } })
    })

    expect(screen.getByText('1/2')).toBeTruthy()

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '1' } })
    })

    expect(screen.getByText('0/0')).toBeTruthy()
  })

  it('keeps source line numbers out of Cmd+A selection', async () => {
    mocks.invoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_workspace_path') return '/Users/yanwu/Documents/journal'
      if (cmd === 'get_journal_entry_content') {
        const path = (args?.path as string) ?? ''
        if (path.endsWith('Snippet.ts')) return 'alpha\nbeta'
        return TOPIC_MARKDOWN_CONTENT
      }
      return undefined
    })

    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Snippet.ts',
          path: '可视化一切/Snippet.ts',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    await screen.findByTestId('source-view')
    const lineNumbers = screen.getAllByTestId('source-line-number')
    expect(lineNumbers[0].getAttribute('data-line-number')).toBe('1')
    expect(lineNumbers[1].getAttribute('data-line-number')).toBe('2')

    await act(async () => {
      fireEvent.keyDown(window, { key: 'a', metaKey: true })
    })

    const selectedText = window.getSelection()?.toString() ?? ''
    expect(selectedText).toContain('alpha')
    expect(selectedText).toContain('beta')
    expect(selectedText).not.toContain('1alpha')
    expect(selectedText).not.toContain('2beta')
  })

  it('copies the workspace-relative topic file path and shows success feedback', async () => {
    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Deck.html',
          path: '可视化一切/Deck.html',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    const copyButton = await screen.findByRole('button', {
      name: '复制路径 可视化一切/Deck.html',
    })
    expect(copyButton.getAttribute('data-copied')).toBe('false')

    await act(async () => {
      fireEvent.click(copyButton)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('可视化一切/Deck.html')
    expect(copyButton.getAttribute('data-copied')).toBe('true')
    expect(copyButton.getAttribute('aria-label')).toBe('已复制路径 可视化一切/Deck.html')
  })

  it('renders html journal entries with the same preview/code file controls', async () => {
    renderWithProviders(
      <DetailView
        type="journal"
        entry={{
          filename: '12-Deck.html',
          path: '/Users/yanwu/Documents/journal/2605/12-Deck.html',
          title: 'Deck',
          summary: '',
          tags: [],
          sources: [],
          year_month: '2605',
          day: 12,
          created_time: '10:00',
          created_at_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
          materials: [],
        }}
      />,
    )

    expect(await screen.findByText('12-Deck.html')).toBeTruthy()
    expect(screen.queryByText(/创建于/)).toBeNull()
    expect(screen.queryByText(/修改于/)).toBeNull()
    expect(screen.getByLabelText(/最后修改/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览' }).getAttribute('aria-pressed')).toBe('true')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('sandbox-preview')).toBeNull()
    expectSourceViewToContain('<main><h1>Deck</h1></main>')
  })

  it('renders markdown journal entries with preview/source controls, source search, and source copy', async () => {
    renderWithProviders(
      <DetailView
        type="journal"
        entry={{
          filename: '12-Guide.md',
          path: '/Users/yanwu/Documents/journal/2605/12-Guide.md',
          title: 'Guide',
          summary: '预览摘要',
          tags: ['journal'],
          sources: [],
          year_month: '2605',
          day: 12,
          created_time: '10:00',
          created_at_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
          materials: [],
        }}
      />,
    )

    expect(await screen.findByText('Guide')).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览' }).getAttribute('aria-pressed')).toBe('true')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('预览摘要')).toBeNull()
    expectSourceViewToContain('summary: "HR 与运营 / customer-profile 模板的独立使用说明。"')

    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', metaKey: true })
    })

    const searchInput = screen.getByPlaceholderText('搜索…')
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'customer-profile' } })
    })

    expect(screen.getByText('1/3')).toBeTruthy()

    const copySourceButton = screen.getByRole('button', { name: '复制源码' })
    expect(copySourceButton.getAttribute('data-copied')).toBe('false')

    await act(async () => {
      fireEvent.click(copySourceButton)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('# customer-profile'),
    )
    expect(copySourceButton.getAttribute('data-copied')).toBe('true')
    expect(copySourceButton.getAttribute('aria-label')).toBe('已复制源码')
  })

  it('renders identity entries with preview/source controls and raw markdown source', async () => {
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_workspace_path') return '/Users/yanwu/Documents/journal'
      if (cmd === 'get_identity_content') {
        return '# 张三\n\n- 会议主持人\n- customer-profile'
      }
      return ''
    })

    renderWithProviders(
      <DetailView
        type="identity"
        identity={{
          name: '张三',
          region: '广州',
          path: '/Users/yanwu/Documents/journal/identities/张三.md',
          filename: '张三.md',
          summary: '产品负责人',
          tags: ['person'],
          aliases: [],
          expert_skill: '',
          is_expert: false,
          speaker_id: 'spk-1',
          mtime_secs: 1_714_521_600,
          archived: false,
        }}
      />,
    )

    expect(await screen.findByText('张三')).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('产品负责人')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('产品负责人')).toBeNull()
    expectSourceViewToContain('- customer-profile')

    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', metaKey: true })
    })

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('搜索…'), {
        target: { value: 'customer-profile' },
      })
    })

    expect(screen.getByText('1/1')).toBeTruthy()
  })

  it('renders mdx topic files with the same preview/code file controls', async () => {
    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Guide.mdx',
          path: '可视化一切/Guide.mdx',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    expect(await screen.findByText('Guide.mdx')).toBeTruthy()
    expect((await screen.findByRole('button', { name: '预览' })).getAttribute('aria-pressed')).toBe(
      'true',
    )
    const metadata = await screen.findByTestId('file-preview-metadata')
    expect(metadata.style.marginBottom).toBe('20px')
    expect(metadata.style.paddingBottom).toBe('16px')
    expect(metadata.style.borderBottom).toBe('0.5px solid var(--divider)')
    expect(metadata.textContent).not.toContain('summary')
    expect(metadata.textContent).not.toContain('tags')
    expect(metadata.textContent).not.toContain('sources')
    expect(metadata.textContent).toContain('HR 与运营 / customer-profile 模板的独立使用说明。')
    expect(metadata.textContent).toContain('hr-operations')
    expect(metadata.textContent).not.toContain('journal')
    expect(metadata.textContent).toContain('template-registry')
    expect(metadata.textContent).toContain('MD')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('true')
    expectSourceViewToContain('summary: "HR 与运营 / customer-profile 模板的独立使用说明。"')
  })

  it('renders markdown topic files with the same preview/code file controls', async () => {
    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Guide.md',
          path: '可视化一切/Guide.md',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    expect(await screen.findByText('Guide.md')).toBeTruthy()
    expect((await screen.findByRole('button', { name: '预览' })).getAttribute('aria-pressed')).toBe(
      'true',
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('true')
    expectSourceViewToContain('summary: "HR 与运营 / customer-profile 模板的独立使用说明。"')
  })

  it('renders text topic files through the shared file shell', async () => {
    renderWithProviders(
      <DetailView
        type="topic-file"
        file={{
          name: 'Notes.txt',
          path: '可视化一切/Notes.txt',
          is_dir: false,
          created_secs: 1_714_435_200,
          mtime_secs: 1_714_521_600,
        }}
      />,
    )

    expect(await screen.findByText('Notes.txt')).toBeTruthy()
    expect(await screen.findByTestId('file-view-shell')).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览' }).getAttribute('aria-pressed')).toBe('true')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '源码' }))
    })

    expect(screen.getByRole('button', { name: '源码' }).getAttribute('aria-pressed')).toBe('true')
    expectSourceViewToContain('<main><h1>Deck</h1></main>')
  })

  // story 20260708-fix-image-preview · AC-1/AC-3
  describe('image file preview', () => {
    const imageFile = {
      name: 'photo.png',
      path: 'assets/photo.png',
      is_dir: false,
      created_secs: 1_714_435_200,
      mtime_secs: 1_714_521_600,
    }

    it('renders the image via the daemon-backed URL (not a file:// src)', async () => {
      renderWithProviders(<DetailView type="topic-file" file={imageFile} />)

      const img = (await screen.findByAltText('photo.png')) as HTMLImageElement
      expect(img.src).toBe('mock://files/assets/photo.png')
    })

    it('shows a clear "无法预览" state when the image fails to decode', async () => {
      renderWithProviders(<DetailView type="topic-file" file={imageFile} />)

      const img = (await screen.findByAltText('photo.png')) as HTMLImageElement
      fireEvent.error(img)

      expect(await screen.findByText('无法预览此图片')).toBeTruthy()
      expect(screen.queryByAltText('photo.png')).toBeNull()
    })
  })
})
