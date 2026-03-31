import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommandDock } from '../components/CommandDock'

vi.mock('tauri-plugin-clipboard-api', () => ({
  default: {
    readFiles: vi.fn().mockResolvedValue([]),
    readText: vi.fn().mockResolvedValue(''),
  },
}))

vi.mock('../lib/tauri', () => ({
  importTextTemp: vi.fn(),
  openFile: vi.fn(),
}))

function renderDock(recorderStatus: 'idle' | 'recording' = 'idle', asrReady: boolean | null = true) {
  const onRecord = vi.fn()

  render(
    <CommandDock
      isDragOver={false}
      pendingFiles={[]}
      onPasteSubmit={vi.fn().mockResolvedValue(undefined)}
      onFilesSubmit={vi.fn().mockResolvedValue(undefined)}
      onFilesCancel={vi.fn()}
      onRemoveFile={vi.fn()}
      onPasteFiles={vi.fn()}
      recorderStatus={recorderStatus}
      onRecord={onRecord}
      asrReady={asrReady}
      onOpenSettings={vi.fn()}
    />,
  )

  return { onRecord }
}

describe('CommandDock', () => {
  it('restores the record button in idle state', () => {
    const { onRecord } = renderDock()
    const button = screen.getByRole('button', { name: '开始录音' })

    expect(button.getAttribute('disabled')).toBeNull()

    fireEvent.click(button)

    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  it('shows the stop action while recording', () => {
    renderDock('recording')

    expect(screen.getByRole('button', { name: '停止录音' })).toBeTruthy()
  })
})
