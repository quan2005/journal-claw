import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AtMentionMenu } from '../components/AtMentionMenu'
import { renderWithProviders } from './setup'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: mocks.invoke,
    subscribe: () => () => {},
  }),
}))

describe('AtMentionMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn()
    }
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_at_mention_candidates') {
        return [
          {
            name: '犀利教授',
            is_dir: false,
            path: 'identities/研究-犀利教授.md',
            mtime_secs: 0,
            kind: 'expert',
            insert_text: null,
            summary: '观点犀利',
            tags: ['专家'],
          },
        ]
      }
      return []
    })
  })

  it('shows and selects expert candidates', async () => {
    const onSelect = vi.fn()

    renderWithProviders(<AtMentionMenu query="教授" onSelect={onSelect} onClose={vi.fn()} />)

    expect(await screen.findByText('犀利教授')).toBeTruthy()
    expect(screen.getByText('专家')).toBeTruthy()

    fireEvent.click(screen.getByText('犀利教授'))

    expect(onSelect).toHaveBeenCalledWith('identities/研究-犀利教授.md')
  })

  it('uses insert_text for the clear expert control', async () => {
    const onSelect = vi.fn()
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_at_mention_candidates') {
        return [
          {
            name: '清除专家视角',
            is_dir: false,
            path: '__experts__/clear',
            mtime_secs: 0,
            kind: 'expert',
            insert_text: '清除专家',
            summary: '发送后移除当前会话里的专家视角',
            tags: ['专家'],
          },
        ]
      }
      return []
    })

    renderWithProviders(<AtMentionMenu query="清除" onSelect={onSelect} onClose={vi.fn()} />)

    fireEvent.click(await screen.findByText('清除专家视角'))

    expect(onSelect).toHaveBeenCalledWith('清除专家')
  })
})
