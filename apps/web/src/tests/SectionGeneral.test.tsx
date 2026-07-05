import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionGeneral from '../settings/components/SectionGeneral'
import { renderWithProviders as render } from './setup'

const mockInvoke = vi.hoisted(() => vi.fn())
const mockPickHostFolder = vi.hoisted(() => vi.fn())

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({ invoke: mockInvoke }),
}))

vi.mock('../lib/hostBridge', () => ({
  pickHostFolder: (...args: unknown[]) => mockPickHostFolder(...args),
}))

describe('SectionGeneral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_workspace_path') return Promise.resolve('/Users/francis/Documents/journal')
      if (cmd === 'set_workspace_path') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
    mockPickHostFolder.mockResolvedValue(null)
  })

  it('persists workspace changes only after save is clicked', async () => {
    render(<SectionGeneral />)

    const input = await screen.findByDisplayValue('/Users/francis/Documents/journal')
    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement

    expect(saveButton.disabled).toBe(true)

    fireEvent.change(input, { target: { value: '/Users/francis/Documents/journal-next' } })

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(saveButton.disabled).toBe(false)
    const setCallsBefore = mockInvoke.mock.calls.filter((c) => c[0] === 'set_workspace_path')
    expect(setCallsBefore).toHaveLength(0)

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_workspace_path', {
        path: '/Users/francis/Documents/journal-next',
      })
    })

    expect(await screen.findByText('已保存')).toBeTruthy()
  })
})
