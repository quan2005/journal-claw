import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

import {
  revealInFileManager,
  openSettings,
  getApiKey,
  setApiKey,
  getWorkspacePath,
  setWorkspacePath,
  getWorkspaceTheme,
  setWorkspaceTheme,
  listAvailableMonths,
  listJournalEntriesByMonths,
  listAllJournalEntries,
  getJournalEntryContent,
  deleteJournalEntry,
  importFile,
  importTextTemp,
  importText,
  importImageTemp,
  importAudioFile,
  triggerAiProcessing,
  triggerAiPrompt,
  cancelAiProcessing,
  cancelQueuedItem,
  submitPasteText,
  getWorkspacePrompt,
  setWorkspacePrompt,
  resetWorkspacePrompt,
  openFile,
  getAppVersion,
  getPlatformCapabilities,
  getEngineConfig,
  setEngineConfig,
  createSampleEntryIfNeeded,
  createSampleEntry,
  requestPermission,
  checkAppPermissions,
  openPrivacySettings,
  listIdentities,
  getIdentityContent,
  saveIdentityContent,
  deleteIdentity,
  createIdentity,
  mergeIdentity,
  listTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  setTodoDue,
  setTodoPath,
  removeTodoPath,
  updateTodoText,
  getAutoLintConfig,
  setAutoLintConfig,
  getAutoLintStatus,
  triggerLintNow,
  getGlobalSkillsEnabled,
  setGlobalSkillsEnabled,
  listAutomationTemplates,
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  pauseRoutine,
  resumeRoutine,
  runRoutineNow,
  listRoutineRuns,
  getAutomationRun,
  getFeishuConfig,
  setFeishuConfig,
  getFeishuStatus,
  listSkills,
  openSkillsDir,
  setSkillEnabled,
  setGlobalSkillEnabled,
  listWorkspaceDir,
  listAtMentionCandidates,
  workspaceDuplicateFile,
  workspaceRenameFile,
  workspaceMoveFile,
  workspaceDeleteFile,
  type EngineConfig,
  type AutoLintConfig,
  type FeishuConfig,
  type CreateRoutineRequest,
} from '../lib/tauri'

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).__JOURNAL_RUNTIME = 'tauri'
  vi.clearAllMocks()
  mockInvoke.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// No-param commands (batch)
// ---------------------------------------------------------------------------
const noParamCases: [string, () => Promise<unknown>, string][] = [
  ['openSettings', openSettings, 'open_settings'],
  ['getApiKey', getApiKey, 'get_api_key'],
  ['getWorkspacePath', getWorkspacePath, 'get_workspace_path'],
  ['getWorkspaceTheme', getWorkspaceTheme, 'get_workspace_theme'],
  ['listAvailableMonths', listAvailableMonths, 'list_available_months'],
  ['listAllJournalEntries', listAllJournalEntries, 'list_all_journal_entries'],
  ['getWorkspacePrompt', getWorkspacePrompt, 'get_workspace_prompt'],
  ['resetWorkspacePrompt', resetWorkspacePrompt, 'reset_workspace_prompt'],
  ['cancelAiProcessing', cancelAiProcessing, 'cancel_ai_processing'],
  ['getAppVersion', getAppVersion, 'get_app_version'],
  ['getPlatformCapabilities', getPlatformCapabilities, 'get_platform_capabilities'],
  ['getEngineConfig', getEngineConfig, 'get_engine_config'],
  ['createSampleEntryIfNeeded', createSampleEntryIfNeeded, 'create_sample_entry_if_needed'],
  ['createSampleEntry', createSampleEntry, 'create_sample_entry'],
  ['checkAppPermissions', checkAppPermissions, 'check_app_permissions'],
  ['listIdentities', listIdentities, 'list_identities'],
  ['listTodos', listTodos, 'list_todos'],
  ['getAutoLintConfig', getAutoLintConfig, 'get_auto_lint_config'],
  ['getAutoLintStatus', getAutoLintStatus, 'get_auto_lint_status'],
  ['triggerLintNow', triggerLintNow, 'trigger_lint_now'],
  ['listAutomationTemplates', listAutomationTemplates, 'list_automation_templates'],
  ['listRoutines', listRoutines, 'list_routines'],
  ['getFeishuConfig', getFeishuConfig, 'get_feishu_config'],
  ['getFeishuStatus', getFeishuStatus, 'get_feishu_status'],
  ['listSkills', listSkills, 'list_skills'],
  ['getGlobalSkillsEnabled', getGlobalSkillsEnabled, 'get_global_skills_enabled'],
]

