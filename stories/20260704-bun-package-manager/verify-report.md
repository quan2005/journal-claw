---
story: ./story.md
design: ./design.md
date: 2026-07-04
round: 1
result: fail
scope: >
  重点核对 story 指定的包管理器迁移相关文件：
  package.json、apps/*/package.json、.github/workflows/*.yml、docs/**/*.md、
  README*.md、AGENTS.md、scripts/fix-electron.mjs、
  apps/desktop/scripts/clean-dev-ports.mjs、bun.lock、.bunfig.toml
  以及已删除的 pnpm-lock.yaml。
  工作目录中尚有大量与本次 story 无关的未提交改动，未纳入本次核对。
---

# 验收报告 — 将 monorepo 包管理器从 pnpm 迁移到 bun

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论              | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | ✅ pass（有保留） | `package.json:8,9,12` 脚本已切到 `bun run --filter`；`bun install --frozen-lockfile` 成功（含 `lefthook install` + `node scripts/fix-electron.mjs`）；`bun run dev` 启动 Vite 到 `http://localhost:1420/`；`bun run desktop:dev` 启动后 Electron 窗口加载、daemon health 正常；`bun run test` 通过 712 测试；`bun run build` 全 workspace 构建成功并产出 DMG。保留项：story 字面要求 `bun test` 可执行，但 `bun test` 调用的是 bun 内建 test runner，与项目使用的 vitest 不兼容，见「待用户裁决」。 |
| AC-2 | ✅ pass           | `package.json:12` 使用 `bun run --filter '*' test`；`apps/daemon/package.json:8` 用 `bun run --filter @journal/contracts build`；实测 `bun run --filter @journal/web build`、`bun run --filter @journal/daemon build`、`bun run --filter @journal/desktop typecheck` 均成功，范围行为等价于原 `pnpm --filter`。                                                                                                                                                                                     |
| AC-3 | ✅ pass           | `.github/workflows/ci.yml:14-17` 与 `release.yml:19-22` 已换为 `oven-sh/setup-bun@v2` + `bun-version-file: package.json` + `bun install --frozen-lockfile`；`ci.yml:30-47` 新增 `windows-latest` job；本地 `bun run lint` 退出码 0、`bun run format:check` 全绿、`node scripts/check-docs-consistency.mjs` OK；`bun run build` 产物构建成功。                                                                                                                                                       |
| AC-4 | ✅ pass           | `pnpm-lock.yaml` 已删除（`git status` 显示 `D pnpm-lock.yaml`）；新增 `bun.lock` 为 bun 1.2+ 文本格式（`bun.lock:1-4`）；`bun install --frozen-lockfile` 校验锁文件与 manifest 一致（"no changes"）。                                                                                                                                                                                                                                                                                               |

## 范围完整性（不少，对照 story.md 范围）

- **本地与 CI 统一使用 bun**：根 `package.json:24` 声明 `"packageManager": "bun@1.3.14"`，`.github/workflows/ci.yml` 与 `release.yml` 已切换。✅
- **脚本入口不变**：`package.json:8-18` 仍提供 `dev`、`desktop:dev`、`build`、`test`、`lint` 等同名脚本；`README.md:100-109`、`README.cn.md:100-109`、`AGENTS.md:22-27`、`docs/CONVENTIONS.md:7-29` 仍保留 `npm run <script>` 示例。✅
- **不改动业务代码**：`apps/daemon/src`、`apps/web/src` 等源文件虽有大量未提交改动，但均与本次迁移无关；包管理器相关改动仅涉及 `package.json`、CI、文档与辅助脚本。✅
- **不引入 Bun 运行时 API**：在 `apps/**/*.{ts,tsx,mjs}` 中搜索 `\bBun\.[a-zA-Z]` 无命中。✅
- **版本号管理不变**：根与各 workspace `version` 仍为 `0.16.0`，未手改。✅
- **Windows 一等公民**：`apps/desktop/scripts/clean-dev-ports.mjs:52-70/90-111/193-202` 增加 Windows 分支；`.github/workflows/ci.yml:30-47` 新增 Windows runner。✅

## 方案落实（不偏，对照 design.md）

