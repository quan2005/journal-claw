import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { CalendarDays, Link2, MessageSquare, Plus } from 'lucide-react'
import { useTranslation } from '../contexts/I18nContext'
import { useTodoContext } from '../contexts/TodoContext'
import { pickHostFolder } from '../lib/hostBridge'
import type { TodoItem } from '../types'
import { DatePicker, formatDueShort } from './TodoSidebar'

export type IdeasFilter = 'all' | 'pendingDiscussion' | 'due' | 'done'

export interface IdeaConversationRequest {
  mode: 'chat'
  context: string
  sessionId: string | null
  lineIndex: number
  doneFile: boolean
}

interface IdeasContextMenuState {
  x: number
  y: number
  item: TodoItem
}

export interface IdeasWorkbenchProps {
  onOpenConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToSource?: (filename: string) => void
}

export function getIdeaStats(todos: TodoItem[]) {
  return {
    open: todos.filter((item) => !item.done).length,
    pendingDiscussion: todos.filter((item) => !item.done && !item.session_id).length,
    due: todos.filter((item) => !item.done && !!item.due).length,
    done: todos.filter((item) => item.done).length,
    total: todos.length,
  }
}

export function filterIdeas(todos: TodoItem[], filter: IdeasFilter) {
  switch (filter) {
    case 'pendingDiscussion':
      return todos.filter((item) => !item.done && !item.session_id)
    case 'due':
      return todos.filter((item) => !item.done && !!item.due)
    case 'done':
      return todos.filter((item) => item.done)
    case 'all':
      return todos.filter((item) => !item.done)
  }
}

export function ideaSourceLabel(item: TodoItem) {
  return item.source ?? item.path ?? '收件箱'
}

export function ideaDueLabel(item: TodoItem) {
  if (item.due) return formatDueShort(item.due)
  if (item.done && item.done_date) return item.done_date
  return '无截止'
}

type IdeaStats = ReturnType<typeof getIdeaStats>

const IDEAS_TABS: {
  key: IdeasFilter
  label: string
  countFor: (stats: IdeaStats) => number
}[] = [
  { key: 'all', label: '全部（未完成）', countFor: (s) => s.open },
  {
    key: 'pendingDiscussion',
    label: '待探讨（未完成且未探讨）',
    countFor: (s) => s.pendingDiscussion,
  },
  { key: 'due', label: '有截止日期（未完成）', countFor: (s) => s.due },
  { key: 'done', label: '已完成', countFor: (s) => s.done },
]

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = 'auto'
  const style = window.getComputedStyle(element)
  const borderHeight =
    (Number.parseFloat(style.borderTopWidth) || 0) +
    (Number.parseFloat(style.borderBottomWidth) || 0)
  element.style.height = `${element.scrollHeight + borderHeight}px`
}

function IdeaCompleteIcon() {
  return (
    <svg
      className="ideas-workbench-complete-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="ideas-workbench-complete-check" d="M9 11l3 3L22 4" />
      <path
        className="ideas-workbench-complete-box"
        d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
      />
    </svg>
  )
}

