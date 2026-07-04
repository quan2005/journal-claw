---
id: STORY-20260704-bun-package-manager
title: 将 monorepo 包管理器从 pnpm 迁移到 bun
status: verified
source: gate
level: L2
hypothesis_basis: intuition # 速度提升为直觉假设，需通过安装/构建耗时基线验证
design: ./design.md
created: 2026-07-04
related: []
---

# 将 monorepo 包管理器从 pnpm 迁移到 bun

> 一句话概括：**为 journal 项目的日常开发者缩短依赖安装与脚本执行时间，同时统一本地与 CI 的包管理体验。**

<!-- 本文件是「意图契约」：只回答谁/在做什么事/为何失败/做完什么变了/不做什么。
     任何"怎么实现"（方案选型、接口、NFR、技术异常）都不写这里，归 design.md。
     写作双重职责：背景讲故事（人读友好）+ AC 用 GWT（机读可测）。 -->

## 用户故事（Connextra）

作为 **journal 项目的日常开发者（本地开发 + CI 维护者）**，
当我 **克隆仓库后安装依赖或运行构建/测试脚本时**，
我希望 **包管理工具的安装和脚本执行更快、命令一致**，
以便 **减少每次 `install`/`build`/`test` 的等待时间，降低本地与 CI 行为差异。**

## 真实用户问题（背景，讲故事）

### 现状失败模式

- 当前项目使用 `pnpm@9.15.0` 管理 monorepo（证据：`pnpm-lock.yaml`、`.github/workflows/ci.yml`、`docs/dev/setup.md`）。
- 日常路径：
  - 本地：`pnpm install` → `pnpm --filter @journal/<pkg> <script>` → `npm run desktop:dev`
  - CI：`pnpm/action-setup@v4` + `actions/setup-node` cache pnpm + `pnpm install --frozen-lockfile`
- 痛点：`pnpm install` 与 `pnpm --filter ...` 在多包 workspace 下耗时较长；CI 缓存与本地缓存分离，容易出现"本地绿、CI 红"或重复解析。

### 为什么想换

- 直觉假设：bun 的包安装速度和脚本执行速度优于 pnpm，能减少开发者等待时间。
- 范围预期：本地开发与 CI 全部迁移到 bun，不再维护 pnpm 双轨。

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，journal 开发者会：

- **依赖安装更快**：冷 `install` 耗时从当前基线（待测）下降 ≥20%（设计阶段补充基线数字）。
- **本地与 CI 命令一致**：本地与 CI 使用同一包管理器，不再出现 pnpm-cache 与 CI-cache 差异导致的偶发失败。
- **脚本入口不变**：开发者仍可使用 `npm run <script>` 或 `bun run <script>` 运行已有脚本，不需要记忆新脚本名。

⚠️ 假设依据：以上基于 **直觉**。设计阶段会补充 `pnpm install` vs `bun install` 的耗时基线；即使实测提升 <10%，本次迁移仍继续执行。

## 验收标准（Given-When-Then）

### AC-1 — 本地依赖安装

- **Given** 开发者已安装 bun 并克隆仓库
- **When** 执行仓库标准安装命令
- **Then** 依赖安装成功，所有 workspace package 的 `node_modules` 可用
- **And** 安装完成后 `bun run dev`、`bun run desktop:dev`、`bun run test` 可正常执行

### AC-2 — workspace 脚本过滤

- **Given** 仓库已用 bun 安装依赖
- **When** 开发者运行针对单个 workspace package 的标准命令
- **Then** 该命令只影响目标 package（如 `@journal/web` 的 `build`、`test`、`typecheck`）
- **And** 等价于原 `pnpm --filter @journal/<pkg> <script>` 的范围行为

### AC-3 — CI 构建与测试

- **Given** PR 推送到 master
- **When** CI workflow 执行
- **Then** lint、typecheck、test、docs 一致性检查全部通过
- **And** 产物构建（renderer / daemon / Electron）成功

### AC-4 — lock 文件一致性

