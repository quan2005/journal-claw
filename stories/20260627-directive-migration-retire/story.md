---
id: STORY-20260627-directive-migration-retire
title: "下线 directiveMigration 与 compile_mdx 残留"
status: verified
source: gate
level: L1
hypothesis_basis: data
design: N/A
created: 2026-06-27
related:
  - ../20260627-mdx-retire/story.md
---

# 下线 directiveMigration 与 compile_mdx 残留

> 一句话概括：**为继续维护 MDX 下线结果的项目执行工程师解决失效迁移入口仍残留的问题**

## 用户故事（Connextra）

作为 **正在维护 JournalClaw MDX 下线结果的项目执行工程师**，
当我 **清理 MDX 彻底移除后的剩余调用链**，
我希望 **失效的旧 directive 到 MDX 迁移入口不再出现在前端、daemon 或测试中**，
以便 **后续开发不会误用已失效工具，且 compile_mdx 不再被 directiveMigration 残留牵引保留**。

## 真实用户问题（背景，讲故事）

MDX 已在 `stories/20260627-mdx-retire/story.md` 完成下线并验证，但该 story 的遗留决策明确指出：`compile_mdx` 残留仍被 `directiveMigration` 依赖，而 `directiveMigration` 的目标是“旧 directive 格式 → MDX”。用户已决定自行编写 `.md` 迁移脚本，因此该工具不再符合产品方向。[证据：`stories/20260627-mdx-retire/story.md`；用户 2026-06-27 指令]

### 现状失败模式

- 用户现在怎么解决：项目执行者需要记住 `directiveMigration` 已失效，并避免从设置入口或 runtime 映射误触发它。[证据：用户指明 `SectionGeneral`、`tauri.ts`、`httpRuntimeClient.ts`、daemon 路由仍有触点]
- 为什么不够好：失效迁移工具仍暴露入口和 API 映射，容易让后续维护误以为 MDX 编译能力仍可用，增加 MDX 下线后的认知负担。[推测，基于当前残留调用链]
- 哪些数据/反馈支撑：用户已列出必须删除的文件、目录、调用点和 grep 验证目标，并明确“MDX 已彻底移除，用户决策”。[证据：用户 2026-06-27 指令]

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，项目执行工程师会：
- 残留排查：`apps/web/src` 与 `apps/daemon/src` 中 `directiveMigration|directive_migration|compile_mdx|compileMdx|legacyDirectives` 命中从当前多处残留 → 0 个有效残留
- 验证反馈：web 与 daemon 的 TypeScript 检查为 0 错误；web vitest 不新增失败（接受用户给定基线 9 个既有失败）；daemon vitest 从 448 项基线扣除删除的 directive migration 2 项后为 446 项通过

假设依据：以上基于已验证的 MDX 下线 story、当前代码检索结果和用户明确决策。通过本次 grep、tsc、vitest 验证。

## 验收标准（Given-When-Then）

### AC-1 — 失效入口不可见
- **Given** 用户打开通用设置区域
- **When** 浏览 General 设置项
- **Then** 不再看到旧 directive 到 MDX 迁移入口
- **And** 不存在可触发该迁移的前端调用路径

### AC-2 — 失效 runtime 能力不可调用
- **Given** 前端或 HTTP runtime client 枚举可调用能力
- **When** 查找 `compile_mdx`、`apply_directive_migration`、`scan_legacy_directive_files`
- **Then** 这些能力不再从 web 封装或 daemon HTTP 映射暴露

### AC-3 — 残留代码清零
- **Given** 开发者在 `apps/web/src` 和 `apps/daemon/src` 中执行残留检索
- **When** 搜索 `directiveMigration|directive_migration|compile_mdx|compileMdx|legacyDirectives`
- **Then** 结果为 0 个有效命中

### AC-4 — 既有主线不回退
- **Given** 开发者完成清理
- **When** 分别运行 web 与 daemon 的 TypeScript 检查和测试
- **Then** TypeScript 检查为 0 错误
- **And** web vitest 不新增失败，允许维持用户给定的 9 个既有失败基线
- **And** daemon vitest 不回退，测试数量为用户给定 448 项基线减去删除的 directive migration 2 项，即 446 项通过

## 三类边界（脊柱 Q5 · Won't）

- **不为哪些用户做**：不为仍希望继续使用旧 directive 到 MDX 自动迁移工具的用户保留入口；用户已决定自行写 `.md` 迁移脚本。
- **不在哪些场景出现**：不在设置页、web runtime 封装、HTTP runtime 映射或 daemon HTTP 路由中继续出现该能力。
- **不解决哪些相关但不同的问题**：不删除 Rust 侧 `directive_migration.rs` 与 `mdx.rs`，不处理历史文档中的 MDX 叙述，不重做 Markdown 迁移脚本，不调整 MDX 降级渲染策略。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] 删除哪些前端文件和测试，如何避免悬空 import？
- [ ] daemon 路由和 service 删除后，server 类型与测试是否需要同步调整？
- [ ] `SectionGeneral` 删除入口后，设置页测试中的 mocks 和断言如何收窄？
- [ ] 验证命令的基线结果如何记录？

## 待确认（意图层）

| # | 问题 | 当前默认值 | 状态 |
|---|---|---|---|
| Q1 | 是否整体下线 directiveMigration，而不是改为输出纯 Markdown？ | 整体下线 | 已由用户 2026-06-27 指令确认 |
| Q2 | 是否保留 Rust 侧同名残留？ | 保留到 M8 | 已由用户 2026-06-27 指令确认 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：在已完成 MDX 下线后，可独立清理该残留链路
- [x] **N** Negotiable：范围限定为用户列出的 web/daemon 残留，不扩大到 Rust 或历史文档
- [x] **V** Valuable：减少失效入口和已下线能力的误用
- [x] **E** Estimable：触点、验证命令和不做范围明确
- [x] **S** Small：单次清理任务，可在一个开发回合内完成
- [x] **T** Testable：AC 覆盖 UI 入口、runtime 暴露、grep、tsc 和 vitest

## 门禁记录

| 轮次 | 日期 | Readiness | 主要缺口 |
|---|---|---|---|
| 1 | 2026-06-27 | 可开发 | 用户已明确选择整体下线；无意图层缺口 |