export function IdeasWorkbench({ onOpenConversation, onNavigateToSource }: IdeasWorkbenchProps) {
  const { t } = useTranslation()
  const todoContext = useTodoContext()
  const [draftText, setDraftText] = useState('')
  const [filter, setFilter] = useState<IdeasFilter>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [contextMenu, setContextMenu] = useState<IdeasContextMenuState | null>(null)
  const [datePicker, setDatePicker] = useState<IdeasContextMenuState | null>(null)
  const draftRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [contextMenu])

  useLayoutEffect(() => {
    resizeTextarea(draftRef.current)
  }, [draftText])

  const stats = useMemo(() => getIdeaStats(todoContext.todos), [todoContext.todos])

  const visibleTodos = useMemo(
    () => filterIdeas(todoContext.todos, filter),
    [todoContext.todos, filter],
  )

  const submitDraft = async () => {
    const text = draftText.trim()
    if (!text) return
    await todoContext.addTodo(text)
    setDraftText('')
    setIsCreating(false)
  }

  return (
    <div className="ideas-workbench">
      <header className="ideas-workbench-header">
        <div className="ideas-workbench-eyebrow">IDEAS</div>
        <h2 className="ideas-workbench-title">{t('todo')}</h2>
        <p className="ideas-workbench-summary">
          捕捉阅读和会议中产生的下一步思考。按处理状态筛选，保持轻量扫描；需要推进时，再补上探讨状态或截止日期。
        </p>
      </header>

      <div className="ideas-workbench-tabs">
        {IDEAS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`ideas-workbench-tab${filter === tab.key ? ' is-active' : ''}`}
            aria-label={`${tab.label} ${tab.countFor(stats)}`}
            aria-pressed={filter === tab.key}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
            <span>{tab.countFor(stats)}</span>
          </button>
        ))}
        <span className="ideas-workbench-tabs-spacer" aria-hidden="true" />
        <button
          type="button"
          className="ideas-workbench-button ideas-workbench-button-primary"
          onClick={() => setIsCreating(true)}
        >
          <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
          新建想法
        </button>
      </div>

      <main className="ideas-workbench-main">
        <div className="ideas-workbench-list">
          {isCreating && (
            <div className="ideas-workbench-draft">
              <textarea
                ref={draftRef}
                aria-label="新想法内容"
                value={draftText}
                rows={1}
                placeholder={t('addTodo')}
                autoFocus
                onChange={(event) => {
                  setDraftText(event.target.value)
                  resizeTextarea(event.currentTarget)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    void submitDraft()
                  }
                }}
              />
            </div>
          )}
          {todoContext.loading ? (
            <IdeasLoadingRows />
          ) : visibleTodos.length === 0 ? (
            <div className="ideas-workbench-empty">
              <span className="ideas-workbench-empty-icon">+</span>
              <span>
                <span className="ideas-workbench-row-title">还没有想法</span>
                <span className="ideas-workbench-row-meta">从阅读、会议或临时念头开始记录。</span>
              </span>
            </div>
          ) : (
            visibleTodos.map((item) => (
              <IdeasRow
                key={`${item.done_file ? 'done' : 'todo'}-${item.line_index}`}
                item={item}
                onOpenConversation={onOpenConversation}
                onNavigateToSource={onNavigateToSource}
                onContextMenu={setContextMenu}
                onOpenDuePicker={setDatePicker}
              />
            ))
          )}
        </div>
      </main>

      {contextMenu && (
        <IdeasContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onOpenConversation={onOpenConversation}
          onNavigateToSource={onNavigateToSource}
          onOpenDuePicker={setDatePicker}
        />
      )}

      {datePicker && (
        <div
          className="ideas-workbench-date-popover"
          style={{ left: datePicker.x, top: datePicker.y }}
        >
          <DatePicker
            initialValue={datePicker.item.due}
            onSelect={(date) => {
              void todoContext.setTodoDue(
                datePicker.item.line_index,
                date,
                datePicker.item.done_file,
              )
              setDatePicker(null)
            }}
            onClose={() => setDatePicker(null)}
          />
        </div>
      )}
    </div>
  )
}

function IdeasLoadingRows() {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <div key={row} className="ideas-workbench-row ideas-workbench-row-skeleton">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </>
  )
}