| design 决策                                                     | 落实情况 | 证据                                                                                                                                                                                          |
| --------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单 lock 文件，不保留 pnpm 双轨                                  | 已落实   | `bun.lock` 新增；`pnpm-lock.yaml` 删除。                                                                                                                                                      |
| 脚本命令映射 `npx -> bunx`、`pnpm --filter -> bun run --filter` | 基本落实 | `apps/web/package.json:10` 使用 `bunx tailwindcss`；各 `package.json` 已切换 `bun run --filter`。但 `docs/dev/setup.md:47,50,61-63` 与 `docs/dev/backend.md:50-51` 仍残留 `npx`，见 fail 项。 |
| CI 换 `oven-sh/setup-bun@v2`，新增 Windows job                  | 已落实   | `.github/workflows/ci.yml:14-47`、`.github/workflows/release.yml:18-24`。                                                                                                                     |
| Electron 二进制修复                                             | 已落实   | `scripts/fix-electron.mjs` 新增；`package.json:18` `postinstall` 调用；`bun install` 后输出 `electron binary is already complete`。                                                           |
| Windows 适配 clean-dev-ports                                    | 已落实   | `apps/desktop/scripts/clean-dev-ports.mjs:26/52-70/90-111/193-202`。                                                                                                                          |
| lifecycle scripts 启用                                          | 已落实   | `.bunfig.toml:1` 设置 `ignoreScripts = false`。                                                                                                                                               |

## 越界检查（不多，对照 story 非目标 + design 范围）

- ❌ **残留 `pnpm-workspace.yaml`**：`pnpm-workspace.yaml:1-3` 仍存在，与 story「不再维护 pnpm 双轨」冲突。该文件现已被 bun 的 `package.json#workspaces` 取代，属于未清理的 pnpm 兼容路径。
- ❌ **文档未完整执行 `npx -> bunx` 映射**：`docs/dev/setup.md:47,50,61-63` 与 `docs/dev/backend.md:50-51` 仍写 `npx vitest run` / `npx tsc --noEmit`，与 design「脚本命令映射」不一致。
- 其余包管理器相关 diff（`dev:clean` 脚本、`wait-on http-get` 等）均能归属到 design 的 Electron 修复或 Windows 适配条目，不视为越界。
- 工作目录中另有大量与本次 story 无关的未提交改动（daemon service、web 组件、其他 story/verify-report 等），未纳入本次核对。

## 冗余（不重，对照 story.md）

- 未发现同一 AC 的多套独立实现。

## 结论

`result: fail`。

### 需修复项（按风险排序）

1. **删除 `pnpm-workspace.yaml`**（中风险）—— 清理 pnpm 遗留配置，避免贡献者/CI 工具链回退到 pnpm 解析路径。
2. **将 `docs/dev/setup.md` 与 `docs/dev/backend.md` 中的 `npx` 替换为 `bunx`**（低风险）—— 保持文档与 design 映射一致，避免新开发者混用 npm/npx。

### 待用户裁决项

- **AC-1 中 `bun test` 的字面要求**：story.md 写 `bun test` 可正常执行，但项目使用 vitest，`bun test` 会调用 bun 内建 runner 并失败；`bun run test`（即 `package.json` 的 `test` 脚本）通过全部 712 测试。
  - 若用户原意是 `bun run test`：请回写 story.md 为 `bun run test`，本项即可通过。
  - 若坚持 `bun test`：需要把测试框架从 vitest 迁移到 bun test，或提供包装，代价远大于本次包管理器迁移范围。

## 关键取证命令摘要

```bash
# bun 版本
bun --version   # 1.3.14

# 安装与 lock 一致性
bun install --frozen-lockfile

# 开发与构建
bun run dev
bun run desktop:dev   # 30s timeout 后 SIGTERM，已观察到 daemon healthy
bun run test          # 712 tests passed
bun run build         # web/daemon/desktop 全构建，DMG 产出
bun run lint          # exit 0（仅 warnings）
bun run format:check  # All matched files use Prettier code style
node scripts/check-docs-consistency.mjs  # OK

# 范围检查
git status --short   # D pnpm-lock.yaml；?? bun.lock、.bunfig.toml、scripts/fix-electron.mjs、apps/desktop/scripts/
```
