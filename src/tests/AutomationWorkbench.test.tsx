import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from './setup'
import { AutomationWorkbench } from '../components/AutomationWorkbench'
import type { AutomationRoutine, AutomationTemplate } from '../types'

const templates: AutomationTemplate[] = [
  {
    id: 'daily-summary',
    title: '每日总结',
    category: '总结',
    description: '每天读取昨天，生成一篇自动化日志条目。',
    default_prompt: '总结昨天',
    default_schedule: { kind: 'daily', time: '08:00', timezone: 'Asia/Hong_Kong' },
    default_scope: { kind: 'relative', range: 'yesterday' },
    default_context: ['@todos.md'],
  },
  {
    id: 'journal-lint',
    title: '日志库整理',
    category: '维护',
    description: '复用 /lint 规则，定期维护日志库。',
    default_prompt: '运行 /lint',
    default_schedule: { kind: 'weekly', weekday: 0, time: '03:00', timezone: 'Asia/Hong_Kong' },
    default_scope: { kind: 'workspace' },
    default_context: ['@/lint'],
  },
]

const routines: AutomationRoutine[] = [
  {
    id: 'routine_daily',
    title: '每日总结',
    template_id: 'daily-summary',
    prompt: '总结昨天',
    schedule: { kind: 'daily', time: '08:00', timezone: 'Asia/Hong_Kong' },
    scope: { kind: 'relative', range: 'yesterday' },
    enabled: true,
    full_agent_access: true,
    created_at: '2026-05-30T08:00:00+08:00',
    updated_at: '2026-05-30T08:00:00+08:00',
    last_run: null,
  },
]

const automationMock = {
  templates,
  routines,
  runsByRoutine: {},
  loading: false,
  error: null,
  counts: { enabled: 1, failed: 0, total: 1 },
  refresh: vi.fn(),
  loadRuns: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  runNow: vi.fn(),
}

vi.mock('../hooks/useAutomation', () => ({
  useAutomation: () => automationMock,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

describe('AutomationWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps routines as the primary surface and moves templates behind create', async () => {
    renderWithProviders(<AutomationWorkbench onOpenConversation={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '自动化' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建自动化' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /每日总结.*每天 08:00/s })).toBeTruthy()

    expect(screen.queryByText('模板入口')).toBeNull()
    expect(screen.queryByRole('heading', { name: '新建自动化' })).toBeNull()
    expect(screen.queryByText('每天读取昨天，生成一篇自动化日志条目。')).toBeNull()
    expect(screen.queryByText('Prompt')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '新建自动化' }))
    })

    expect(screen.getByRole('heading', { name: '新建自动化' })).toBeTruthy()
    expect(screen.getByText('每天读取昨天，生成一篇自动化日志条目。')).toBeTruthy()
  })
})