describe('no-param commands', () => {
  it.each(noParamCases)('%s → %s', async (_name, fn, cmd) => {
    await fn()
    expect(mockInvoke).toHaveBeenCalledOnce()
    expect(mockInvoke).toHaveBeenCalledWith(cmd)
  })
})

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
describe('Files', () => {
  it('revealInFileManager passes { path }', async () => {
    await revealInFileManager('/tmp/audio.m4a')
    expect(mockInvoke).toHaveBeenCalledWith('reveal_in_file_manager', { path: '/tmp/audio.m4a' })
  })
})

// ---------------------------------------------------------------------------
// Settings / Config
// ---------------------------------------------------------------------------
describe('Settings / Config', () => {
  it('setApiKey passes { key }', async () => {
    await setApiKey('sk-test')
    expect(mockInvoke).toHaveBeenCalledWith('set_api_key', { key: 'sk-test' })
  })

  it('setWorkspacePath passes { path }', async () => {
    await setWorkspacePath('/tmp/ws')
    expect(mockInvoke).toHaveBeenCalledWith('set_workspace_path', { path: '/tmp/ws' })
  })

  it('setWorkspaceTheme passes { theme }', async () => {
    await setWorkspaceTheme('dark')
    expect(mockInvoke).toHaveBeenCalledWith('set_workspace_theme', { theme: 'dark' })
  })
})

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------
describe('Journal', () => {
  it('listJournalEntriesByMonths passes { months }', async () => {
    await listJournalEntriesByMonths(['2603', '2604'])
    expect(mockInvoke).toHaveBeenCalledWith('list_journal_entries_by_months', {
      months: ['2603', '2604'],
    })
  })

  it('getJournalEntryContent passes { path }', async () => {
    await getJournalEntryContent('/ws/2603/01-test.md')
    expect(mockInvoke).toHaveBeenCalledWith('get_journal_entry_content', {
      path: '/ws/2603/01-test.md',
    })
  })

  it('deleteJournalEntry passes { path }', async () => {
    await deleteJournalEntry('/ws/2603/01-test.md')
    expect(mockInvoke).toHaveBeenCalledWith('delete_journal_entry', { path: '/ws/2603/01-test.md' })
  })
})

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
describe('Materials', () => {
  it('importFile passes { srcPath }', async () => {
    await importFile('/tmp/doc.pdf')
    expect(mockInvoke).toHaveBeenCalledWith('import_file', { srcPath: '/tmp/doc.pdf' })
  })

  it('importTextTemp passes { text }', async () => {
    await importTextTemp('hello')
    expect(mockInvoke).toHaveBeenCalledWith('import_text_temp', { text: 'hello' })
  })

  it('importText passes { text }', async () => {
    await importText('hello')
    expect(mockInvoke).toHaveBeenCalledWith('import_text', { text: 'hello' })
  })

  it('importImageTemp passes { data, mediaType }', async () => {
    await importImageTemp('abc123', 'image/png')
    expect(mockInvoke).toHaveBeenCalledWith('import_image_temp', {
      data: 'abc123',
      mediaType: 'image/png',
    })
  })

  it('importAudioFile is alias for import_file', async () => {
    await importAudioFile('/tmp/audio.m4a')
    expect(mockInvoke).toHaveBeenCalledWith('import_file', { srcPath: '/tmp/audio.m4a' })
  })
})

