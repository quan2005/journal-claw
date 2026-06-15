---
title: 前端开发
description: JournalClaw 前端开发指南：React 组件结构、Hooks 使用、IPC 调用规范、样式系统。
---

# 前端开发

## 技术栈

- React 19 + TypeScript
- Vite 7（构建和开发服务器）
- 纯 CSS（CSS 变量 tokens，无 CSS-in-JS 框架）
- Tauri IPC（通过 `@tauri-apps/api` 的 `invoke`）
- highlight.js（Markdown 代码高亮）
- react-markdown + remark-gfm（Markdown 渲染）

## IPC 调用规范

所有到 Rust 后端的调用必须通过 `src/lib/tauri.ts` 封装：

```typescript
// src/lib/tauri.ts
import { invoke } from '@tauri-apps/api/core';

export async function startRecording(): Promise<void> {
  return invoke('start_recording');
}

export async function stopRecording(): Promise<string> {
  return invoke('stop_recording');
}

export async function getJournalEntries(month: string): Promise<JournalEntry[]> {
  return invoke('get_journal_entries', { month });
}
```

**原则**：
- 新增 IPC 调用只能在 `lib/tauri.ts` 中添加
- 组件和 hooks 不直接调用 `invoke()`
- 类型定义在 `src/types.ts` 中统一管理

## 核心 Hooks

### useJournal

```typescript
// 加载条目 + 订阅 journal-updated 事件
const { entries, loading, refresh } = useJournal();
```

- 订阅 `journal-updated` 事件，自动刷新
- 分页加载（按月）
- 返回加载状态和条目列表

### useRecorder

```typescript
// 录音状态管理
const { isRecording, duration, start, stop } = useRecorder();
```

- 管理录音生命周期
- 显示录音时长
- 处理权限请求

### useTheme

```typescript
// 主题管理
const { theme, setTheme } = useTheme();
// theme: 'light' | 'dark' | 'system'
```

- CSS 变量注入
- 跟随系统 / 手动切换
- 持久化到工作区配置

### useConversation

```typescript
// 对话管理
const { messages, send, loading, mode, setMode } = useConversation();
// mode: 'chat' | 'agent'
```

- 流式 AI 响应
- 聊天 / Agent 模式切换
- 会话历史管理

### useIdentity

```typescript
// 画像管理
const { profiles, create, update, remove } = useIdentity();
```

### useTodos

```typescript
// 待办管理
const { todos, add, complete, remove } = useTodos();
```

## 样式系统

谨迹使用纯 CSS 变量系统，无 CSS 框架：

```css
/* 在 App.css 中定义，组件中引用 */
.my-component {
  background: var(--bg);
  color: var(--item-text);
  border-color: var(--divider);
}
```

### 核心 CSS 变量

| 变量 | 用途 |
|---|---|
| `--bg` | 主背景色 |
| `--sidebar-bg` | 侧边栏背景 |
| `--item-text` | 主要文字色 |
| `--item-meta` | 次要文字色 |
| `--divider` | 分割线色 |
| `--record-btn` | 信号橙交互 accent |
| `--accent` | 危险红（删除/破坏性操作） |

完整色彩系统见 [DESIGN.md](/DESIGN.md)。

## 国际化

通过 `I18nContext` 提供中文和英文支持：

```typescript
import { useI18n } from '../contexts/I18nContext';
const { t, locale, setLocale } = useI18n();
```

翻译文本定义在 `src/locales/` 中。

## 设置面板

设置面板在 `src/settings/` 中，包含 9 个 Section 组件。每个 Section 对应一个设置类别（通用、AI 引擎、语音引擎、外观、录音、自动整理、飞书桥接、声纹、关于）。

设置通过 IPC 读写，持久化在工作区配置文件和 `config.json` 中。

## 添加新组件

1. 在 `src/components/` 中创建组件文件
2. 使用 CSS 变量（不写硬编码颜色）
3. 遵循设计系统的交互规范（transform + opacity 动画，ease-out-quart）
4. 支持深色/浅色双主题（不需要额外代码——CSS 变量自动处理）
5. 支持 `prefers-reduced-motion`
