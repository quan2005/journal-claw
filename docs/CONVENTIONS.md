# CONVENTIONS — 工程规范（唯一权威出处）

> 本文件是工程流程类约定的唯一权威出处。架构边界见 `ARCH.md`，视觉设计见 `DESIGN.md`，产品北极星见 `final-state.md`。其他文档引用本文时只链接、不复述。

## 1. 常用命令

```bash
# Dev（同时启动 Vite + Electron）
npm run desktop:dev
# 仅前端（Vite at localhost:1420）
npm run dev
# 仅 daemon
npm run daemon:dev

# 测试
npm test                                        # 全 workspace vitest
bunx vitest run src/tests/JournalItem.test.tsx  # 单文件（在对应 app 目录下）
cd apps/daemon && bunx vitest run               # daemon
cd apps/desktop && bunx vitest run              # desktop
npm run test:e2e                                # Playwright e2e

# 质量
npm run build            # tsc + vite build（全 workspace）
npm run lint             # eslint
npm run format:check     # prettier

# 生产构建
npm run desktop:build
```

## 2. 目录约定

- `apps/web` 前端（React 19 + Vite）；`apps/daemon` 业务后端（Express HTTP/SSE）；`apps/desktop` Electron 宿主（零业务语义）；`packages/contracts` 跨端契约类型。
- daemon service 按能力分目录（journal/topics/runs/engine/…），service 层承载业务语义，route 层只做协议适配。
- 前端测试在 `apps/web/src/tests/`；hooks 内联测试允许放在 hooks 目录。
- story/design/验收报告在 `stories/<YYYYMMDD>-<slug>/`。

## 3. 测试策略

- 新增业务能力（daemon service / 前端 hook / 组件行为）必须带 vitest 覆盖；视觉/交互修复先写红测试再修（红/绿流程）。
- 视觉修复必须验证真实渲染链：`renderMarkdown` → `.md-content` → `markdown.css`；大文件走 `MarkdownRenderer`。孤立组件或普通 Vite probe 不能替代真实 CSS cascade 验证。
- e2e（Playwright）覆盖跨面板主流程，不替代单测。
- 硬门：commit 前 `bun run test` + `bun run build` + lint 全绿。
- 架构边界由 ESLint 强制（`apps/web/eslint.config.js` 护栏 block：禁 raw electron / window.electronAPI 直访 / lib 外 localhost 字面量 / 消费层 localStorage / lib/tauri 回潮）；文档路径一致性由 `scripts/check-docs-consistency.mjs` 在 CI 校验。

## 4. 流程门禁

1. **需求门禁**：新开发需求进入编码前，经 `.agents/skills/requirements-gate` 产出 `story.md` 并由用户确认 `status: approved`。
2. **验收门禁**：commit 前，相关 approved 未 verified 的 story 须经 `.agents/skills/verification-gate` 由独立 subAgent 验收产出 `verify-report.md`，通过后翻 `verified`。
3. **文档维护**：commit 前，若改动影响架构/设计/约定或用户可感知行为，经 `.agents/skills/docs-maintenance` 同步 AGENTS.md / ARCH.md / DESIGN.md / README / llms.txt。
4. 标注 `[skip-gate]`、非开发消息、已批准任务延续不受 1 约束。

## 5. 分工模式（Leader 模式）

Claude 规划拆解与终审；opencode 执行代码任务（`opencode run --model glm/glm-5.2 --dangerously-skip-permissions`，必须显式 `--model`）；kimi 可作独立验收者。破坏性/不可逆操作（push、删库、对外发布）先经用户确认。

## 6. 版本管理

版本号由 release-please 自动同步，**不要手动修改** `package.json` 与各 workspace manifest 的 `version`。

Commit message 遵循 Conventional Commits：`fix:`→patch、`feat:`→minor、`feat!:`/`BREAKING CHANGE:`→major、`chore:/docs:/refactor:/test:`→无版本变化。合并 master 后 release-please 维护 Release PR，合并即打 tag + GitHub Release。

## 7. CI/CD

| Workflow             | 触发                | 内容                                                                                             |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `ci.yml`             | PR / push to master | web：typecheck+lint+prettier+vitest；contracts/daemon/desktop：typecheck+vitest；docs 一致性脚本 |
| `release.yml`        | `v*.*.*` tag        | 构建 renderer/daemon/Electron，上传 .dmg                                                         |
| `release-please.yml` | push to master      | Release PR 自动维护                                                                              |
