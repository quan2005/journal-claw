import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from './setup'
import SkillsWorkbench from '../components/SkillsWorkbench'
import type { SkillInfo } from '../lib/apiTypes'

const mockInvoke = vi.hoisted(() => vi.fn())

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({ invoke: mockInvoke }),
}))

const skills: SkillInfo[] = [
  {
    id: 'builtin:journal',
    name: 'journal',
    description: '整理日志',
    scope: 'builtin',
    dir_name: 'journal',
    triggers: [{ kind: 'slash', label: '/journal' }],
    output: null,
    loads: [],
    enabled: true,
    shadowed_by: null,
  },
  {
    id: 'global:writing',
    name: 'writing',
    description: '写作辅助',
    scope: 'global',
    dir_name: 'writing',
    triggers: [],
    output: null,
    loads: [],
    enabled: true,
    shadowed_by: null,
  },
]

describe('SkillsWorkbench', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, val: string) => {
          store[key] = val
        },
        removeItem: (key: string) => {
          delete store[key]
        },
        clear: () => {
          Object.keys(store).forEach((key) => delete store[key])
        },
        get length() {
          return Object.keys(store).length
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
      },
      writable: true,
    })
    vi.clearAllMocks()
    localStorage.clear()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_skills') return Promise.resolve(skills)
      return Promise.resolve(undefined)
    })
  })

  it('renders the existing skill list instead of an empty canvas when favorites are empty', async () => {
    const { container } = renderWithProviders(<SkillsWorkbench />)

    expect(await screen.findByText('journal')).toBeTruthy()
    expect(screen.getByText('writing')).toBeTruthy()
    expect(screen.getByText('还没有收藏。点击技能卡片上的星标即可固定到这里。')).toBeTruthy()
    expect(container.querySelector('.sk-grid')).toBeTruthy()
    expect(screen.queryByText('暂无收藏')).toBeNull()
    expect(screen.getAllByRole('button', { name: '收藏' }).length).toBeGreaterThan(0)
  })
})