function IdeasRow({
  item,
  onOpenConversation,
  onNavigateToSource,
  onContextMenu,
  onOpenDuePicker,
}: {
  item: TodoItem
  onOpenConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToSource?: (filename: string) => void
  onContextMenu: (state: IdeasContextMenuState) => void
  onOpenDuePicker: (state: IdeasContextMenuState) => void
}) {
  const todoContext = useTodoContext()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editingText, setEditingText] = useState(item.text)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (editing) resizeTextarea(editorRef.current)
  }, [editing, editingText])

  const submitText = async () => {
    const text = editingText.trim()
    if (!text) {
      await todoContext.deleteTodo(item.line_index, item.done_file)
    } else if (text !== item.text) {
      await todoContext.updateTodoText(item.line_index, text, item.done_file)
    }
    setEditing(false)
  }

  const openDatePicker = (event: MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    onOpenDuePicker({ x: rect.right - 210, y: rect.bottom + 4, item })
  }

  const sourceLabel = ideaSourceLabel(item)

  return (
    <div
      className={`ideas-workbench-row${item.done ? ' is-done' : ''}${editing ? ' is-editing' : ''}`}
      role="row"
      aria-label={item.text}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu({ x: event.clientX, y: event.clientY, item })
      }}
    >
      <span className="ideas-workbench-complete-wrap">
        <button
          type="button"
          className="ideas-workbench-complete"
          aria-label={`${item.done ? '恢复' : '完成'}：${item.text}`}
          onClick={() => void todoContext.toggleTodo(item.line_index, !item.done, item.done_file)}
        >
          <IdeaCompleteIcon />
        </button>
      </span>

      <span className="ideas-workbench-row-main">
        {editing ? (
          <textarea
            ref={editorRef}
            aria-label="编辑想法"
            className="ideas-workbench-edit-input"
            value={editingText}
            rows={1}
            onChange={(event) => {
              setEditingText(event.target.value)
              resizeTextarea(event.currentTarget)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void submitText()
              }
              if (event.key === 'Escape') {
                setEditingText(item.text)
                setEditing(false)
              }
            }}
            onBlur={() => void submitText()}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="ideas-workbench-text-button"
            aria-label={`编辑：${item.text}`}
            onDoubleClick={() => setEditing(true)}
            onClick={() => setEditing(true)}
          >
            <span className="ideas-workbench-row-title">{item.text}</span>
          </button>
        )}
      </span>

      <button
        type="button"
        className="ideas-workbench-source"
        aria-label={`打开来源：${sourceLabel}`}
        title={sourceLabel}
        onClick={() => {
          if (item.source) onNavigateToSource?.(item.source)
        }}
        disabled={!item.source}
      >
        <Link2 aria-hidden="true" size={13} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        className="ideas-workbench-due"
        aria-label={`${item.due ? '修改截止日期' : '设置截止日期'}：${item.text}`}
        title={ideaDueLabel(item)}
        onClick={openDatePicker}
      >
        <CalendarDays aria-hidden="true" size={13} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        className={`ideas-workbench-icon-button ideas-workbench-discuss-button${item.session_id ? ' is-discussed' : ''}`}
        aria-label={item.session_id ? `继续探讨：${item.text}` : `开始探讨：${item.text}`}
        title={item.session_id ? t('hasDiscussion') : t('startDiscussion')}
        onClick={() =>
          onOpenConversation?.({
            mode: 'chat',
            context: item.text,
            sessionId: item.session_id,
            lineIndex: item.line_index,
            doneFile: item.done_file,
          })
        }
      >
        <MessageSquare aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
    </div>
  )
}

function IdeasContextMenu({
  state,
  onClose,
  onOpenConversation,
  onNavigateToSource,
  onOpenDuePicker,
}: {
  state: IdeasContextMenuState
  onClose: () => void
  onOpenConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToSource?: (filename: string) => void
  onOpenDuePicker: (state: IdeasContextMenuState) => void
}) {
  const todoContext = useTodoContext()
  const { t } = useTranslation()
  const { item } = state

  const menuItem = (label: string, onClick: () => void | Promise<void>, danger = false) => (
    <button
      type="button"
      role="menuitem"
      className={`ideas-workbench-menu-item${danger ? ' is-danger' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        void Promise.resolve(onClick()).finally(onClose)
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="ideas-workbench-menu" role="menu" style={{ left: state.x, top: state.y }}>
      {menuItem(item.done ? '恢复' : '完成', () =>
        todoContext.toggleTodo(item.line_index, !item.done, item.done_file),
      )}
      {!item.done_file &&
        menuItem(t('exploreInDepth'), () =>
          onOpenConversation?.({
            mode: 'chat',
            context: item.text,
            sessionId: item.session_id,
            lineIndex: item.line_index,
            doneFile: item.done_file,
          }),
        )}
      {item.source && menuItem('打开来源', () => onNavigateToSource?.(item.source!))}
      {!item.done_file &&
        menuItem(item.due ? '修改截止日期' : '设置截止日期', () => onOpenDuePicker(state))}
      {menuItem(t('copyText'), () => navigator.clipboard.writeText(item.text))}
      {item.due &&
        menuItem(t('clearDueDate'), () =>
          todoContext.setTodoDue(item.line_index, null, item.done_file),
        )}
      {!item.done_file &&
        menuItem(t('setPath'), async () => {
          const picked = await pickHostFolder()
          if (picked) {
            const homePath = picked.replace(/^\/Users\/[^/]+/, '~')
            await todoContext.setTodoPath(item.line_index, homePath, item.done_file)
          }
        })}
      {!item.done_file &&
        item.path &&
        menuItem(t('removePath'), () =>
          todoContext.removeTodoPath(item.line_index, item.done_file),
        )}
      <div className="ideas-workbench-menu-divider" />
      {menuItem(
        t('deleteTodo'),
        () => todoContext.deleteTodo(item.line_index, item.done_file),
        true,
      )}
    </div>
  )
}
