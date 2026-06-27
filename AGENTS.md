# AGENTS.md

谨迹（JournalClaw）维护指南。面向 AI 编码助手和人类开发者。

## 用户画像

知识工作者：频繁参与会议、整理文档，每天产生多条日志。核心任务是**高效浏览 + 沉浸阅读**，不是创作。情感期望：打开即平静，阅读时忘记工具的存在。

## 设计基调

**Modern · Bold · Agentic**（现代 · 大胆 · 对话式 AI 优先）

单一信号橙 `#FF5701` 作为所有交互 accent 的唯一来源；纯白表面 `#FFFFFF` + 暖白分层 `#F6F6F1`/`#ECECE6` + 墨色文字 `#111827`；字体三栈各司其职——Playfair Display（标题衬线）+ 系统无衬线（UI 正文）+ JetBrains Mono（代码）；8pt 间距网格；表面分层传达深度。

完整设计规范见 `docs/DESIGN.md`（含配色、排版、组件、结构化 token、动效、Anti-slop 规则）。

---

## 常用命令

```bash
# Dev（同时启动 Vite + Tauri）
npm run tauri dev

# 仅前端（Vite at localhost:1420）
npm run dev

# 前端测试
npm test                    # vitest run（单次）
npm run test:watch          # watch 模式
npx vitest run src/tests/JournalItem.test.tsx   # 单文件

# 前端构建检查
npm run build               # tsc + vite build

# Lint & Format
npm run lint                # eslint
npm run format:check        # prettier

# Rust 测试
cd src-tauri && cargo test

# E2E 测试
npm run test:e2e            # playwright

# 生产构建
npm run tauri build
```

---

## 技术架构

**Tauri v2 + React 19 + TypeScript + Rust**，macOS 桌面应用。

完整架构详见 `docs/ARCH.md`（含系统分层、设计决策、前后端架构、数据流、IPC 约定）。

---

## Codex 门禁约定

- 新的开发需求在进入编码前，须先经 `.agents/skills/requirements-gate` 完成梳理，产出 `story.md` 并由用户确认为 `status: approved`。非开发消息、已批准任务的延续、或标注 `[skip-gate]` 的消息不受此约定影响。
- `git commit` 前，若存在与本次改动相关、`status: approved` 但尚未 `verified` 的 `story.md`，须先经 `.agents/skills/verification-gate` 由独立 subAgent 完成验收并产出 `verify-report.md`，全部通过后将 story 翻为 `verified`。
- `git commit` 前，若本次改动对应的 story 已 `verified` 且影响面涉及架构、设计、约定或用户可感知变化，须经 `.agents/skills/docs-maintenance` 同步更新 `AGENTS.md` / `ARCH.md` / `DESIGN.md`，并按需维护 `README`、`llms.txt` 与使用、开发说明文档。

---

## 版本管理

版本号在三个文件中必须一致，由 release-please 自动同步，**不要手动修改**：
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package].version`
- `src-tauri/tauri.conf.json` → `version`

Commit message 遵循 **Conventional Commits**：

| 格式 | 版本变化 | 示例 |
|---|---|---|
| `fix: ...` | patch | `fix: 修复跨文件夹链接跳转` |
| `feat: ...` | minor | `feat: 新增标签筛选功能` |
| `feat!: ...` 或 body 含 `BREAKING CHANGE:` | major | `feat!: 重构存储格式` |
| `chore:` / `docs:` / `refactor:` / `test:` 等 | 无变化 | `chore: 更新依赖` |

合并到 master 后，release-please 自动维护 Release PR；合并该 PR 即完成打 tag + GitHub Release。

---

## CI/CD

| Workflow | 触发 | 内容 |
|---|---|---|
| `ci.yml` | PR / push to master | 前端：tsc + eslint + prettier + vitest；Rust：cargo fmt + clippy + test |
| `release.yml` | `v*.*.*` tag | 选择最新 Xcode（需 macOS 26 SDK），构建 Swift sidecar，`tauri build`，上传 .dmg 到 GitHub Release |
| `release-please.yml` | push to master | 自动管理 Release PR |

---

## 关键约束

1. **视觉一致性**：`JournalList` ↔ `IdentityList`、`DetailPanel` ↔ `IdentityDetail` 表现保持一致。修改其中一个时同步修改另一个。
2. **Context menu**：使用 Tauri v2 `@tauri-apps/api/menu`（`Menu`, `MenuItem`）。`tauri-plugin-context-menu` 是 v1 专用，不要使用。
3. **Theme**：通过 `workspace_settings` Rust 命令持久化，不用 localStorage（面板宽度除外）。
4. **AI 引擎**：① 当前默认路径仍是 Rust 内置 LLM 引擎（`apps/web/src-tauri/src/llm/`，Anthropic Messages API 直连，4 vendor：volcengine、zhipu、dashscope、anthropic）。② **迁移中（ME 阶段 2026-06-27）**：daemon 已集成 [`pi`](https://github.com/earendil-works/pi)（`pi-agent-core` + `pi-ai`）作为新内建引擎（`apps/daemon/src/engine/`），多 vendor 经 OpenAI 兼容 + 自定义 baseURL（国产三家已配置），工具/授权/事件映射/prompt-skills 组装就绪，经 `POST /runs engine=builtin` 走 AgentRunService。逐能力切换完成后取代 Rust 引擎。详见 `docs/adr/rust-removal-roadmap.md`。
5. **Swift sidecar（已下线 · M0 2026-06-27）**：音频/语音/转写能力（`journal-speech` 二进制、Apple SpeechAnalyzer、WhisperKit、speaker profiles）已从默认跨平台主干**下线**，前端入口移除。Rust 侧残余代码待 Phase 10 M8 删除。详见 `docs/adr/rust-removal-roadmap.md`。
6. **IPC 单一入口**：所有前端 → Rust 调用必须经过 `src/lib/tauri.ts`，不允许在组件中直接 `invoke()`。
7. **视觉修复必须验证真实渲染链**：MDX/日志详情里的样式问题不要只看孤立组件、源码 CSS 或普通 Vite probe。真实链路通常是 `MdxRenderer` → `.md-content.mdx-content` → `JournalBlockRenderer` → `journal-blocks.css`，还会叠加 `markdown.css` / `mdx.css` 的全局规则。修复前先确认真实 DOM、CSS 加载顺序、specificity、继承变量和 computed style；尤其留意 `max-width` / `max-inline-size`、`line-height`、`margin`、`text-wrap: balance` 这类会让”看似改了但界面没变”的属性。把用户指出的具体视觉问题写成红/绿测试；如需浏览器验证，尽量验证包含 `.md-content.mdx-content` 和真实 CSS cascade 的场景，普通 Vite 页面不能替代 Tauri 真实窗口。
8. **优先使用 HTML mockup 澄清视觉效果**：讨论布局、组件外观、交互动效等视觉相关需求时，优先生成可在浏览器中打开的 HTML mockup 来展示和确认效果，而非仅用文字或 ASCII 描述。
9. **结构化 token 强制消费**：圆角（`--radius-sm/md/lg/pill`）、浮层阴影（`--shadow-overlay`）、菜单边框（`--border-menu`）、聚焦环（`--focus-ring`）必须走 token，禁止组件各自硬编码数值。字体三栈各司其职：标题用 Playfair Display（`--font-display`），正文用系统无衬线（`--font-body`），代码用 JetBrains Mono（`--font-mono`），中文衬线编辑时刻用 Noto Serif SC（`--font-serif`）。详见 `docs/DESIGN.md` §5 结构化 token。