// ---------------------------------------------------------------------------
// AI Processing
// ---------------------------------------------------------------------------
describe('AI Processing', () => {
  it('triggerAiProcessing defaults note to null', async () => {
    await triggerAiProcessing('/tmp/raw/f.txt', '2604')
    expect(mockInvoke).toHaveBeenCalledWith('trigger_ai_processing', {
      materialPath: '/tmp/raw/f.txt',
      yearMonth: '2604',
      note: null,
    })
  })

  it('triggerAiProcessing passes note when provided', async () => {
    await triggerAiProcessing('/tmp/raw/f.txt', '2604', 'a note')
    expect(mockInvoke).toHaveBeenCalledWith('trigger_ai_processing', {
      materialPath: '/tmp/raw/f.txt',
      yearMonth: '2604',
      note: 'a note',
    })
  })

  it('triggerAiPrompt passes { prompt }', async () => {
    await triggerAiPrompt('summarize')
    expect(mockInvoke).toHaveBeenCalledWith('trigger_ai_prompt', { prompt: 'summarize' })
  })

  it('cancelQueuedItem passes { materialPath }', async () => {
    await cancelQueuedItem('/tmp/raw/f.txt')
    expect(mockInvoke).toHaveBeenCalledWith('cancel_queued_item', {
      materialPath: '/tmp/raw/f.txt',
    })
  })

  it('submitPasteText calls import_text then trigger_ai_processing', async () => {
    mockInvoke
      .mockResolvedValueOnce({ path: '/ws/raw/p.txt', filename: 'p.txt', year_month: '2604' })
      .mockResolvedValueOnce(undefined)

    await submitPasteText('pasted')

    expect(mockInvoke).toHaveBeenCalledTimes(2)
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'import_text', { text: 'pasted' })
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'trigger_ai_processing', {
      materialPath: '/ws/raw/p.txt',
      yearMonth: '2604',
      note: null,
    })
  })
})

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------
describe('Workspace', () => {
  it('setWorkspacePrompt passes { content }', async () => {
    await setWorkspacePrompt('new prompt')
    expect(mockInvoke).toHaveBeenCalledWith('set_workspace_prompt', { content: 'new prompt' })
  })

  it('openFile invokes open_with_system', async () => {
    await openFile('/tmp/f.md')
    expect(mockInvoke).toHaveBeenCalledWith('open_with_system', { path: '/tmp/f.md' })
  })

  it('listWorkspaceDir passes { relativePath }', async () => {
    await listWorkspaceDir('notes')
    expect(mockInvoke).toHaveBeenCalledWith('list_workspace_dir', { relativePath: 'notes' })
  })

  it('listAtMentionCandidates passes { relativePath, query }', async () => {
    await listAtMentionCandidates('', 'ai')
    expect(mockInvoke).toHaveBeenCalledWith('list_at_mention_candidates', {
      relativePath: '',
      query: 'ai',
    })
  })

  it('workspaceDuplicateFile passes { relativePath }', async () => {
    await workspaceDuplicateFile('note.md')
    expect(mockInvoke).toHaveBeenCalledWith('workspace_duplicate_file', { relativePath: 'note.md' })
  })

  it('workspaceRenameFile passes { relativePath, newName }', async () => {
    await workspaceRenameFile('note.md', 'renamed.md')
    expect(mockInvoke).toHaveBeenCalledWith('workspace_rename_file', {
      relativePath: 'note.md',
      newName: 'renamed.md',
    })
  })

  it('workspaceMoveFile passes { relativePath, destDir }', async () => {
    await workspaceMoveFile('note.md', 'dest')
    expect(mockInvoke).toHaveBeenCalledWith('workspace_move_file', {
      relativePath: 'note.md',
      destDir: 'dest',
    })
  })

  it('workspaceDeleteFile passes { relativePath }', async () => {
    await workspaceDeleteFile('note.md')
    expect(mockInvoke).toHaveBeenCalledWith('workspace_delete_file', { relativePath: 'note.md' })
  })
})

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
describe('Engine', () => {
  it('setEngineConfig wraps cfg in { config }', async () => {
    const cfg: EngineConfig = {
      active_provider: 'anthropic',
      providers: [
        {
          protocol: 'anthropic',
          id: 'anthropic',
          label: 'Anthropic',
          api_key: 'sk-ant',
          base_url: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-5',
        },
      ],
    }
    await setEngineConfig(cfg)
    expect(mockInvoke).toHaveBeenCalledWith('set_engine_config', { config: cfg })
  })
})

