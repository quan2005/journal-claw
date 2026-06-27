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
# Dev（同时启动 Vite + Electron）
npm run desktop:dev

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

# Daemon / Desktop 测试
cd apps/daemon && npx vitest run
cd apps/desktop && npx vitest run

# E2E 测试
npm run test:e2e            # playwright

# 生产构建（Electron）
npm run desktop:build
```

---

## 技术架构

**Electron + React 19 + TypeScript daemon**，本地优先桌面应用。

**Phase 10 / M8-b 终局（2026-06-27）**：Tauri/Rust 后端已删除；`apps/desktop` 是 Electron 宿主（窗口、菜单、daemon 生命周期，零业务语义），`apps/daemon` 是业务后端（含 pi 内建引擎），`apps/web` 通过 daemon HTTP/SSE 与 Electron preload host bridge 获取能力。详见 `docs/adr/rust-removal-roadmap.md`。

完整架构详见 `docs/ARCH.md`（含系统分层、设计决策、前后端架构、数据流、IPC 约定）。

---

## Codex 门禁约定

- 新的开发需求在进入编码前，须先经 `.agents/skills/requirements-gate` 完成梳理，产出 `story.md` 并由用户确认为 `status: approved`。非开发消息、已批准任务的延续、或标注 `[skip-gate]` 的消息不受此约定影响。
- `git commit` 前，若存在与本次改动相关、`status: approved` 但尚未 `verified` 的 `story.md`，须先经 `.agents/skills/verification-gate` 由独立 subAgent 完成验收并产出 `verify-report.md`，全部通过后将 story 翻为 `verified`。
- `git commit` 前，若本次改动对应的 story 已 `verified` 且影响面涉及架构、设计、约定或用户可感知变化，须经 `.agents/skills/docs-maintenance` 同步更新 `AGENTS.md` / `ARCH.md` / `DESIGN.md`，并按需维护 `README`、`llms.txt` 与使用、开发说明文档。

---

## 版本管理

版本号由 release-please 自动同步，**不要手动修改**：
- `package.json` → `version`
- workspace package manifests（如 `apps/web/package.json`、`apps/daemon/package.json`、`apps/desktop/package.json`）→ `version`

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
| `ci.yml` | PR / push to master | 前端：tsc + eslint + prettier + vitest；contracts/daemon/desktop：typecheck + vitest |
| `release.yml` | `v*.*.*` tag | 构建 web renderer、TS daemon、Electron app，上传 Electron .dmg 到 GitHub Release |
| `release-please.yml` | push to master | 自动管理 Release PR |

---

## 关键约束

1. **视觉一致性**：`JournalList` ↔ `IdentityList`、`DetailPanel` ↔ `IdentityDetail` 表现保持一致。修改其中一个时同步修改另一个。
2. **Context menu / Host 能力**：原生菜单、文件选择、系统打开、窗口主题/缩放等只走 Electron preload 白名单与 `apps/web/src/lib/hostBridge.ts`，组件不得直接接触 raw Electron IPC。
3. **Theme**：通过 daemon/runtime client 持久化，不用 localStorage（面板宽度除外）；Electron 只同步窗口外观。
4. **AI 引擎**：daemon 已集成 [`pi`](https://github.com/earendil-works/pi)（`pi-agent-core` + `pi-ai`）作为内建引擎（`apps/daemon/src/engine/`），多 vendor 经 OpenAI 兼容 + 自定义 baseURL，工具/授权/事件映射/prompt-skills 组装就绪，经 `POST /runs engine=builtin` 走 AgentRunService。详见 `docs/adr/rust-removal-roadmap.md`。
5. **Swift sidecar（已删除 · M8-b 2026-06-27）**：音频/语音/转写能力（`journal-speech` 二进制、Apple SpeechAnalyzer、WhisperKit、speaker profiles）已从默认跨平台主干下线，前端入口与 Rust 残余均已移除。详见 `docs/adr/rust-removal-release-note.md`。
6. **Runtime 单一入口**：业务能力通过 `apps/web/src/lib/tauri.ts` 兼容 shim → `runtimeClient` → daemon HTTP/SSE；宿主能力通过 `hostBridge.ts`。不允许组件直接调用 daemon URL、raw Electron IPC 或旧 Tauri API。
7. **视觉修复必须验证真实渲染链**：日志详情里的样式问题不要只看孤立组件、源码 CSS 或普通 Vite probe。真实链路是 `renderMarkdown`（`lib/markdown.tsx`）→ `.md-content` → `markdown.css`，大文件另走 `MarkdownRenderer`（Marked + highlight.js + DOMPurify）。修复前先确认真实 DOM、CSS 加载顺序、specificity、继承变量和 computed style；尤其留意 `max-width` / `max-inline-size`、`line-height`、`margin`、`text-wrap: balance` 这类会让”看似改了但界面没变”的属性。把用户指出的具体视觉问题写成红/绿测试；如需浏览器验证，尽量验证包含 `.md-content` 和真实 CSS cascade 的场景，普通 Vite 页面不能替代 Tauri 真实窗口。
8. **优先使用 HTML mockup 澄清视觉效果**：讨论布局、组件外观、交互动效等视觉相关需求时，优先生成可在浏览器中打开的 HTML mockup 来展示和确认效果，而非仅用文字或 ASCII 描述。
9. **结构化 token 强制消费**：圆角（`--radius-sm/md/lg/pill`）、浮层阴影（`--shadow-overlay`）、菜单边框（`--border-menu`）、聚焦环（`--focus-ring`）必须走 token，禁止组件各自硬编码数值。字体三栈各司其职：标题用 Playfair Display（`--font-display`），正文用系统无衬线（`--font-body`），代码用 JetBrains Mono（`--font-mono`），中文衬线编辑时刻用 Noto Serif SC（`--font-serif`）。详见 `docs/DESIGN.md` §5 结构化 token。
