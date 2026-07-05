import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderWithProviders } from './setup'
import { ChatPanel } from '../components/ChatPanel'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  openFile: vi.fn(),
  open: vi.fn(),
}))

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: mocks.invoke,
    subscribe: () => () => {},
  }),
}))

vi.mock('../lib/hostBridge', () => ({
  hostOpenDialog: mocks.open,
  hostOpenWithSystem: mocks.openFile,
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
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'import_text') {
        return {
          path: '/workspace/2606/raw/05-paste-20260605-120000.txt',
          filename: '05-paste-20260605-120000.txt',
          year_month: '2606',
        }
      }
      return undefined
    })
  })

  it('saves pasted long text to raw and sends the imported attachment path', async () => {
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
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('import_text', { text: longText }),
    )
    expect(await screen.findByText('05-paste-20260605-120000.txt')).toBeTruthy()
    expect((textarea as HTMLTextAreaElement).value).toBe('')

    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith(
      '@/workspace/2606/raw/05-paste-20260605-120000.txt',
      undefined,
    )
  })

  it('appends identity @ refs from the sidebar without auto-sending', async () => {
    const onSend = vi.fn()
    renderChatPanel({ onSend })

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '请看' } })

    window.dispatchEvent(
      new CustomEvent('chat-append-text', {
        detail: '@identities/研究-犀利教授.md',
      }),
    )

    await waitFor(() => expect(textarea.value).toBe('请看 @identities/研究-犀利教授.md'))
    expect(onSend).not.toHaveBeenCalled()

    fireEvent.change(textarea, {
      target: { value: `${textarea.value} 这个问题怎么看？` },
    })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith(
      '请看 @identities/研究-犀利教授.md 这个问题怎么看？',
      undefined,
    )
  })
})