// Permissions
// ---------------------------------------------------------------------------
describe('Permissions', () => {
  it('requestPermission passes { perm }', async () => {
    await requestPermission('speech_recognition')
    expect(mockInvoke).toHaveBeenCalledWith('request_permission', { perm: 'speech_recognition' })
  })

  it('openPrivacySettings passes { pane }', async () => {
    await openPrivacySettings('speech_recognition')
    expect(mockInvoke).toHaveBeenCalledWith('open_privacy_settings', {
      pane: 'speech_recognition',
    })
  })
})

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
describe('Identity', () => {
  it('getIdentityContent passes { path }', async () => {
    await getIdentityContent('/ws/id/alice.md')
    expect(mockInvoke).toHaveBeenCalledWith('get_identity_content', { path: '/ws/id/alice.md' })
  })

  it('saveIdentityContent passes { path, content }', async () => {
    await saveIdentityContent('/ws/id/alice.md', '# Alice')
    expect(mockInvoke).toHaveBeenCalledWith('save_identity_content', {
      path: '/ws/id/alice.md',
      content: '# Alice',
    })
  })

  it('deleteIdentity passes { path }', async () => {
    await deleteIdentity('/ws/id/alice.md')
    expect(mockInvoke).toHaveBeenCalledWith('delete_identity', { path: '/ws/id/alice.md' })
  })

  it('createIdentity passes all fields', async () => {
    await createIdentity('cn', 'Alice', 'A summary', ['dev'], 'spk-1')
    expect(mockInvoke).toHaveBeenCalledWith('create_identity', {
      region: 'cn',
      name: 'Alice',
      summary: 'A summary',
      tags: ['dev'],
      speakerId: 'spk-1',
    })
  })

  it('mergeIdentity passes { sourcePath, targetPath, mode }', async () => {
    await mergeIdentity('/ws/a.md', '/ws/b.md', 'full')
    expect(mockInvoke).toHaveBeenCalledWith('merge_identity', {
      sourcePath: '/ws/a.md',
      targetPath: '/ws/b.md',
      mode: 'full',
    })
  })
})

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------
describe('Todos', () => {
  it('addTodo defaults optional args to null', async () => {
    await addTodo('buy milk')
    expect(mockInvoke).toHaveBeenCalledWith('add_todo', {
      text: 'buy milk',
      due: null,
      source: null,
      path: null,
    })
  })

  it('addTodo passes provided optional args', async () => {
    await addTodo('buy milk', '2026-04-15', 'meeting', '/ws/2604/01.md')
    expect(mockInvoke).toHaveBeenCalledWith('add_todo', {
      text: 'buy milk',
      due: '2026-04-15',
      source: 'meeting',
      path: '/ws/2604/01.md',
    })
  })

  it('toggleTodo passes { lineIndex, checked, doneFile }', async () => {
    await toggleTodo(3, true, false)
    expect(mockInvoke).toHaveBeenCalledWith('toggle_todo', {
      lineIndex: 3,
      checked: true,
      doneFile: false,
    })
  })

  it('deleteTodo passes { lineIndex, doneFile }', async () => {
    await deleteTodo(5, true)
    expect(mockInvoke).toHaveBeenCalledWith('delete_todo', { lineIndex: 5, doneFile: true })
  })

  it('setTodoDue passes { lineIndex, due, doneFile }', async () => {
    await setTodoDue(2, '2026-05-01', false)
    expect(mockInvoke).toHaveBeenCalledWith('set_todo_due', {
      lineIndex: 2,
      due: '2026-05-01',
      doneFile: false,
    })
  })

  it('setTodoPath passes { lineIndex, path, doneFile }', async () => {
    await setTodoPath(2, '/ws/2604/01.md', false)
    expect(mockInvoke).toHaveBeenCalledWith('set_todo_path', {
      lineIndex: 2,
      path: '/ws/2604/01.md',
      doneFile: false,
    })
  })

  it('removeTodoPath passes { lineIndex, doneFile }', async () => {
    await removeTodoPath(2, false)
    expect(mockInvoke).toHaveBeenCalledWith('remove_todo_path', { lineIndex: 2, doneFile: false })
  })

  it('updateTodoText passes { lineIndex, text, doneFile }', async () => {
    await updateTodoText(2, 'updated', false)
    expect(mockInvoke).toHaveBeenCalledWith('update_todo_text', {
      lineIndex: 2,
      text: 'updated',
      doneFile: false,
    })
  })
})

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Auto Lint
// ---------------------------------------------------------------------------
describe('Auto Lint', () => {
  it('setAutoLintConfig passes { config }', async () => {
    const config: AutoLintConfig = {
      enabled: true,
      frequency: 'weekly',
      time: '03:00',
      min_entries: 20,
    }
    await setAutoLintConfig(config)
    expect(mockInvoke).toHaveBeenCalledWith('set_auto_lint_config', { config })
  })
})

