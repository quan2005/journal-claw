# Implementation Plan: 首次启动引导体验

**Branch**: `001-onboarding-experience` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

## Summary

为 JournalClaw 添加首次启动引导流程。产品定位为纯粹笔记软件（不含语音转写/录音）。核心设计：三步引导（工作区路径确认 → **AI 引擎 API Key 配置** → 可选能力展示，展示拖入文件和粘贴文本两种输入方式），每步均可跳过，完成后永不重现。参考 open-design 的克制引导理念，将最关键的两个决策前置：工作区路径和 AI 引擎配置。

技术方案：React 前端组件 `OnboardingView` 作为 App 内的覆盖层，复用现有主题、i18n、IPC 基础设施。引导状态通过 `config.json` 中的 `onboarding_completed` 布尔值持久化。

## Technical Context

**Language/Version**: TypeScript 5.x (React 19), Rust 1.x (Tauri v2)

**Primary Dependencies**: React 19, Tauri v2, @tauri-apps/plugin-dialog, vite

**Storage**: `config.json` (Tauri app data dir) for onboarding flag + AI engine config, `{workspace}/.setting.json` for theme, `localStorage` for sidebar width

**Testing**: vitest (前端 unit), cargo test (Rust unit), playwright (E2E)

**Target Platform**: macOS 14+ (桌面应用)

**Project Type**: desktop-app (Tauri v2 + React)

**Performance Goals**: 引导切换动画维持 60fps，首次启动到主界面 ≤30s（使用默认路径 + 配置 API Key + 跳过能力展示）

**Constraints**: 离线可用（工作区初始化无需网络），AI 引擎配置步骤需网络进行连接测试，动画仅使用 transform + opacity（≤300ms），尊重 prefers-reduced-motion

**Scale/Scope**: 单用户桌面应用，引导仅在首次启动时出现一次

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution template is unfilled — no project-specific gates defined. Proceeding with standard quality gates:

- **Design consistency**: Onboarding MUST follow existing design language (amber accent, ink-cyan neutrals, no slop). PASS
- **IPC boundary**: All frontend→Rust calls MUST go through `src/lib/tauri.ts`. PASS (planned)
- **No regressions**: Existing startup flow (sample entry creation) MUST still work after onboarding completes. PASS (planned)
- **Theme respect**: Onboarding MUST respond to light/dark/system theme. PASS (inherit from existing theme system)

## Project Structure

### Documentation (this feature)

```text
specs/001-onboarding-experience/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── onboarding-ui.md # UI component contract
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── OnboardingView.tsx        # NEW: 引导主组件（三步）
├── hooks/
│   └── useOnboarding.ts          # NEW: 引导状态管理 hook
├── lib/
│   └── tauri.ts                  # MODIFY: 添加 onboarding IPC 封装
├── App.tsx                        # MODIFY: 集成引导覆盖层
├── styles/
│   └── onboarding.css             # NEW: 引导专用样式
└── locales/
    ├── en.ts                      # MODIFY: 引导相关字符串
    └── zh.ts                      # MODIFY: 引导相关字符串

src-tauri/src/
├── config.rs                      # MODIFY: 添加 onboarding_completed 字段
├── main.rs                        # MODIFY: 注册新 Tauri 命令
└── onboarding.rs                  # NEW: 引导相关 Rust 命令 (get/set status)
```

**Structure Decision**: 采用现有单项目结构。引导作为 App 内的覆盖层组件，不需要新的页面或路由。Rust 侧最小化新增，仅需 `onboarding_completed` 状态持久化。AI 引擎配置步骤复用现有的 `get_engine_config` / `set_engine_config` IPC 命令。

## Complexity Tracking

> No violations to justify. Feature adds minimal new code and reuses existing infrastructure.
