---
story: ./story.md
status: approved
created: 2026-07-09
---

# Design: 剔除产品内所有 Claude 元素

## 范围清点（已读代码核实，逐条对应改动）

| # | 现状 | 改动 |
|---|---|---|
| 1 | `apps/daemon/src/server.ts:1374,1386,1392` 读写 workspace 根 `CLAUDE.md` 作为系统提示词 | 改成 `AGENTS.md` |
| 2 | `apps/daemon/src/skills/service.ts` 6 处 `join(this.homeDir, '.claude', ...)`（全局 skills 目录 + plugins cache，行 79/88/103/104/159/170/175） | 改成 `join(this.homeDir, '.agent', ...)` |
| 3 | `apps/daemon/src/skills/service.ts:97,166` 引用 `apps/web/resources/workspace-template/.claude/skills`（仓库内置技能模板，随应用打包，非用户数据） | 目录物理重命名为 `apps/web/resources/workspace-template/.agent/skills`，两处引用路径同步改 |
| 4 | `apps/daemon/src/auto_lint/service.ts:48,70` 用 `join(this.workspaceRoot, '.claude')` 存 lint checkpoint 状态 | 改成 `join(this.workspaceRoot, '.agent')` |
| 5 | `apps/web/src/locales/en.ts:251`、`zh.ts:277` 的 `noSkillsHint` 文案含 `.claude/skills`/`~/.claude/skills` 路径提示 | 同步改成 `.agent/skills`/`~/.agent/skills` |
| 6 | `apps/web/src/settings/components/SectionAbout.tsx:205` 技术栈列表含字面 "Claude" | 改成 "Anthropic API"（保留厂商名，去掉产品名） |
| 7 | 测试：`apps/daemon/src/auto_lint/service.test.ts`、`apps/daemon/src/skills/service.test.ts` 引用 `.claude` 路径的用例 | 同步改成 `.agent` |

**不动**（已核实，明确排除）：
- 本仓库自己的 `/Users/yanwu/Projects/github/journal_claw/.claude/`、根 `CLAUDE.md`（开发者用 AI 工具配置，非产品运行时，story Won't 已声明）。
- `apps/daemon/src/skills/service.ts` 里 project-scoped skills 已经用的是 `.agents`（复数，行 80/89/166）——**不改**，这是既有约定，不属于本次"剔除 Claude 元素"范围（Won't："不重命名与 Claude 无关的内部标识符"）。本次新增的 workspace 级 `.agent`（单数，见改动 4）与既有 `.agents`（复数，project skills）并存，是两个不同概念（前者是 lint 状态存储位置，后者是 skills 目录），命名不统一是已有事实，非本故事引入，design 在此如实记录、不试图顺手统一（避免越界）。
- `apps/web/src/locales/*.ts` 里"Claude models"这类描述 Anthropic API 支持的模型名文案——不是产品品牌自称，是厂商模型型号说明，保留。

## 迁移机制：复用现成的一次性幂等迁移模式

`apps/daemon/src/workspace/migration.ts` 已经有一套成熟模式（story `20260706-workspace-disk-contract`）：`migrateWorkspaceLayout(root)` 在每次 workspace 访问时调用，用 `WORKSPACE_LAYOUT_VERSION` 幂等短路，`migrateOne(src, dst)` 私有辅助做"存在 src 且不存在 dst 才 rename，目标已存在就跳过并告警、绝不覆盖用户数据"。**本次改动两条路径分别复用/新增同构逻辑，不是两两拍脑袋写新代码**：

### workspace 级迁移（CLAUDE.md、.claude/）—— 扩展现有 migration.ts

`migrateWorkspaceLayout(root)` 里追加两行 `migrateOne` 调用：

```ts
migrateOne(join(root, 'CLAUDE.md'), join(root, 'AGENTS.md'))
migrateOne(join(root, '.claude'), join(root, '.agent'))
```

`WORKSPACE_LAYOUT_VERSION` 从 2 升到 3（触发已迁移过 v2 的 workspace 再跑一次，因为新增的两个 `migrateOne` 之前从未执行过；`migrateOne` 本身天然幂等——src 不存在就直接 return，所以重复调用不会误伤全新 workspace 或已经手动用新命名的 workspace）。

### 全局（home 目录）级迁移（~/.claude/skills、~/.claude/plugins/cache）—— 新增一次性迁移，daemon 启动时跑一次

