---
story: ./story.md
design: ./design.md
date: 2026-07-04
round: 3
result: fail
scope: >
  核对 r2 的 fail 项修复并全量回归：
  package.json、apps/{web,daemon,desktop}/package.json、
  apps/web/src/tests/packageScripts.test.ts、.bunfig.toml、bun.lock、
  scripts/fix-electron.mjs、apps/desktop/scripts/clean-dev-ports.mjs、
  .github/workflows/{ci,release}.yml、README.md、README.cn.md、AGENTS.md、
  docs/{CONVENTIONS,verification-standard,dev/setup,dev/building,dev/backend,final-state}.md、
  apps/desktop/README.md，以及已删除的 pnpm-lock.yaml / pnpm-workspace.yaml。
  工作目录中其他未提交改动未纳入本次核对。
---

# 验收报告 — 将 monorepo 包管理器从 pnpm 迁移到 bun（r3）

## 与 r2 的差异

- r2 的 fail 项已修复：
  - `pnpm-workspace.yaml` 已删除（`git status --short` 显示 `D pnpm-workspace.yaml`）。
  - `docs/dev/setup.md:47,50,61-63` 与 `docs/dev/backend.md:50-51` 的 `npx` 已替换为 `bunx`。
  - `stories/20260704-bun-package-manager/verify-report.md` 已格式化，`bun run format:check` 通过。
- r2 的「待用户裁决」项不再成立：当前 `story.md:62` 写的是 `bun run test`，而非 `bun test`；`bun run test` 已通过 712 测试。
- r3 新发现：scope 内文档仍有旧命令残留，见「结论」fail 项。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | ✅ pass | `package.json:8-12,24` 脚本已切到 `bun run --filter`，`packageManager` 声明 `bun@1.3.14`；`.bunfig.toml:1` 启用 lifecycle scripts；`bun install --frozen-lockfile` 成功（`Checked 916 installs across 1034 packages (no changes)`，含 `lefthook install` + `node scripts/fix-electron.mjs`）；`bun run dev` 启动 Vite 到 `http://localhost:1420/`；`bun run desktop:dev` 启动后 Electron 窗口加载、`[desktop:daemon] healthy at http://127.0.0.1:17510`；`bun run test` 通过 712 测试（web 395 + contracts 20 + daemon 277 + desktop 20）。 |
| AC-2 | ✅ pass | `package.json:12` 使用 `bun run --filter '*' test`；`apps/daemon/package.json:8` 用 `bun run --filter @journal/contracts build`；实测 `bun run --filter @journal/web build`、`bun run --filter @journal/daemon build`、`bun run --filter @journal/desktop typecheck` 均成功，范围行为等价于原 `pnpm --filter`。                                                                                                                                                                                                                             |
| AC-3 | ✅ pass | `.github/workflows/ci.yml:14-17` 与 `release.yml:19-22` 已换为 `oven-sh/setup-bun@v2` + `bun-version-file: package.json` + `bun install --frozen-lockfile`；`ci.yml:30-47` 新增 `windows-latest` job；本地 `bun run lint` 退出码 0、`bun run format:check` 全绿、`node scripts/check-docs-consistency.mjs` OK；`bun run build` 产物构建成功并产出 DMG。                                                                                                                                                                                     |
| AC-4 | ✅ pass | `pnpm-lock.yaml` 与 `pnpm-workspace.yaml` 已删除（`git diff --name-only --diff-filter=D` 均命中）；新增 `bun.lock` 为 bun 1.2+ 文本格式（`bun.lock:1-4`）；`bun install --frozen-lockfile` 校验锁文件与 manifest 一致（"no changes"）。                                                                                                                                                                                                                                                                                                     |

## 范围完整性（不少，对照 story.md 范围）

- **本地与 CI 统一使用 bun**：根 `package.json:24` 声明 `"packageManager": "bun@1.3.14"`，`.github/workflows/ci.yml` 与 `release.yml` 已切换。✅
- **脚本入口不变**：`package.json:8-18` 仍提供 `dev`、`desktop:dev`、`build`、`test`、`lint` 等同名脚本；`README.md:100-109`、`README.cn.md:100-109`、`AGENTS.md:22-27`、`docs/CONVENTIONS.md:7-29` 仍保留 `npm run <script>` 示例。✅
- **不改动业务代码**：包管理器相关改动仅涉及 `package.json`、CI、文档与辅助脚本；`apps/daemon/src`、`apps/web/src` 等业务源文件的改动未纳入本次核对。✅
- **不引入 Bun 运行时 API**：在 `apps/**/*.{ts,tsx,mjs}` 与 `packages/**/*.{ts,tsx,mjs}` 中搜索 `\bBun\.[a-zA-Z]` 无命中。✅
- **版本号管理不变**：根与各 workspace `version` 仍为 `0.16.0`，未手改。✅
- **Windows 一等公民**：`apps/desktop/scripts/clean-dev-ports.mjs:52-70/90-111/193-202` 增加 Windows 分支；`.github/workflows/ci.yml:30-47` 新增 Windows runner。✅

