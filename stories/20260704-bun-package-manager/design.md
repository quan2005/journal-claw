---
id: DESIGN-20260704-bun-package-manager
status: draft
title: 包管理器从 pnpm 迁移到 bun 的实现方案
story: ./story.md
created: 2026-07-04
---

# 包管理器从 pnpm 迁移到 bun — 设计方案

## 设计目标

将 journal monorepo 的包管理器从 `pnpm@9.15.0` 全面切换到 `bun@1.3.14`：

- 本地开发、CI、文档全部统一使用 bun。
- 所有既有脚本入口保持可用（`npm run <script>` 或 `bun run <script>`）。
- 不改动业务代码与版本管理策略。
- macOS / Linux / Windows 三地均为一等公民。

## 基线测量

### pnpm 基线（迁移前，node_modules 已存在）

| 命令                 | 耗时  | 备注                                                |
| -------------------- | ----- | --------------------------------------------------- |
| `pnpm build`         | 25.7s | 全 workspace build，含 web/daemon/contracts/desktop |
| `pnpm test`          | 21.9s | 全 workspace vitest                                 |
| `pnpm install`（冷） | 未测  | `packageManager` 改为 bun 后 pnpm 拒绝安装          |

### bun 基线（迁移后）

| 命令                | 耗时  | 备注                                     |
| ------------------- | ----- | ---------------------------------------- |
| `bun run build`     | 18.0s | 全 workspace build；desktop DMG 生成成功 |
| `bun run test`      | 19.6s | 全 workspace vitest，395 tests passed    |
| `bun install`（冷） | 41.5s | 从 pnpm-lock.yaml 迁移生成 bun.lock      |

## 关键决策

### 1. 单 lock 文件，不保留 pnpm 双轨

- 删除 `pnpm-lock.yaml`，新增 `bun.lock`（bun 1.2+ 默认文本 lock 文件）。
- 不维护双 lock 文件，避免 drift。

### 2. 脚本命令映射

| pnpm                                    | bun                                        |
| --------------------------------------- | ------------------------------------------ |
| `pnpm install --frozen-lockfile`        | `bun install --frozen-lockfile`            |
| `pnpm --filter @journal/<pkg> <script>` | `bun run --filter @journal/<pkg> <script>` |
| `pnpm run <script>`                     | `bun run <script>`                         |
| `pnpm <script>`                         | `bun run <script>`                         |
| `npx <pkg>`                             | `bunx <pkg>`                               |

### 3. CI 策略

- 替换 `pnpm/action-setup@v4` + `actions/setup-node` cache 为 `oven-sh/setup-bun@v2`。
- Ubuntu runner 跑全量检查（lint/typecheck/test/docs/build）。
- 新增 `windows-latest` runner 跑 install/build/test，确保 Windows 一等公民。
- Release workflow 保留 macOS-15 构建 DMG。

### 4. Electron 二进制修复

- `bun install` 会触发 Electron 的 `postinstall`，但其依赖的 `extract-zip` 在 Bun 内置的 Node.js 26 下会立即 resolve 却不实际解压，导致 `dist/` 只有骨架、缺少 `Frameworks/` 与 `path.txt`。
- 新增 `scripts/fix-electron.mjs`：使用 `@electron/get` 定位缓存 zip，再用系统 `unzip`（macOS/Linux）或 PowerShell `Expand-Archive`（Windows）解压，并写入无换行符的 `path.txt`。
- 在 root `postinstall` 中调用：`lefthook install && node scripts/fix-electron.mjs`。

### 5. Windows 适配

- 清理脚本 `apps/desktop/scripts/clean-dev-ports.mjs` 增加 Windows 分支：`netstat -ano` 查端口、`tasklist` 读命令行、`taskkill /T /F` 杀进程树。
- 所有 shell 脚本避免使用 Unix-only 语法。

## 变更清单

1. `package.json` — `packageManager`、scripts、`engines`、新增 `postinstall` 修复 electron。
2. `pnpm-lock.yaml` → 删除；`bun.lock` → 新增；`.bunfig.toml` → 新增（启用 lifecycle scripts）。
3. `apps/web/package.json` — 脚本切到 bun；`npx tailwindcss` → `bunx tailwindcss`。
4. `apps/daemon/package.json` — 脚本切到 bun；`pre*` 钩子更新。
5. `apps/desktop/package.json` — 脚本切到 bun；`dev:clean` 保持系统命令。
6. `packages/contracts/package.json` — 无需改动（无 pnpm 调用）。
7. `.github/workflows/ci.yml` — bun setup + Windows job。
8. `.github/workflows/release.yml` — bun setup。
9. `docs/dev/setup.md`、`docs/dev/building.md`、`docs/CONVENTIONS.md`、`docs/final-state.md`、`docs/verification-standard.md`、`README.md`、`README.cn.md`、`apps/desktop/README.md`、`AGENTS.md` — 命令与工具链说明更新。
10. `apps/desktop/scripts/clean-dev-ports.mjs` — 增加 Windows 支持。
11. `scripts/fix-electron.mjs` — 新增；修复 bun 下 Electron 二进制不完整问题。

## 回滚策略

若迁移后出现阻塞问题：

1. `git revert <migration-commit>` 恢复 `pnpm-lock.yaml`/`bun.lock` 与 package.json。
2. 重新运行 `pnpm install`。
3. 如仅需临时切回，保留 migration commit 在分支，master 直接 revert。

## 风险与缓解

| 风险                                     | 缓解                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| bun workspace 解析与 pnpm 不一致         | 本地 + CI 全量 build/test                                    |
| Electron / electron-builder 解析异常     | `scripts/fix-electron.mjs` + 本地 desktop:build + CI release |
| `bunx tailwindcss` 行为差异              | 验证 web predev                                              |
| Windows 脚本兼容                         | 新增 Windows CI job + 清理脚本 Windows 分支                  |
| 贡献者未安装 bun                         | 文档明确要求；`packageManager` 字段提示                      |
| `extract-zip` 在 Node.js 26 下不实际解压 | `fix-electron.mjs` 用系统 unzip/PowerShell 替代              |

## 验证计划

- 本地 macOS: `bun install` → `bun run build` → `bun test` → `bun run lint` → `bun run format:check` → `bun run desktop:dev`。
- CI Ubuntu: 全量检查通过。
- CI Windows: install/build/test 通过。
- CI macOS Release: DMG 构建成功。