- **Given** 开发者在本地修改依赖后提交
- **When** CI 检出该提交并安装依赖
- **Then** 本地 lock 文件与 CI 安装的依赖版本一致
- **And** 不会出现 lock 文件过期或未提交的依赖漂移

## 三类边界（脊柱 Q5 · Won't · 输出闸必填）

- **不为哪些用户做**：
  - 不为"仅使用 npm/yarn 而不愿安装 bun"的开发者保留 pnpm 兼容路径；迁移完成后 pnpm 作为旧路径下线。
  - 不为低于 bun 1.x 稳定版的旧版本做兼容（设计阶段确定最低 bun 版本）。

- **不在哪些场景出现**：
  - 不修改业务代码逻辑、API 契约、前端组件或 daemon service 行为。
  - 不引入 bun 特有的运行时 API（如 `Bun.*`）到业务代码；业务代码仍保持 Node.js 兼容。
  - 不更改项目的版本号管理策略（仍由 release-please 自动维护）。

- **不解决哪些相关但不同的问题**：
  - 不解决 Electron 原生依赖或 postinstall 脚本自身的编译速度问题（这属于 electron-builder / node-gyp 范畴）。
  - 不解决 Vite 构建慢或测试慢的问题（这属于构建配置或测试策略优化，单独处理）。
  - 不解决 monorepo 架构拆分问题（仅换包管理器，不动 workspace 边界）。

## 交棒清单（移交 design.md 的实现层问题）

<!-- 脊柱中冒出的、需实现知识才能回答的问题。门禁只标记，不在此拍板。 -->

- [ ] bun 对当前 workspace 协议 `workspace:*` 的兼容行为如何？是否需要调整版本写法？
- [ ] bun 对 Electron + `electron-builder` 的依赖解析与 postinstall 是否等价？是否需要 `--backend=node_modules-hardlinks` 等开关？
- [ ] bun 对 `apps/web/predev` 中 `npx tailwindcss` 的执行行为是否与 pnpm 一致？
- [ ] lock 文件从 `pnpm-lock.yaml` 迁移到 `bun.lock`（bun 1.2+ 默认文本格式）的策略：一次性替换还是双轨并行验证？
- [ ] CI workflow 中 `pnpm/action-setup@v4` + `actions/setup-node` cache pnpm 如何替换为 `oven-sh/setup-bun`？缓存键如何设计？
- [ ] `packageManager` 字段与 `engines` 字段是否需要更新？是否保留 Node.js 20 下限？
- [ ] `lefthook` 的 `postinstall` hook 在 bun install 下是否正常触发？
- [ ] 清理脚本 `apps/desktop/scripts/clean-dev-ports.mjs` 使用系统命令不受影响，无需改动。
- [ ] 回滚策略：若迁移后发现阻塞问题，如何在最短时间内切回 pnpm？

## 待确认（意图层）

| #   | 问题                                            | 当前默认值                 | 状态   |
| --- | ----------------------------------------------- | -------------------------- | ------ |
| Q1  | 是否接受 Windows 作为二等公民？                 | 否，Windows 必须为一等公民 | 已确认 |
| Q2  | 是否接受迁移前必须实测 install/build 耗时基线？ | 是                         | 已确认 |
| Q3  | 若 bun 实测速度提升 <10%，是否仍继续迁移？      | 是，仍继续迁移             | 已确认 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：不依赖其他未做故事，可独立完成
- [x] **N** Negotiable：范围可裁剪（本地/CI 分阶段；Windows 必须为一等公民）
- [x] **V** Valuable：开发者等待时间减少，CI/本地一致性提升
- [x] **E** Estimable：信息足够估工（包管理器迁移 + CI 改造 + 文档）
- [x] **S** Small：1 个 sprint 内可完成
- [x] **T** Testable：AC-1/AC-2/AC-3/AC-4 均为可测 GWT

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                          |
| ---- | ---------- | --------- | ------------------------------------------------- |
| 1    | 2026-07-04 | 可开发    | 用户确认 Windows 必须一等公民、接受基线、坚持迁移 |