## 方案落实（不偏，对照 design.md）

| design 决策                                                     | 落实情况 | 证据                                                                                                                                                                                        |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单 lock 文件，不保留 pnpm 双轨                                  | 已落实   | `bun.lock` 新增；`pnpm-lock.yaml` 与 `pnpm-workspace.yaml` 均已删除。                                                                                                                       |
| 脚本命令映射 `npx -> bunx`、`pnpm --filter -> bun run --filter` | 已落实   | `apps/web/package.json:10` 使用 `bunx tailwindcss`；各 `package.json` 已切换 `bun run --filter`；`docs/dev/setup.md:47,50,61-63` 与 `docs/dev/backend.md:50-51` 的 `npx` 已替换为 `bunx`。  |
| CI 换 `oven-sh/setup-bun@v2`，新增 Windows job                  | 已落实   | `.github/workflows/ci.yml:14-47`、`.github/workflows/release.yml:18-24`。                                                                                                                   |
| Electron 二进制修复                                             | 已落实   | `scripts/fix-electron.mjs` 新增；`package.json:18` `postinstall` 调用；`bun install` 后输出 `electron binary is already complete`。                                                         |
| Windows 适配 clean-dev-ports                                    | 已落实   | `apps/desktop/scripts/clean-dev-ports.mjs:26/52-70/90-111/193-202`。                                                                                                                        |
| lifecycle scripts 启用                                          | 已落实   | `.bunfig.toml:1` 设置 `ignoreScripts = false`。                                                                                                                                             |
| 文档更新                                                        | 未完全   | `docs/CONVENTIONS.md:43` 写 `bun test`，`docs/verification-standard.md:123` 示例写 `bun test -- ...`，`docs/verification-standard.md:213` 写 `pnpm install`，均与本迁移后的实际命令不一致。 |

## 越界检查（不多，对照 story 非目标 + design 范围）

- 包管理器相关 diff 均能归属到 design 范围（lock 文件替换、脚本切换、CI 改造、Electron 修复、Windows 适配、文档更新）。
- 未发现命中 story 非目标的功能性改动。
- `verify-report.md` 的 prettier 格式化修复不属于产品代码越界，仅为验收报告自身格式合规。
- 工作目录中另有大量与本次 story 无关的未提交改动（daemon service、web 组件、其他 story/verify-report 等），未纳入本次核对。

## 冗余（不重，对照 story.md）

- 未发现同一 AC 的多套独立实现。

## 结论

`result: fail`。

### 需修复项（按风险排序）

1. **修正 scope 内文档中的旧命令/示例**（低风险）—— 这些命令在迁移后已不成立或会失败：
   - `docs/CONVENTIONS.md:43`：`bun test` 应改为 `bun run test`（`bun test` 会调用 bun 内建 test runner，与 vitest 不兼容）。
   - `docs/verification-standard.md:123`：`bun test -- ChatPanel.test.tsx` 示例应改为 `bun run test -- ChatPanel.test.tsx`。
   - `docs/verification-standard.md:213`：`pnpm install` 应改为 `bun install`。
     修复方式：直接替换上述三处命令，保持文档与 `package.json` 脚本及实际 CI/本地命令一致。

## 待用户裁决

- 无。当前 `story.md` 已使用 `bun run test`，r2 的 `bun test` 字面争议不再适用。

## 关键取证命令摘要

```bash
# bun 版本
bun --version   # 1.3.14

# 安装与 lock 一致性
bun install --frozen-lockfile   # Checked 916 installs across 1034 packages (no changes)

# 开发启动
bun run dev                     # Vite -> http://localhost:1420/
bun run desktop:dev             # Electron 窗口 + daemon healthy

# 测试与构建
bun run test                    # 712 tests passed
bun run build                   # web/daemon/desktop 全构建，DMG 产出
bun run lint                    # exit 0（9 warnings）
bun run format:check            # All matched files use Prettier code style!
node scripts/check-docs-consistency.mjs  # OK

# 范围检查
git diff --name-only --diff-filter=D HEAD   # pnpm-lock.yaml pnpm-workspace.yaml
```
