---
title: 架构全景
description: JournalClaw 的完整架构：从用户操作到 AI 编译的数据流，IPC 通信模式，事件系统。
---

# 架构全景

## 核心数据流

```
用户操作（录音 / 拖文件 / 粘贴 / 飞书消息）
  → Frontend invoke() → src/lib/tauri.ts（单一 IPC 入口）
  → Rust 命令处理 → workspace/yyMM/raw/ 写入原始材料
  → 内置 LLM 引擎（src-tauri/src/llm/）→ Anthropic Messages API
  → 生成 workspace/yyMM/DD-title.md
  → 发出 journal-updated 事件
  → Frontend useJournal hook 重新加载条目
```

## IPC 通信模式

谨迹遵循"单一入口"原则——所有前端到后端的调用都通过 `src/lib/tauri.ts` 封装：

```
Frontend Components / Hooks
  → lib/tauri.ts（单文件，所有 IPC 函数）
  → Tauri invoke() 桥接
  → Rust #[tauri::command]（main.rs 中的 50+ 命令）
  → 业务逻辑模块
```

新功能添加流程：
1. 在 Rust 端实现命令 `#[tauri::command]`
2. 在 `main.rs` 的 `invoke_handler` 中注册
3. 在 `src/lib/tauri.ts` 中添加对应的封装函数
4. 前端 hooks / components 中调用封装函数

## 事件系统

谨迹使用 Tauri 事件系统驱动前端更新：

| 事件 | 触发时机 | 消费方 |
|---|---|---|
| `journal-updated` | 新知识条目写入 | `useJournal` hook 重新加载 |
| `ai-processing-start` | AI 开始编译 | AI 状态标识更新 |
| `ai-processing-done` | AI 编译完成 | 处理队列刷新 |
| `feishu-message` | 飞书收到新消息 | 飞书桥接状态更新 |
| `auto-lint-done` | 自动整理完成 | 画像列表刷新 |

## Rust 模块地图

```
main.rs              # 应用入口，Tauri builder，菜单，命令注册
config.rs            # AppConfig 结构体，序列化/反序列化
llm/                 # LLM 引擎子模块
  mod.rs             # Anthropic Messages API 客户端
  tool_loop.rs       # Tool use 循环实现
conversation.rs      # 会话管理，流式对话
ai_processor.rs      # AI 处理队列（异步，FIFO）
recorder.rs          # cpal 音频采集 → WAV
audio_pipeline.rs    # 音频管线编排
audio_process.rs     # 降噪、重采样、去静默
transcription.rs     # STT 引擎抽象 + 三种实现
journal.rs           # 扫描 yymm/DD-title.md，解析 frontmatter
identity.rs          # 画像 CRUD + 关联
speaker_profiles.rs  # 声纹注册 + 匹配
todos.rs             # 待办 CRUD + 分组
auto_lint.rs         # 定时任务：矛盾检测、清理、抽取
skills.rs            # SKILL.md 发现 + 加载
feishu_bridge.rs     # WebSocket 客户端
materials.rs         # 文件导入（PDF/DOCX/TXT）+ 粘贴
permissions.rs       # macOS 权限检查
workspace.rs         # 路径工具：yyMM 生成、raw/ 定位
workspace_settings.rs # 主题、自动整理配置
```

## 前端模块地图

```
App.tsx              # 根组件，布局结构
components/          # 30+ React 组件
  JournalList.tsx    # 左侧时间线列表
  JournalDetail.tsx  # 右侧详情面板
  CommandDock.tsx    # 底部命令栏
  RecorderButton.tsx # 录音按钮
  ConversationPane.tsx # 对话面板
  ...
hooks/
  useJournal.ts      # 条目加载 + 事件订阅
  useRecorder.ts     # 录音状态 + 控制
  useTheme.ts        # 主题切换
  useIdentity.ts     # 画像管理
  useTodos.ts        # 待办管理
  useConversation.ts # 对话状态 + 流式输出
lib/tauri.ts         # 所有 IPC 调用封装
contexts/I18nContext.tsx # 国际化
settings/            # 9 个设置 Section 组件
types.ts             # 共享 TypeScript 类型
```

## 数据格式

### 知识条目（Markdown + Frontmatter）

```markdown
---
title: "标题"
tags: ["tag1", "tag2"]
date: 2025-05-07
sources:
  - type: recording
    path: raw/20250507-143021.m4a
summary: "摘要"
---
正文内容...
```

### 画像（JSON）

```json
{
  "id": "uuid",
  "type": "person",
  "name": "张三",
  "aliases": ["老张"],
  "role": "产品经理",
  "relations": ["project:a-product"],
  "notes": "..."
}
```

### 工作区配置（JSON）

```json
{
  "theme": "system",
  "auto_lint": {
    "enabled": true,
    "interval": "weekly"
  }
}
```
