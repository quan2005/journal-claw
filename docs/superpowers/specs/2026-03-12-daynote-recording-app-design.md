# DayNote 录音 App — 设计文档

**日期：** 2026-03-12
**状态：** 已确认

---

## 概述

DayNote 是一款极简 macOS 桌面录音应用。核心交互只有一个录音按钮，录音记录按时间自动归档，无任何多余功能。

---

## 技术栈

| 项目 | 选型 |
|------|------|
| 框架 | Tauri v2 |
| 前端 | React + TypeScript |
| 后端 | Rust（Tauri 命令） |
| 渲染 | macOS 系统 WebView（WKWebView） |
| 录音格式 | M4A / AAC |
| 存储位置 | App 私有目录（`~/Library/Application Support/journal/`） |
| 主题 | 跟随 macOS 系统 Light / Dark 自动切换 |

---

## 界面布局

窗口固定宽度 320px，初始高度 480px，最小高度 360px，高度可拉伸。无菜单栏。标题栏仅显示 App 名「DayNote」。窗口尺寸不持久化。

```
┌─────────────────────────────┐
│ ● ● ●        DayNote        │  ← 标题栏（36px）
├─────────────────────────────┤
│                             │
│  2026 · 03                  │  ← 月份分割线（灰色小字）
│  录音 2026-03-12 22:41  2:34 │
│  录音 2026-03-11 09:05  0:47 │
│                             │
│  2026 · 02                  │
│  录音 2026-02-28 15:30  5:12 │
│  录音 2026-02-14 20:10  1:08 │
│                             │  ← 列表区（可滚动，占满剩余高度）
├─────────────────────────────┤
│                             │
│           ( ● )             │  ← 录音按钮（固定底部，高度 120px）
│                             │
└─────────────────────────────┘
```

---

## 状态与交互

### 空闲状态

- 标题栏显示「DayNote」
- 底部显示红色圆形录音键（内含白色实心圆），带呼吸光晕动画（2.4s ease-in-out 循环，`box-shadow` 从 0 扩展到 12px radius）
- 列表显示历史录音，按 `yyyyMM` 分组

### 录制中状态

- 标题栏替换为 `● 00:23`（红点 1s ease-in-out 闪烁 + 计时器，tabular-nums）
- 计时器格式：`mm:ss`（不足一小时）；超过一小时显示 `h:mm:ss`
- **列表顶部自动插入当前录音条目**（前端本地状态管理，非来自 `list_recordings`），高亮显示，时长由前端本地计时器实时更新
- 底部按钮变为红色圆形停止键（内含白色圆角方块）
- 无任何提示文字

### 录音权限

macOS 首次启动时触发系统麦克风权限弹窗（`NSMicrophoneUsageDescription`）。

- 权限授予：正常录音
- 权限拒绝：点击录音键时弹出系统原生 alert，提示用户前往「系统设置 → 隐私与安全性 → 麦克风」开启权限。不做自定义权限引导 UI。

### 右键菜单

使用 **Tauri 原生上下文菜单**（`tauri-plugin-context-menu` 或 Tauri v2 内置 menu API），而非自定义 HTML overlay。右键点击列表条目触发，定位跟随鼠标。

菜单项：

1. 播放
2. 在 Finder 中显示
3. —（分割线）
4. 删除（红色）

左键点击列表条目：无反应。

**删除正在播放的文件：** `play_recording` 通过系统 `open` 命令打开文件（QuickTime 等默认播放器），文件句柄由 OS 管理。删除操作直接执行 `fs::remove_file`，如果 OS 拒绝（文件被锁定），向前端返回错误，前端忽略该错误（静默失败，不显示任何提示）。

---

## 录音文件

- **文件名格式：** `录音 YYYY-MM-DD HH:mm.m4a`（例：`录音 2026-03-12 22:41.m4a`）
- **文件名冲突：** 若同分钟内录音重复，追加秒数后缀，如 `录音 2026-03-12 22:41:05.m4a`
- **存储路径：** `~/Library/Application Support/journal/`
- **录音格式：** M4A（AAC 编码）
- **元数据来源：** 文件名即为全部元数据，无额外数据库

### 崩溃/强退后的残留文件

若录制过程中 App 崩溃或被强制退出，会留下不完整的 M4A 文件。`list_recordings` 扫描目录时包含这些文件，将其正常显示在列表中（用户可右键删除）。不做文件完整性校验，不做自动清理。

---

## 列表分组规则

- 按文件名中的年月（`yyyyMM`）分组
- 组内按时间倒序（最新在上）
- 分割线样式：全大写灰色小字，如 `2026 · 03`
- 录制中的条目始终置顶，属于当前月份组，由前端本地状态插入，不来自 Rust 命令

---

## 主题

跟随 macOS `prefers-color-scheme` 自动切换，无手动开关。

| 元素 | Light | Dark |
|------|-------|------|
| 背景 | `#ffffff` | `#1c1c1e` |
| 标题栏背景 | `#f2f2f7` | `#2c2c2e` |
| 分割线 | `#e5e5ea` | `#3a3a3c` |
| 月份标签 | `#c7c7cc` | `#48484a` |
| 条目文字 | `#1c1c1e` | `#e8e8e8` |
| 时长文字 | `#c7c7cc` | `#48484a` |
| 录音键 | `#ff3b30` | `#ff375f` |
| 录制高亮 | `rgba(255,59,48,0.06)` | `rgba(255,55,95,0.06)` |

---

## Rust 命令接口

### `list_recordings() -> Vec<RecordingItem>`

扫描 `~/Library/Application Support/journal/` 目录，返回所有 `.m4a` 文件。

```typescript
interface RecordingItem {
  filename: string;       // 不含路径，如 "录音 2026-03-12 22:41.m4a"
  path: string;           // 完整绝对路径
  display_name: string;   // "录音 2026-03-12 22:41"
  duration_secs: number;  // 时长（秒），通过读取 M4A 文件头获取；无法读取时为 0
  year_month: string;     // "202603"，用于分组
}
```

### `start_recording() -> Result<String, String>`

开始录音，返回本次录音的文件路径。若麦克风权限被拒绝，返回 `Err("permission_denied")`。

### `stop_recording() -> Result<RecordingItem, String>`

停止录音，完成文件写入，返回完整的 `RecordingItem`（含真实时长）。

### `delete_recording(path: String) -> Result<(), String>`

删除指定文件。若 OS 拒绝，返回 `Err`，前端静默忽略。

### `reveal_in_finder(path: String) -> Result<(), String>`

使用 `NSWorkspace` 在 Finder 中高亮显示该文件。

### `play_recording(path: String) -> Result<(), String>`

使用系统 `open` 命令以默认播放器打开文件（通常为 QuickTime）。

---

## 明确不做

- 无设置页
- 无搜索
- 无重命名
- 无标签 / 分类
- 无云同步
- 无波形显示
- 无行内播放器 UI
- 无提示文字（录音键无 label）
- 无自定义权限引导 UI
- 无文件完整性校验

---

## 组件划分

| 组件 | 职责 |
|------|------|
| `App` | 根组件，监听系统主题，持有录音状态（idle / recording），持有本地计时器 |
| `TitleBar` | 自定义标题栏，空闲显示 App 名，录制中显示闪烁红点 + 计时 |
| `RecordingList` | 录音列表，按月分组渲染，顶部插入录制中条目（来自 props），处理右键菜单 |
| `MonthDivider` | 月份分割线组件 |
| `RecordingItem` | 单条录音行，含高亮状态，右键触发原生菜单 |
| `RecordButton` | 底部录音/停止切换按钮，含呼吸动画 |
