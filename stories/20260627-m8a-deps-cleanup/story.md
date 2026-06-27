---
status: verified
phase: M8-a
created: 2026-06-27
---

# M8-a · 清理前端 @tauri-apps 硬依赖（删 Rust 前置）

## 背景
M8 要删 src-tauri，但前端有 25 处静态 `from '@tauri-apps'`。Gate A 要求前端不以 @tauri-apps 为默认路径。先清这些依赖，再删 Rust。

## 依赖分类与处理
1. **runtimeClient.ts / tauri.ts 的 invoke/listen**（TauriRuntimeClient fallback 类）：删 Rust 后 Tauri fallback 无意义 → 删除 TauriRuntimeClient 类，selectRuntimeClient 只返回 HttpRuntimeClient（移除 'tauri' 分支或保留为 noop）；tauri.ts 顶层 `import { invoke }` 改为不依赖（封装函数已走 selectRuntimeClient）。
2. **组件直接 Tauri API**（改走 hostBridge，M7-c 已建 Electron 分流）：
   - `convertFileSrc`（DetailView/MarkdownRenderer/markdownComponents）→ hostBridge 加 convertFileSrc（Electron 下用 file:// 或自定义协议；web 下 noop/data url）
   - `ask`/`open`（TreeContextMenu/DetailView/ChatPanel plugin-dialog）→ hostBridge 加 ask/openDialog（Electron dialog）
   - `listen`（useAutomation/useJournal/useTopics）→ 已有 daemon SSE（appEventBus）；改走 SSE 订阅
   - `getCurrentWindow`（useTheme）→ hostBridge（Electron 下用 window API 或 noop）
3. hostBridge 补上述能力（convertFileSrc/ask/openDialog/window）的 Electron 实现（preload + main IPC，M7-c 模式）。

## 约束
- 清完后 `rg "from '@tauri-apps" apps/web/src` 应为 0（或仅测试 fixture/显式 deprecated 注释）。
- 不删 src-tauri（M8-b 做）；不破坏功能（Electron/web 下能力经 hostBridge 兜底）。
- 只动 apps/web + apps/desktop（hostBridge/preload/main）。

## 验收
- rg "from '@tauri-apps" apps/web/src = 0（测试/历史注释除外）
- web tsc clean；vitest 失败基线子集（9）
- desktop tsc clean；测试不回退
- hostBridge 补的能力有 Electron 实现 + 测试