// ---------------------------------------------------------------------------
// Automation
// ---------------------------------------------------------------------------
describe('Automation', () => {
  const request: CreateRoutineRequest = {
    title: '每日总结',
    template_id: 'daily-summary',
    prompt: '总结昨天',
    schedule: { kind: 'daily', time: '08:00', timezone: 'Asia/Hong_Kong' },
    scope: { kind: 'relative', range: 'yesterday' },
    enabled: true,
  }

  it('createRoutine passes { request }', async () => {
    await createRoutine(request)
    expect(mockInvoke).toHaveBeenCalledWith('create_routine', { request })
  })

  it('updateRoutine passes { id, patch }', async () => {
    await updateRoutine('routine_1', { enabled: false })
    expect(mockInvoke).toHaveBeenCalledWith('update_routine', {
      id: 'routine_1',
      patch: { enabled: false },
    })
  })

  it('deleteRoutine passes { id }', async () => {
    await deleteRoutine('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('delete_routine', { id: 'routine_1' })
  })

  it('pauseRoutine passes { id }', async () => {
    await pauseRoutine('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('pause_routine', { id: 'routine_1' })
  })

  it('resumeRoutine passes { id }', async () => {
    await resumeRoutine('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('resume_routine', { id: 'routine_1' })
  })

  it('runRoutineNow passes { id }', async () => {
    await runRoutineNow('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('run_routine_now', { id: 'routine_1' })
  })

  it('listRoutineRuns passes { id }', async () => {
    await listRoutineRuns('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('list_routine_runs', { id: 'routine_1' })
  })

  it('getAutomationRun passes { id }', async () => {
    await getAutomationRun('run_1')
    expect(mockInvoke).toHaveBeenCalledWith('get_automation_run', { id: 'run_1' })
  })
})

// ---------------------------------------------------------------------------
// Feishu
// ---------------------------------------------------------------------------
describe('Feishu', () => {
  it('setFeishuConfig passes { config }', async () => {
    const config: FeishuConfig = { enabled: true, app_id: 'cli_xxx', app_secret: 'secret' }
    await setFeishuConfig(config)
    expect(mockInvoke).toHaveBeenCalledWith('set_feishu_config', { config })
  })
})

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
describe('Skills', () => {
  it('openSkillsDir passes { scope }', async () => {
    await openSkillsDir('project')
    expect(mockInvoke).toHaveBeenCalledWith('open_skills_dir', { scope: 'project' })
  })

  it('setGlobalSkillsEnabled passes { enabled }', async () => {
    await setGlobalSkillsEnabled(true)
    expect(mockInvoke).toHaveBeenCalledWith('set_global_skills_enabled', { enabled: true })
  })

  it('setSkillEnabled passes { skillId, enabled }', async () => {
    await setSkillEnabled('project:journal', false)
    expect(mockInvoke).toHaveBeenCalledWith('set_skill_enabled', {
      skillId: 'project:journal',
      enabled: false,
    })
  })

  it('setGlobalSkillEnabled passes { skillId, enabled }', async () => {
    await setGlobalSkillEnabled('global:writer', true)
    expect(mockInvoke).toHaveBeenCalledWith('set_global_skill_enabled', {
      skillId: 'global:writer',
      enabled: true,
    })
  })
})
