# 日志列表按月分页

默认加载最近 3 个月，底部"加载更多"按钮手动触发加载下一批 3 个月。

## Rust 端

### 新增 command: `list_available_months`

扫描 workspace 下所有 4 位数字目录名，降序排序返回 `Vec<String>`。

```rust
#[tauri::command]
pub async fn list_available_months(app: AppHandle) -> Result<Vec<String>, String>
```

### 新增 command: `list_journal_entries_by_months`

接收月份列表，对每个月调用已有 `list_entries(workspace, ym)`，合并排序后返回。

```rust
#[tauri::command]
pub async fn list_journal_entries_by_months(
    app: AppHandle,
    months: Vec<String>,
) -> Result<Vec<JournalEntry>, String>
```

排序规则与现有 `list_all_journal_entries` 一致：`year_month` 降序 → `day` 降序 → `created_at_secs` 降序。

保留 `list_all_journal_entries` 不动。

### 注册

`main.rs` 的 `invoke_handler` 追加两个新 command。

## 前端

### `src/lib/tauri.ts`

新增两个 IPC wrapper：

```typescript
export const listAvailableMonths = () =>
  invoke<string[]>('list_available_months')

export const listJournalEntriesByMonths = (months: string[]) =>
  invoke<JournalEntry[]>('list_journal_entries_by_months', { months })
```

### `src/hooks/useJournal.ts`

新增 state：
- `availableMonths: string[]` — 全量月份列表（降序）
- `loadedMonths: string[]` — 当前已加载的月份子集

初始化流程：
1. 调用 `listAvailableMonths()` 获取全量月份
2. 取前 3 个作为 `loadedMonths`
3. 调用 `listJournalEntriesByMonths(loadedMonths)` 获取条目

`refresh()` 改为调用 `listJournalEntriesByMonths(loadedMonths)`。

新增 `loadMore()`：
- 从 `availableMonths` 中取下 3 个未在 `loadedMonths` 中的月份
- 追加到 `loadedMonths`
- 触发 refresh

暴露 `hasMore: boolean`（`availableMonths.length > loadedMonths.length`）。

`journal-updated` 事件处理：同时刷新 `availableMonths`（新月份可能被创建）和条目。

### `src/components/JournalList.tsx`

列表末尾，当 `hasMore` 为 true 时渲染按钮：

```tsx
{hasMore && (
  <div style={{ padding: '16px', textAlign: 'center' }}>
    <button onClick={onLoadMore} style={loadMoreStyle}>
      {t('loadMore')}
    </button>
  </div>
)}
```

样式：纯文字链接风格，`var(--item-meta)` 色，hover 时 `var(--text-primary)`。无边框、无背景。符合克制设计语言。

### i18n

`zh.ts`: `loadMore: '加载更早的记录'`
`en.ts`: `loadMore: 'Load earlier entries'`

## 不改动

- `list_all_journal_entries` — 保留，不破坏其他调用方
- 3 秒轮询机制 — 保留，只是改为调用分页接口
- `JournalList` 的分组渲染逻辑 — 不变，数据源已按月分组

## 边界情况

- workspace 为空 → `availableMonths` 为空 → 不显示按钮
- 不足 3 个月 → 全部加载，`hasMore` 为 false
- AI 处理写入当月 → 当月已在 `loadedMonths` 中，refresh 正常覆盖
- workspace 切换 → 重置 `loadedMonths` 和 `availableMonths`，重新初始化
- 新 workspace 首次写入 → `availableMonths` 可能还没有当月目录。`journal-updated` 事件触发时刷新 `availableMonths`，若当月新出现则自动加入 `loadedMonths`