home 目录迁移和 workspace 无关（不随"访问某个 workspace"触发，而是每次 daemon 启动、独立于当前 workspace 判断一次）。新建 `apps/daemon/src/skills/globalMigration.ts`（或直接加进 `skills/service.ts` 顶部作为一个导出函数，取决于实现时哪个更自然，不强制新文件）：

```ts
import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'

/** One-shot migration: ~/.claude/{skills,plugins/cache} → ~/.agent/{skills,plugins/cache}.
 * Mirrors workspace/migration.ts's migrateOne semantics: only moves when the
 * source exists and the destination doesn't; never overwrites. */
export function migrateGlobalAgentDir(homeDir: string): void {
  migrateOne(join(homeDir, '.claude', 'skills'), join(homeDir, '.agent', 'skills'))
  migrateOne(join(homeDir, '.claude', 'plugins', 'cache'), join(homeDir, '.agent', 'plugins', 'cache'))
}
```

（`migrateOne` 的实现直接照抄 `workspace/migration.ts` 里那个私有函数的逻辑——src 不存在则 return；dst 已存在则 `console.warn` 并跳过、不覆盖；否则 `mkdirSync(dirname(dst), {recursive:true})` + `renameSync`。可以把 `workspace/migration.ts` 里的 `migrateOne` 改成 `export` 复用，或在新文件里复制一份同样逻辑——两种都可以，实现时选阻力小的那个，不强制哪种。）

调用时机：daemon 启动流程里（`apps/daemon/src/server.ts` 的 `startDaemon` 或其调用链最早期、在任何 skills 服务被使用之前）调一次 `migrateGlobalAgentDir(homedir())`。不依赖某个具体 workspace，所以不能放进 `migrateWorkspaceLayout`（那是 per-workspace 的）。

**幂等性**：`migrateGlobalAgentDir` 本身通过 `migrateOne` 的 src-exists-check 天然幂等，不需要额外的版本标记文件——每次调用如果 `~/.claude/skills` 已经被上次迁移搬空（不存在了），直接 no-op。

## 界面文案与厂商语境的边界（对照 AC-3、Won't）

- Anthropic 作为 API 协议/厂商名的场景保留不动（`docs/CONVENTIONS.md`、`SectionAiEngine.tsx` 里 `Anthropic` provider 相关文案都不属于"Claude 品牌印记"，不在清点范围内——已确认这些文案说的是"调用 Anthropic 的 API"，不是"这是 Claude Code 生态的一部分"）。
- 只清点到 1 处真正的 UI "Claude" 字样（`SectionAbout.tsx:205` 技术栈列表），文案改为 "Anthropic API"。

## AC-4（Anthropic 协议调用不受影响）确认

本次改动零触碰 `apps/daemon/src/engine/service.ts`（PiEngineService 的 provider/model 解析逻辑）、`apps/daemon/src/config/service.ts`（EngineConfig）——Anthropic API 调用链路完全独立于本次重命名的路径，不需要额外验证代码，靠现有 engine 测试覆盖即可（`engine/service.test.ts` 不在本次改动范围，跑一遍确认没有回归）。

## 验证命令

```bash
cd apps/daemon && bunx vitest run src/skills/service.test.ts src/auto_lint/service.test.ts src/workspace/migration.test.ts src/server.test.ts src/engine/service.test.ts
cd apps/daemon && bunx vitest run
cd apps/daemon && bunx tsc --noEmit
cd apps/web && bunx vitest run
cd apps/web && bunx tsc --noEmit
npm run build
# AC-1/AC-3 的最终验证：全仓运行时代码 grep 应该为 0（排除本仓库自己的 .claude/CLAUDE.md 开发配置）
grep -rn "CLAUDE\.md\|\.claude" apps/daemon/src apps/web/src apps/web/resources --include="*.ts" --include="*.tsx" | grep -v node_modules
```

## 边界重申（继承 story.md Won't，不重复展开）

不移除 Anthropic API 协议支持；不重命名与 Claude 无关的内部标识（既有的 `.agents` project-scope 命名保持不变，不顺手统一成 `.agent`）；不改本仓库自己的开发配置 `CLAUDE.md`/`.claude/`；外部引擎 adapter 删除已由 `remove-cli-engines` 完成，不在本故事重复处理。
