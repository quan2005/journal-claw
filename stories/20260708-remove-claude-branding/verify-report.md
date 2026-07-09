# Verify Report — STORY-20260708-remove-claude-branding

- **轮次**：1（独立 subAgent，仅依据 story.md + design.md + 指定范围文件取证）
- **核对范围**：`apps/daemon/src/server.ts`、`apps/daemon/src/skills/service.ts`、`apps/daemon/src/skills/globalMigration.ts`、`apps/daemon/src/auto_lint/service.ts`、`apps/daemon/src/workspace/migration.ts`、`apps/web/src/locales/en.ts`、`apps/web/src/locales/zh.ts`、`apps/web/src/settings/components/SectionAbout.tsx`
- **result**: **pass**

## AC 逐条核对

### AC-1 — 新命名生效 ✅ pass

| 项 | 证据 | 结论 |
|---|---|---|
| 系统提示词文件 = `AGENTS.md` | `server.ts:1388`（GET 读 `${workspaceRoot()}/AGENTS.md`）、`server.ts:1400`（PUT 写）、`server.ts:1406`（reset 写） | pass |
| workspace 数据目录 = `.agent/` | `auto_lint/service.ts:48` `join(this.workspaceRoot, '.agent')`、`auto_lint/service.ts:70` `join(this.workspaceRoot, '.agent', filename)` | pass |
| 全局目录 = `~/.agent/` | `skills/service.ts:79,88`（openSkillsDir/openSkillDir global → `~/.agent/skills`）、`:103`（scanGlobalSkillsExtended）、`:104`（plugins cache）、`:170,175`（resolveSkillMarkdown global） | pass |
| builtin skills 模板路径 | `skills/service.ts:97,159` → `workspace-template/.agent/skills`；模板目录已物理重命名（`ls apps/web/resources/workspace-template/` 仅存在 `.agent/`，无 `.claude/`） | pass |
| 新 workspace 无 `.claude`/`CLAUDE.md` 被创建或读取 | `migration.ts:56-57` 的 `migrateOne` 在新 workspace 里 `existsSync(src)` 返回 false 直接 return（`migration.ts:116`），不会创建也不会读取内容 | pass |
| 残留运行时 `.claude`/`CLAUDE.md` grep | 仅出现在迁移源参数与注释（`migration.ts:9,56,57`、`globalMigration.ts:5,14,16`、`server.ts:244`）——迁移逻辑必须引用旧名才能执行重命名，属设计必然，非运行时读写新数据。无任何业务路径在新 workspace 创建/读取 `.claude`/`CLAUDE.md` | pass |

### AC-2 — 存量数据自动迁移 ✅ pass

| 项 | 证据 | 结论 |
|---|---|---|
| workspace 级迁移（CLAUDE.md→AGENTS.md、.claude→.agent） | `migration.ts:33` `WORKSPACE_LAYOUT_VERSION = 3`；`migration.ts:56-57` 两条 `migrateOne` 调用；幂等短路 `migration.ts:47`；migrateOne 语义（src 不存在 return、dst 已存在 warn 跳过、否则 mkdir+rename）`migration.ts:115-124` | pass |
| 全局级迁移（~/.claude/{skills,plugins/cache}→~/.agent/{...}） | `globalMigration.ts:13-19` 导出 `migrateGlobalAgentDir`；`migrateGlobalOne` 同构语义（src 不存在 return、dst 已存在 warn 跳过、否则 mkdir+rename）`globalMigration.ts:21-30` | pass |
| 调用时机：daemon 启动最早期、先于 skills 服务 | `server.ts:248-255` 在构造服务集合时即 `try { migrateGlobalAgentDir(homedir()) } catch ...`，先于任何 workspace 访问；`server.ts:265` `migrateWorkspaceLayout(root)` 经 `ensureWorkspaceMigrated` 在 `workspaceRoot()` 首次取值时触发 | pass |
| 迁移幂等性（无版本标记时也安全） | `migrateGlobalOne` 依赖 src-exists check 天然幂等；workspace 端用 layoutVersion=3 短路已迁移 workspace；两者均不会覆盖用户数据 | pass |
| 测试覆盖 | `bunx vitest run src/skills/service.test.ts src/auto_lint/service.test.ts src/workspace/migration.test.ts src/skills/globalMigration.test.ts` → 17/17 passed；migration.test.ts 含 v3 重命名 + target 冲突不覆盖用例 | pass |

