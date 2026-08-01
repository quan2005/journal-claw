# CONVENTIONS — 工程规范（唯一权威出处）

> 本文件是工程流程类约定的唯一权威出处。架构边界见 `ARCH.md`，视觉设计见 `DESIGN.md`，产品北极星见 `final-state.md`。其他文档引用本文时只链接、不复述。

## 1. 常用命令

```bash
# Dev
bun run desktop:dev     # Vite + Electron
bun run dev             # 仅前端（localhost:1420）
bun run daemon:dev      # 仅 daemon

# 测试
bun run test                                      # 全 workspace Vitest
bunx vitest run src/tests/JournalItem.test.tsx    # app 目录内单文件
bun run --filter @journal/daemon test             # daemon
bun run --filter @journal/desktop test            # desktop
bun run test:e2e                                  # Playwright E2E

# 政策与质量
bun run policy:test
bun run policy:version
node scripts/check-docs-consistency.mjs
bun run build
bun run lint
bun run format:check     # 存量基线不得增加
bun run format:strict    # 显示全部待清理格式债

# 生产构建
bun run desktop:build
```

包管理器固定为 `package.json#packageManager` 声明的 Bun；本地与 CI 都使用 `bun install --frozen-lockfile` 验证锁文件。

## 2. 目录约定

- `apps/web` 前端（React 19 + Vite）；`apps/daemon` 业务后端（Express HTTP/SSE）；`apps/desktop` Electron 宿主（零业务语义）；`packages/contracts` 跨端契约类型。
- daemon service 按能力分目录（journal/topics/runs/engine/…），service 层承载业务语义，route 层只做协议适配。
- 前端测试在 `apps/web/src/tests/`；hooks 内联测试允许放在 hooks 目录。
- story、design、实施计划和验收报告放在 `stories/<YYYYMMDD>-<slug>/`；历史产物只放 `stories/_archive/`。

## 3. 测试与质量策略

- 新增业务能力（daemon service / 前端 hook / 组件行为）必须带 Vitest 覆盖；bugfix、视觉和交互修复先写能解释原因的红测试，再做最小修复。
- 视觉修复必须验证真实渲染链：`renderMarkdown` → `.md-content` → `markdown.css`；大文件走 `MarkdownRenderer`。孤立组件或普通 Vite probe 不能替代真实 CSS cascade 验证。
- E2E（Playwright）覆盖跨面板主流程，不替代单元和服务集成测试；使用用户可见 locator 和 web-first assertion。
- commit 前硬门：policy、文档一致性、format、typecheck、lint、相关测试与 build 全绿。独立 AI 验收不能豁免失败的可复现门禁。
- `format:check` 以 `scripts/format-baseline.json` 的文件内容指纹记录 master 既有差异：新违规文件、已知文件内扩大/改写格式债、相对 PR 目标分支新增或改写基线条目都会失败；完整格式化某个文件可直接缩减基线。紧急扩容必须单独提出治理变更，经独立批准和风险说明后先落目标分支，不得与引入格式债的代码变更同批放行。`format:strict` 用于查看全量清理债，不是当前合并门。
- 架构边界当前由 `apps/web/eslint.config.js` 护栏与 `scripts/check-docs-consistency.mjs` 部分强制；其余 workspace 和传递依赖门禁按维护治理后续阶段补齐。在此之前不得新增已知越界。
- 存量 warning 和格式差异必须建账且不得增加；新 warning 或基线外格式差异视为失败。

## 4. 流程门禁

1. **需求门禁**：影响产品行为、架构、数据、权限或发布链的开发，在编码前创建 `stories/<YYYYMMDD>-<slug>/story.md`。story 必须包含可量化成功标准、Given-When-Then AC 与明确非目标；只有用户批准后才能将 frontmatter `status` 设为 `approved`。
2. **设计与计划**：多模块或高风险变更在同一 story 目录写 `design.md` 与 `implementation-plan*.md`。影响跨模块依赖、数据格式、安全模型、公共契约或不可逆选择时新增 ADR。
3. **验收门禁**：commit 前，相关 approved/in_progress story 必须由未参与实现的 Codex 独立核对 AC、范围与真实运行证据，产出 `verify-report.md` 或带阶段后缀的报告。任一适用 AC 未过即保持 `in_progress` 并记录缺口；全部阶段通过后才能设为 `verified`。
4. **文档维护**：若改动影响架构、设计、工程约定或用户可感知行为，commit 前核对并按职责更新 AGENTS / ARCH / DESIGN / CONVENTIONS / final-state / README / llms.txt；只更新真正受影响的权威文件。
5. **例外**：不允许永久 `skip-gate`。紧急例外必须记录原因、风险、责任人、补验计划和失效日期；对外发布、不可逆迁移、删除用户数据、push/tag/Release 仍需用户确认。

## 5. AI 协作模式

- 维护者负责目标、架构决策、任务拆解与最终整合；实现任务可委派给不同 AI Agent，但每个任务必须有专属 goal、验收标准和可用素材。
- 实现者先自测；未参与实现的 Codex 做需求符合性验收。CI 是最终工程硬门。
- 多个实现任务只在文件和状态互不冲突时并行；共享热点文件按顺序执行。
- 禁止把某个模型、CLI 或会话记忆作为永久流程依赖；可复现命令和仓库证据才是长期接口。

## 6. 版本管理

- JournalClaw 暂不进入 1.0。根 package 与四个 workspace manifest 锁步，版本和 CHANGELOG 由 release-please 维护，普通 PR 禁止手改。
- `0.x` 语义：`fix` 和向后兼容的 `feat` 升 patch；任何类型的 `!` / `BREAKING CHANGE:` 升 minor。`1.0.0` 必须有独立准入 story 并由用户明确批准。
- Commit/PR 标题遵循 Conventional Commits；建议 squash merge，确保默认分支历史可由 release-please 解析。
- 公开 tag 固定为 `vX.Y.Z`。`.release-please-manifest.json`、tag 与全部 package version 必须一致，由 `bun run policy:version` 强制。
- release-please 是版本、CHANGELOG、tag 和 GitHub Release 正文的唯一生成器；资产 workflow 只验证、构建和上传 DMG。

## 7. CI/CD

| Workflow             | 触发                       | 内容                                                                                                                               |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`             | PR 到 master               | policy/docs、Web typecheck/lint/format/Vitest、contracts/daemon/desktop typecheck+Vitest；Windows 复跑类型/测试与 web/daemon build |
| `release-please.yml` | push 到 master             | 维护 Release PR；合并 Release PR 后创建 tag/Release，并在同一 run 调用资产 workflow                                                |
| `release.yml`        | `workflow_call` / 人工恢复 | 在指定既有 `v0.x.y` tag 上复跑 policy/质量/测试/build，上传 DMG；不生成或覆盖 Release notes                                        |

正常 CI 保持 PR-only；release job 在发布提交上复用完整质量门。Release PR 的合并、人工恢复和任何对外发布操作都需要用户确认。
