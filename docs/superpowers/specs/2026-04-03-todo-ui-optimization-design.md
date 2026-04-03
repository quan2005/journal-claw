# Todo UI 优化：紧凑布局 + 来源文档标识

## 概述

优化待办事项 sidebar 的信息密度和视觉层级，新增来源文档跳转功能。

## 问题

1. 当前每条 todo 垂直空间过大（padding + margin + 截止日期独占一行），几条就撑满 sidebar
2. 未完成 / 已完成 / 过期状态视觉区分不明显
3. 从日志添加的 todo 丢失了来源信息，无法回溯

## 设计方案

### 数据层

**TodoItem 新增 `source` 字段：**

```typescript
// src/types.ts
export interface TodoItem {
  text: string
  done: boolean
  due: string | null
  done_date: string | null
  source: string | null   // 来源文件名，如 "28-AI平台产品会议纪要.md"
  line_index: number
}
```

**todos.md 存储格式（沿用 HTML 注释风格）：**

```markdown
- [ ] 确认API权限边界 <!-- due:2026-04-10 --> <!-- source:02-研发沟通.md -->
- [x] 泼墨体收口 <!-- done:2026-04-02 --> <!-- source:25-泼墨体模型接入.md -->
```

**Rust 变更（`src-tauri/src/todos.rs`）：**

- `TodoItem` struct 新增 `source: Option<String>`
- `parse_todos` 解析 `<!-- source:... -->` 注释
- `add_todo` 命令新增可选参数 `source: Option<String>`，写入时追加注释
- 序列化时 source 注释放在 due/done 注释之后

**IPC 变更（`src/lib/tauri.ts`）：**

- `addTodo(text, due?, source?)` 新增可选 source 参数

### UI 布局

**当前布局（每行约 46px）：**
```
[14px checkbox] [text          ]
                [截止 2026/04/10]
marginBottom: 10, padding: 6px 8px, background, borderRadius
```

**新布局（每行约 28px）：**
```
[3px竖线] [13px checkbox] [text...] [04/10 badge] [🔗]
padding: 6px 8px, border-bottom 分隔
```

**具体样式变更：**

- 去掉：`marginBottom: 10`、`borderRadius: 5`、`background: rgba(255,255,255,0.02)`
- 改为：`padding: 6px 8px`、`border-bottom: 0.5px solid rgba(255,255,255,0.06)`
- 截止日期：从独立行改为行内 badge（`fontSize: 8px`，`padding: 1px 4px`，`borderRadius: 3px`）
- 所有元素单行排列，文本溢出用 `text-overflow: ellipsis`

### 状态竖线

左侧 3px 宽圆角竖线，`borderRadius: 1.5px`，`align-self: stretch`：

| 状态 | 颜色 | 说明 |
|------|------|------|
| 过期（有 due 且 < today） | `#ff3b30` | accent 红，最醒目 |
| 未完成（默认） | `rgba(255,255,255,0.3)` | 中性灰 |
| 已完成 | `rgba(255,255,255,0.12)` | 退到背景 |

```typescript
function statusBarColor(item: TodoItem): string {
  if (item.done) return 'rgba(255,255,255,0.12)'
  if (item.due) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(item.due + 'T00:00:00')
    if (d < today) return '#ff3b30'
  }
  return 'rgba(255,255,255,0.3)'
}
```

### 来源文档图标

- 位置：行尾，仅当 `source` 存在时渲染
- 图标：12px 链条（超链接）SVG（`stroke: #888`）
- 默认 `opacity: 0.35`，行 hover 时 `0.6`，图标 hover 时 `1.0`
- hover 显示 tooltip（来源文件名）
- 点击触发跳转到来源日志

**跳转机制：**

TodoSidebar 新增 prop：
```typescript
onNavigateToSource?: (filename: string) => void
```

App.tsx 实现：根据 filename 在 entries 中查找匹配项，设置为 selectedEntry。filename 匹配逻辑：精确匹配 `entry.filename`。如果 source 中只存了部分文件名（无 yyMM 前缀），则在所有 entries 中搜索 `entry.filename === source`。

### 添加待办按钮

从虚线框改为与列表行一致的样式：
- 左侧无竖线，用 `+` 图标 + "添加待办" 文字
- hover 时 `background: rgba(255,255,255,0.03)`

### 已完成区域

- 整体 `opacity: 0.5`
- 竖线用 `rgba(255,255,255,0.12)` 淡灰
- 来源图标保留但更淡（`opacity: 0.2`）

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src-tauri/src/todos.rs` | TodoItem 新增 source 字段，解析/写入 `<!-- source:... -->` |
| `src/types.ts` | TodoItem 接口新增 `source: string \| null` |
| `src/lib/tauri.ts` | addTodo 新增 source 参数 |
| `src/hooks/useTodos.ts` | addTodo 透传 source |
| `src/components/TodoSidebar.tsx` | 紧凑布局重构 + 状态竖线 + 来源图标 |
| `src/components/DetailPanel.tsx` | onAddToTodo 传递来源文件名 |
| `src/App.tsx` | 接线 onNavigateToSource，addTodo 传 source |

## 视觉参考

Mockup 文件：`docs/todo-mockup.html`