### AC-3 — 界面无 Claude 字样 ✅ pass（含 1 项待用户裁决）

| 项 | 证据 | 结论 |
|---|---|---|
| `SectionAbout.tsx` 技术栈文案 | `SectionAbout.tsx:205`：`'macOS · Electron · React · TypeScript · Anthropic API'` —— 无字面 "Claude" | pass |
| `noSkillsHint` 路径文案（en/zh） | `en.ts:251`：`'Add skills to .agents/skills/ in your project or ~/.agent/skills/ globally'`；`zh.ts:277`：`'在项目 .agents/skills/ 或全局 ~/.agent/skills/ 目录中添加技能'` | pass |
| 全仓 `Claude` grep（web+daemon src） | 仅 2 处：`en.ts:380` 与 `zh.ts:405` 的 `protocolHint`：`'Anthropic for Claude models'` / `'Anthropic 协议用于 Claude 模型'` | **见待裁决项 P1** |
| daemon 端 `Claude` 字样 | 仅 `migration.ts:10,54` 与 `migration.test.ts:171` 的代码注释（"drop Claude Code brand"），非 UI 文案 | pass |

### AC-4 — Anthropic 协议调用不受影响 ✅ pass

| 项 | 证据 | 结论 |
|---|---|---|
| engine 调用链零触碰 | `apps/daemon/src/engine/service.ts`（PiEngineService）不在本次改动范围；scope 内文件无 engine/provider 解析改动 | pass |
| engine 测试无回归 | `bunx vitest run src/engine/service.test.ts src/server.test.ts` → 17/17 passed | pass |
| 类型检查 | `apps/daemon && bunx tsc --noEmit` exit 0；`apps/web && bunx tsc --noEmit` exit 0 | pass |

## 越界 / 偏差清单

无。

- `.agents`（复数，project-scoped skills，`skills/service.ts:42,80,89,166`）按 design.md 明确声明保持不变（既有约定，Won't："不重命名与 Claude 无关的内部标识"）——非越界。
- 迁移代码中引用旧名 `.claude`/`CLAUDE.md` 作为迁移源——属实现迁移逻辑的必然，非越界。

## 待用户裁决项

### P1 — `protocolHint` 中的 "Claude models" 字样

- **位置**：`apps/web/src/locales/en.ts:380`、`apps/web/src/locales/zh.ts:405`
- **内容**：`'Anthropic for Claude models, OpenAI Compatible for other providers ...'` / `'Anthropic 协议用于 Claude 模型，...'`
- **冲突**：story.md AC-3 字面要求"不出现 Claude 字样"；但 design.md §"界面文案与厂商语境的边界" 明确把这类"Anthropic API 支持的模型型号说明"归为保留项，理由是"说的是调用 Anthropic 的 API，不是产品品牌自称"。
- **subAgent 立场**：此处 "Claude" 确为**模型型号名**（Anthropic 公司的产品型号），非本产品品牌印记；按 design.md 已 approved 的裁决，计为 pass。但因其与 story.md AC-3 字面表述存在张力，提请用户最终确认是否需要进一步替换（例如改写为 "Anthropic models"）。
- **不影响本次 result 判定**：design.md status=approved 已对此作出明确决策。

**裁定（2026-07-08，主对话）：接受 design.md 已作出的判断，保留 "Claude models" 措辞。** "Claude" 在这两处是 Anthropic 公司的模型型号名（用户配置 API 厂商时需要知道该协议对应哪些模型），不是产品自称品牌，与 story 真实意图（"不与 Claude Code 生态耦合"）不冲突——这正是 design.md 明确划的边界，此处不再改。pending 清零。

## SUMMARY: result=pass | fail=0 | pending=0
