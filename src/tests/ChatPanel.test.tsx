import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderWithProviders } from './setup'
import { ChatPanel } from '../components/ChatPanel'

const mocks = vi.hoisted(() => ({
  importTextTemp: vi.fn(),
  openFile: vi.fn(),
  readFiles: vi.fn(),
  open: vi.fn(),
}))

vi.mock('../lib/tauri', () => ({
  importTextTemp: mocks.importTextTemp,
  openFile: mocks.openFile,
}))

vi.mock('tauri-plugin-clipboard-api', () => ({
  default: {
    readFiles: mocks.readFiles,
  },
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mocks.open,
}))

function renderChatPanel(props?: Partial<React.ComponentProps<typeof ChatPanel>>) {
  return renderWithProviders(
    <ChatPanel
      messages={[]}
      isStreaming={false}
      usage={{ input: 0, output: 0 }}
      stats={null}
      pendingQueue={[]}
      sessionId="session-1"
      onSend={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn()}
      onEditAndResend={vi.fn()}
      onRemovePendingItem={vi.fn()}
      onContinue={vi.fn()}
      {...props}
    />,
  )
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readFiles.mockResolvedValue([])
    mocks.importTextTemp.mockResolvedValue({
      path: '/tmp/paste-20260605-120000.txt',
      filename: 'paste-20260605-120000.txt',
      year_month: '',
    })
  })

  it('turns pasted long text into a temp file attachment and sends it by path', async () => {
    const onSend = vi.fn()
    renderChatPanel({ onSend })

    const textarea = screen.getByRole('textbox')
    const longText = '长文本'.repeat(101)
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        items: [],
        getData: (type: string) => (type === 'text/plain' || type === 'text' ? longText : ''),
      },
    })

    fireEvent(textarea, pasteEvent)

    expect(pasteEvent.defaultPrevented).toBe(true)
    await waitFor(() => expect(mocks.importTextTemp).toHaveBeenCalledWith(longText))
    expect(await screen.findByText('paste-20260605-120000.txt')).toBeTruthy()
    expect((textarea as HTMLTextAreaElement).value).toBe('')

    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('@/tmp/paste-20260605-120000.txt', undefined)
  })
})
