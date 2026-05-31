import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { CalendarDays, Check, Link2, MessageSquare, MoreHorizontal, Plus } from 'lucide-react'
import { useTranslation } from '../contexts/I18nContext'
import { useTodoContext } from '../contexts/TodoContext'
import { pickFolder } from '../lib/tauri'
import type { TodoItem } from '../types'
import { DatePicker, formatDueShort } from './TodoSidebar'

export type IdeasFilter = 'all' | 'discussed' | 'due' | 'done'

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
    discussed: todos.filter((item) => !!item.session_id).length,
    due: todos.filter((item) => !item.done && !!item.due).length,
    done: todos.filter((item) => item.done).length,
    total: todos.length,
  }
}

export function filterIdeas(todos: TodoItem[], filter: IdeasFilter) {
  switch (filter) {
    case 'discussed':
      return todos.filter((item) => !!item.session_id)
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

export function IdeasWorkbench({ onOpenConversation, onNavigateToSource }: IdeasWorkbenchProps) {
  const { t } = useTranslation()
  const todoContext = useTodoContext()
  const [activeFilter, setActiveFilter] = useState<IdeasFilter>('all')
  const [drafting, setDrafting] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [contextMenu, setContextMenu] = useState<IdeasContextMenuState | null>(null)

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

  const stats = useMemo(() => getIdeaStats(todoContext.todos), [todoContext.todos])
  const visibleTodos = useMemo(
    () => filterIdeas(todoContext.todos, activeFilter),
    [activeFilter, todoContext.todos],
  )

  const submitDraft = async () => {
    const text = draftText.trim()
    if (!text) {
      setDrafting(false)
      setDraftText('')
      return
    }
    await todoContext.addTodo(text)
    setDrafting(false)
    setDraftText('')
  }

  const tabs: Array<{ id: IdeasFilter; label: string; count: number }> = [
    { id: 'all', label: '全部', count: stats.open },
    { id: 'discussed', label: '已探讨', count: stats.discussed },
    { id: 'due', label: '有截止日期', count: stats.due },
    { id: 'done', label: '已完成', count: stats.done },
  ]

  return (
    <div className="ideas-workbench">
      <header className="ideas-workbench-header">
        <div>
          <div className="ideas-workbench-eyebrow">IDEAS</div>
          <h2 className="ideas-workbench-title">{t('todo')}</h2>
          <div className="ideas-workbench-summary">
            捕捉阅读和会议中产生的下一步思考。按处理状态筛选，保持轻量扫描。
          </div>
        </div>
        <div className="ideas-workbench-actions">
          <div className="ideas-workbench-stats" aria-label="想法处理状态统计">
            <span aria-label={`${stats.open} 未完成`}>
              <strong>{stats.open}</strong> 未完成
            </span>
            <span aria-label={`${stats.discussed} 已探讨`}>
              <strong>{stats.discussed}</strong> 已探讨
            </span>
            <span aria-label={`${stats.due} 有截止日期`}>
              <strong>{stats.due}</strong> 有截止日期
            </span>
          </div>
          <button
            type="button"
            className="ideas-workbench-button ideas-workbench-button-primary"
            onClick={() => setDrafting(true)}
          >
            <Plus aria-hidden="true" size={17} strokeWidth={1.8} />
            <span>新建想法</span>
          </button>
        </div>
      </header>

      <nav className="ideas-workbench-tabs" aria-label="想法筛选">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ideas-workbench-tab${activeFilter === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveFilter(tab.id)}
          >
            {tab.label} <span>{tab.count}</span>
          </button>
        ))}
      </nav>

      <main className="ideas-workbench-main">
        <div className="ideas-workbench-section-head">
          <h3 className="ideas-workbench-section-title">
            {activeFilter === 'done' ? '已完成' : '待处理'}
          </h3>
          <div className="ideas-workbench-count">
            {visibleTodos.length} of {activeFilter === 'done' ? stats.done : stats.open}
          </div>
        </div>

        <div className="ideas-workbench-list">
          {drafting && (
            <div className="ideas-workbench-draft">
              <input
                aria-label="新想法内容"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submitDraft()
                  if (event.key === 'Escape') {
                    setDrafting(false)
                    setDraftText('')
                  }
                }}
                onBlur={() => void submitDraft()}
                placeholder={t('addTodo')}
                autoFocus
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
            visibleTodos.map((item, index) => (
              <IdeasRow
                key={`${item.done_file ? 'done' : 'todo'}-${item.line_index}`}
                item={item}
                index={index + 1}
                onOpenConversation={onOpenConversation}
                onNavigateToSource={onNavigateToSource}
                onContextMenu={setContextMenu}
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
        />
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
        </div>
      ))}
    </>
  )
}

