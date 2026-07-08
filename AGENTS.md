# AGENTS.md

谨迹（JournalClaw）维护指南 hub。面向 AI 编码助手和人类开发者。**每条约定只在一处权威存在**——本文件只做导航、铁律摘要与命令速查，细则见链接文档。

## 文档地图

| 文档                  | 唯一权威内容                                              |
| --------------------- | --------------------------------------------------------- |
| `docs/ARCH.md`        | 架构分层、模块边界、依赖方向规则（含违反示例）            |
| `docs/DESIGN.md`      | 视觉设计规范（配色、排版、结构化 token、动效、Anti-slop） |
| `docs/CONVENTIONS.md` | 工程规范（命令、目录、测试策略、门禁流程、版本、CI/CD）   |
| `docs/final-state.md` | 产品北极星、五个一等对象、状态地图                        |
| `docs/adr/`           | 架构决策历史（只增不改）                                  |

> **历史工作流产物已归档**：旧根目录 `specs/`、`docs/superpowers/`（plans / specs / mockups / examples）整体迁入 `stories/_archive/`，**只读、不再维护**，仅作历史回溯用。当前需求与设计走 `stories/<phase>/story.md` + `docs/*.md`。

## 产品一句话

`journal` = **本地优先的个人 Agentic Knowledge Workspace**：文件是长期资产，Agent 是工作执行者，输出是核心结果。用户是知识工作者，核心任务是高效浏览 + 沉浸阅读。详见 `docs/final-state.md`。

## 常用命令速查

```bash
npm run desktop:dev     # Vite + Electron
npm run dev             # 仅前端 (localhost:1420)
npm test                # 全 workspace vitest
npm run build           # tsc + vite build
npm run lint && npm run format:check
```

完整命令与单测/e2e 用法见 `docs/CONVENTIONS.md` §1。

包管理器为 **bun**（版本见 `package.json#packageManager`）；开发前执行 `bun install`，CI 与本地均统一使用 bun。

## 铁律摘要（细则见权威出处）

1. **Runtime 单一入口**：业务能力走 `runtimeClient` → daemon HTTP/SSE；宿主能力走 `hostBridge.ts` → Electron preload 白名单。组件禁止直连 daemon URL、raw Electron IPC。→ `docs/ARCH.md`
2. **desktop 零业务语义**：Electron 宿主只管窗口/菜单/daemon 生命周期/宿主能力。→ `docs/ARCH.md`
3. **文件写入走 ChangeSet**；authorization mode 在 daemon 执行。→ `docs/ARCH.md`
4. **Theme 经 daemon 持久化**，不用 localStorage（面板宽度除外）。→ `docs/ARCH.md`
5. **结构化 token 强制消费**（圆角/阴影/边框/聚焦环/字体三栈），禁止硬编码。→ `docs/DESIGN.md` §5
6. **视觉一致性**：`JournalList` ↔ `IdentityList`、`DetailPanel` ↔ `IdentityDetail` 同步修改。→ `docs/DESIGN.md`
7. **视觉修复验证真实渲染链**（`.md-content` + 真实 CSS cascade），先写红测试。→ `docs/CONVENTIONS.md` §3
8. **视觉需求优先 HTML mockup 澄清**，不用文字/ASCII 描述。
9. **单一信号橙 `#FF5701`** 是所有交互 accent 的唯一来源。→ `docs/DESIGN.md`
10. **门禁流程**：需求门禁（story approved 才编码）→ 验收门禁（verify-report 通过才 commit）→ 文档维护。→ `docs/CONVENTIONS.md` §4
11. **版本号由 release-please 管理，禁止手改**；Conventional Commits。→ `docs/CONVENTIONS.md` §6
12. **AI 引擎**：daemon 内建 pi 引擎（`apps/daemon/src/engine/`），唯一引擎，外部 CLI adapter 已移除。→ `docs/ARCH.md`

## 已下线能力

音频/语音/转写（journal-speech、SpeechAnalyzer、WhisperKit、speaker profiles）与 Rust/Tauri 后端已于 M8-b（2026-06-27）删除。详见 `docs/adr/rust-removal-release-note.md`。
