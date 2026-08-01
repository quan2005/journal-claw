---
story: ./story.md
design: ./design.md
plan: ./implementation-plan-phase-0.md
date: 2026-08-01
phase: 0
result: pass
base_commit: 1f3b036d73d3588f2a251d27a8f8813c5610b2a9
scope: 'Phase 0 未提交 working tree；不含 commit、push、PR 合并、tag 或 Release'
---

# 验收报告 — 维护治理 Phase 0

## 结论

Phase 0 通过。版本/发布策略、当前文档一致性和格式债务防回退已经从文字约定落为脚本与 CI 门禁；完整 workspace 测试和三端构建通过；三个分项审查与最终综合审查均批准，最终审查无 Critical、Important 或 Minor 问题。

父 story 保持 `in_progress`：Phase 1–4 的架构边界、写入/迁移通道、风险测试与存量治理尚未实施，本报告不把 Phase 0 通过误写为整个治理 story 已完成。

## AC 映射

| AC   | Phase 0 结论 | 证据与边界                                                                                                                                                              |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | pass         | `AGENTS.md` 作为 hub，ARCH / DESIGN / CONVENTIONS / final-state / ADR 的权威职责已明确；重复的流程细节已收敛。兼容性矩阵等后续权威内容按 Phase 1 建立。                 |
| AC-2 | pass         | 根与四个 workspace 版本锁步为 `0.16.0`；release baseline 对齐；兼容 fix/feat → patch、breaking → minor、禁止自动 1.0、严格 `vX.Y.Z` 均由 policy mutation/CLI 测试强制。 |
| AC-3 | partial      | Phase 0 已自动检查当前文档路径、隐藏目录、越界引用和退休 runtime 路径；完整跨 workspace 依赖/契约/退休能力门禁属于 Phase 1–2。                                          |
| AC-4 | partial      | 当前测试与 CI 门禁已校准并全量复跑；按路径选测、Playwright CI、真实 Electron smoke、覆盖率和 artifact 属于 Phase 2–3。                                                  |
| AC-5 | deferred     | 四类写入通道及迁移安全规则已进入设计和 CONVENTIONS；Migration 实现、N-1 fixture、备份/恢复与停写测试属于 Phase 1–3，Phase 0 未伪造已实现结论。                          |
| AC-6 | pass         | checker 默认扫描 `AGENTS.md` 和全部非 ADR 当前 Markdown；Bun、pi-only、CI 触发与 release 链文档已对齐，历史计划完整归档。                                               |

## 策略与静态门禁

以下命令在最终 working tree 上均以 exit 0 完成：

- `bun run policy:test`：24/24；其中 docs 10、format baseline 5、version 9。
- `bun run policy:version` 与 `node scripts/version-policy.mjs --tag v0.16.0`。
- `node scripts/check-docs-consistency.mjs`：全部非 ADR 当前文档路径存在。
- `bun run format:check`：66 个既有差异的 LF 归一化 SHA-256 指纹未变化，0 个新增或扩大项。
- `git diff --check`。
- Ruby YAML parser 验证三个 workflow；`jq empty` 验证本次 JSON 配置。

格式基线的红绿证据包括：新违规文件、已知违规文件内容变化、基线新增/改写均失败；临时 Git repository 的 CLI 集成测试证明 `FORMAT_BASELINE_REF` 不是无效配置。CI 以 PR base SHA 比较，普通 PR 只能删除基线项。

## Workspace 质量与测试

- contracts build、web/contracts/daemon/desktop typecheck：全部 exit 0。
- web lint：exit 0，0 errors、9 个既有 warnings；本次没有修改对应应用源码。
- contracts：4 files / 20 tests。
- web：56 files / 454 tests。
- daemon：36 files / 236 tests。
- desktop：4 files / 20 tests。
- 合计：100 test files / 730 tests，全部通过。

## 构建与产物

- Web renderer build：exit 0。
- daemon build：exit 0。
- Electron desktop build：exit 0。
- DMG：`apps/desktop/release/JournalClaw-0.16.0-arm64.dmg`，98,113,141 bytes。
- 本地没有 Developer ID，electron-builder 明确跳过代码签名；未执行任何 GitHub 上传。

## 发布与远端边界

- release-please 仍是版本、tag 和 Release notes 的唯一 owner；成功创建 Release 后，同一次 workflow 才调用 release asset job。
- release job 只接受 `v0.x.y`，先确认 Release 存在，再检出 `refs/tags/<tag>`；checkout 禁止持久化凭证，只有最终 `gh release upload` step 显式获得 token。
- PR #31 仍为 OPEN、`mergedAt: null`，标题仍是错误基线生成的 `chore(master): release journal 1.0.0`。
- HEAD 仍为基准 commit `1f3b036d73d3588f2a251d27a8f8813c5610b2a9`；没有 commit、push、merge、tag 或 Release 变更。
- `v0.16.0` Release 仍存在且不是 draft/prerelease。GitHub Actions 的平台级语义解析需在用户批准创建 PR 后由 GitHub 执行，不以本地 YAML parser 冒充。

## 已知债务（非本次新增）

- 66 个格式差异已被内容指纹锁定，只能缩减。
- Web lint 有 9 个既有 warning。
- Web Vitest 在 Node 环境输出 5 次 `localStorage` experimental warning。
- Web build 的 `DetailView` chunk 约 1.15 MB，超过 700 kB warning threshold。
- 本地 DMG 未签名。

这些债务均未因 Phase 0 扩大；warning/coverage/artifact 的结构化基线和清理进入后续阶段。

## 独立审查

- Task 1 版本策略：Approved。
- Task 2 release baseline/workflow：Approved。
- Task 3 docs/format gate：Approved；无任何级别问题。
- 最终综合审查：`Ready to merge: Yes`；Critical 0、Important 0、Minor 0。

“Ready to merge”仅代表技术审查通过，不授予 commit、push、PR 合并或正式发布权限。