function IdeasRow({
  item,
  index,
  onOpenConversation,
  onNavigateToSource,
  onContextMenu,
}: {
  item: TodoItem
  index: number
  onOpenConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToSource?: (filename: string) => void
  onContextMenu: (state: IdeasContextMenuState) => void
}) {
  const todoContext = useTodoContext()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editingText, setEditingText] = useState(item.text)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerPos, setDatePickerPos] = useState({ x: 0, y: 0 })
  const rowRef = useRef<HTMLDivElement>(null)

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
    setDatePickerPos({ x: rect.right - 210, y: rect.bottom + 4 })
    setShowDatePicker(true)
  }

  const sourceLabel = ideaSourceLabel(item)

  return (
    <div
      ref={rowRef}
      className={`ideas-workbench-row${item.done ? ' is-done' : ''}`}
      role="row"
      aria-label={item.text}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu({ x: event.clientX, y: event.clientY, item })
      }}
    >
      <span className="ideas-workbench-index">{index}</span>
      <span className="ideas-workbench-complete-wrap">
        <button
          type="button"
          className="ideas-workbench-complete"
          aria-label={`${item.done ? '恢复' : '完成'}：${item.text}`}
          onClick={() => void todoContext.toggleTodo(item.line_index, !item.done, item.done_file)}
        >
          <Check aria-hidden="true" size={14} strokeWidth={2} />
        </button>
      </span>

      <span className="ideas-workbench-row-main">
        {editing ? (
          <input
            aria-label="编辑想法"
            className="ideas-workbench-edit-input"
            value={editingText}
            onChange={(event) => setEditingText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitText()
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
            <span className="ideas-workbench-row-meta">
              {item.session_id ? '已关联探讨' : '未探讨'} · {sourceLabel}
            </span>
          </button>
        )}
      </span>

      <span className={`ideas-workbench-pill${item.session_id ? ' is-accent' : ''}`}>
        {item.session_id ? '已探讨' : item.done ? '已完成' : '未探讨'}
      </span>

      <button
        type="button"
        className="ideas-workbench-source"
        aria-label={`打开来源：${sourceLabel}`}
        onClick={() => {
          if (item.source) onNavigateToSource?.(item.source)
        }}
        disabled={!item.source}
      >
        <Link2 aria-hidden="true" size={13} strokeWidth={1.8} />
        <span>{sourceLabel}</span>
      </button>

      <button
        type="button"
        className="ideas-workbench-due"
        aria-label={`${item.due ? '修改截止日期' : '设置截止日期'}：${item.text}`}
        onClick={openDatePicker}
      >
        <CalendarDays aria-hidden="true" size={13} strokeWidth={1.8} />
        <span>{ideaDueLabel(item)}</span>
      </button>

      <button
        type="button"
        className="ideas-workbench-icon-button ideas-workbench-discuss-button"
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

      <button
        type="button"
        className="ideas-workbench-icon-button ideas-workbench-more-button"
        aria-label={`更多操作：${item.text}`}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          onContextMenu({ x: rect.right - 180, y: rect.bottom + 4, item })
        }}
      >
        <MoreHorizontal aria-hidden="true" size={15} strokeWidth={1.8} />
      </button>

      {showDatePicker && (
        <div
          className="ideas-workbench-date-popover"
          style={{ left: datePickerPos.x, top: datePickerPos.y }}
        >
          <DatePicker
            initialValue={item.due}
            onSelect={(date) => {
              void todoContext.setTodoDue(item.line_index, date, item.done_file)
              setShowDatePicker(false)
            }}
            onClose={() => setShowDatePicker(false)}
          />
        </div>
      )}
    </div>
  )
}

function IdeasContextMenu({
  state,
  onClose,
  onOpenConversation,
}: {
  state: IdeasContextMenuState
  onClose: () => void
  onOpenConversation?: (opts: IdeaConversationRequest) => void
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
    <div
      className="ideas-workbench-menu"
      role="menu"
      style={{ left: state.x, top: state.y }}
    >
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
      {menuItem(t('copyText'), () => navigator.clipboard.writeText(item.text))}
      {item.due &&
        menuItem(t('clearDueDate'), () =>
          todoContext.setTodoDue(item.line_index, null, item.done_file),
        )}
      {!item.done_file &&
        menuItem(t('setPath'), async () => {
          const picked = await pickFolder()
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
      {menuItem(t('deleteTodo'), () => todoContext.deleteTodo(item.line_index, item.done_file), true)}
    </div>
  )
}
