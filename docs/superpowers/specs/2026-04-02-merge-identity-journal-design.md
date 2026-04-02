# 合并人设与日志到左侧面板

> 日期: 2026-04-02

## 概述

将独立的 IdentityView 视图合并到主界面左侧面板，通过顶部 Segmented Control（图标+文字）在「日志」和「人设」两个 tab 间切换。右侧详情面板根据当前 tab 和选中项展示对应内容。

## 用户场景

知识工作者在浏览日志时偶尔需要查看/编辑身份档案（如查看某个说话人的信息）。当前需要通过 TitleBar 按钮切换到完全独立的 IdentityView，丢失日志上下文。合并后只需点击左侧 tab 即可切换，心智负担更低。

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 切换控件 | Segmented Control + 图标 + 文字（方案A） | Apple 原生感，信息完整，零学习成本 |
| 右侧面板 | tab 联动切换 DetailPanel / IdentityDetail | 保持现有组件不变，减少改动量 |
| TitleBar 人像按钮 | 移除 | 入口已移到 Segmented Control，避免重复 |
| ⌘P 快捷键 | 移除 | 不再有独立视图需要切换 |

## 架构变更

### App.tsx 状态变更

```
// 之前
view: 'journal' | 'settings' | 'identity'

// 之后
view: 'journal' | 'settings'           // 移除 'identity'
sidebarTab: 'journal' | 'identity'     // 新增：左侧面板 tab 状态
selectedIdentity: IdentityEntry | null  // 新增：人设选中项（从 IdentityView 提升）
```

### 左侧面板结构

```
┌─────────────────────────┐
│ [📄 日志] [👤 人设]      │  ← Segmented Control, margin: 10px 12px 4px
├─────────────────────────┤
│                         │
│  sidebarTab === 'journal'  │  ← JournalList（现有组件）
│  sidebarTab === 'identity' │  ← IdentityList（现有组件）
│                         │
└─────────────────────────┘
```

Segmented Control 样式：
- 外壳: `background: rgba(128,128,128,0.08)`, `border-radius: 6px`, `padding: 2px`
- 按钮: `flex: 1`, `border-radius: 4px`, `font-size: 11px`, `padding: 5px 0`
- Active: `background: rgba(200,147,58,0.12)`, `color: #C8933B`（暗色主题）
- 图标: 11px stroke icons, gap: 5px with text
- 字体: `'IBM Plex Mono', ui-monospace, monospace`

### 右侧面板联动

```
if sidebarTab === 'journal':
  → DetailPanel(entry=selectedEntry)        // 不变

if sidebarTab === 'identity':
  → IdentityDetail(identity=selectedIdentity)  // 从 IdentityView 复用
```

切换 tab 时不清空另一个 tab 的选中状态（切回来时恢复上次选中）。

### TitleBar 变更

移除的 props：
- `view` 不再传 `'identity'` 值
- `onToggleIdentity` 移除

移除的 UI 元素：
- 右侧人像图标按钮

保留：ThemeToggle、Todo 按钮（仅 journal view 显示）、AiStatusPill。

### 键盘快捷键变更

移除：
- `⌘P`：不再切换 identity 视图

保留：
- `⌘,`：打开设置
- `⌘T`：切换待办侧栏
- `Esc`：从设置返回

### 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.tsx` | 修改 | 新增 sidebarTab/selectedIdentity 状态；左侧面板加 Segmented Control + 条件渲染；右侧面板条件渲染；移除 identity view 分支；移除 ⌘P handler |
| `src/components/TitleBar.tsx` | 修改 | 移除 onToggleIdentity prop 和人像按钮；view type 移除 'identity' |
| `src/components/IdentityView.tsx` | 删除 | 逻辑已提升到 App.tsx |
| `src/components/IdentityList.tsx` | 不变 | 直接复用 |
| `src/components/IdentityDetail.tsx` | 不变 | 直接复用 |
| `src/components/JournalList.tsx` | 不变 | 直接复用 |
| `src/components/DetailPanel.tsx` | 不变 | 直接复用 |
| `src/components/MergeIdentityDialog.tsx` | 不变 | 从 App.tsx 调用 |

### 亮色主题适配

Segmented Control 的 active 色在亮色主题下使用 teal 系：
- Active background: `rgba(74,106,122,0.10)`
- Active color: `var(--record-btn)`（亮色 `#4a6a7a`，暗色 `#C8933B`）

需要新增 CSS 变量：
- `--segment-bg`: 外壳背景
- `--segment-active-bg`: active 项背景
- `--segment-text`: 默认文字色
- `--segment-active-text`: active 文字色

### 边界情况

- Todo 侧栏：仅在 `sidebarTab === 'journal'` 时显示（人设 tab 下不需要 todo）
- CommandDock：两个 tab 下都显示（录音和导入文件始终可用）
- AI 处理中切到人设 tab：ProcessingQueue 不受影响，仍然正常显示
- 窗口宽度：Segmented Control 随侧栏宽度自适应（220-560px 范围内均可）
