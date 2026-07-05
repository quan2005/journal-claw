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

describe('AutomationWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows user automations first and keeps templates visible as the creation library', async () => {
    renderWithProviders(<AutomationWorkbench onOpenConversation={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '自动化' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建自动化' })).toBeTruthy()
    expect(screen.getByLabelText('1 已启用')).toBeTruthy()
    expect(screen.getByLabelText('0 已暂停')).toBeTruthy()
    expect(screen.getByLabelText('2 模板')).toBeTruthy()
    expect(screen.queryByText('ACTIVE')).toBeNull()
    expect(screen.queryByText('PAUSED')).toBeNull()
    expect(screen.queryByText('TEMPLATES')).toBeNull()

    expect(screen.getByRole('heading', { name: '你的自动化' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '自动化：每日总结，每天 08:00' })).toBeTruthy()

    expect(screen.getByRole('heading', { name: '模板' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '全部 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '总结 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '使用模板：日志库整理' })).toBeTruthy()

    expect(screen.queryByRole('heading', { name: '新建自动化' })).toBeNull()
    expect(screen.queryByText('运行状态')).toBeNull()
    expect(screen.queryByText('Prompt')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '使用模板：日志库整理' }))
    })

    expect(screen.getByRole('heading', { name: '新建自动化' })).toBeTruthy()
    expect(screen.getByDisplayValue('日志库整理')).toBeTruthy()
  })
})
