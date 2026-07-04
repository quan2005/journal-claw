---
story: ./story.md
design: ./design.md
date: 2026-07-03
round: 2
result: pass
scope: 'Round-1 修复项：docs/dev/frontend.md / docs/dev/index.md / docs/dev/backend.md / docs/dev/architecture.md（tauri.ts 描述清理）；README.cn.md / SectionAbout.tsx（docs/design/index.md 链接修正）；docs/ARCH.md（依赖规则示例修正）。'
---

# 验收报告 — 架构治理重规划：全景技术设定 + 落地清理（Round 2）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                          | 结论    | 证据                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 全景技术地图           | ✅ pass | `AGENTS.md:1-48` 薄 hub 不变；`docs/CONVENTIONS.md`、`docs/ARCH.md`、`docs/DESIGN.md`、`docs/final-state.md` 职责唯一；从 `AGENTS.md` 到任一约定文档 ≤1 跳，到具体章节 ≤2 跳。无新增矛盾重复表述。                                                                                                                          |
| AC-2 文档与代码一致         | ✅ pass | Round-1 发现的 3 类不一致已全部修复，全量复核未再发现核心文档中将已删除实体描述为当前实体的残留：                                                                                                                                                                                                                           |
| AC-3 架构债清单落地（WS-2） | ✅ pass | `apps/web/src/lib/tauri.ts` 已删除；`apps/web/src/tests/tauri.test.ts` 已删除；`apps/web/src` 内无活跃 `from '../lib/tauri'` / `from '../../lib/tauri'` import；调用方已切到 `selectRuntimeClient` / `hostBridge` / `apiTypes`。`pnpm -r test` 全绿；`pnpm --filter @journal/web lint` 0 errors（9 warnings，与 R1 相同）。 |
| AC-4 护栏机器化             | ⏸️ N/A  | 本次 diff 范围未新增 lint 规则/CI 检查/依赖边界检查；无内容可验证。                                                                                                                                                                                                                                                         |
| AC-5 分发可用性             | ⏸️ N/A  | 同 AC-4，本次范围未新增分发相关改动；文档 hub 已可引用。                                                                                                                                                                                                                                                                    |

### AC-2 修复明细与复核证据

**Fix 1：docs/dev/\* 中 `tauri.ts` 描述已清理或转为历史注记**

- `docs/dev/frontend.md:15-17` 分层表已删除 `lib/tauri.ts` 行，仅保留 `lib/runtimeClient.ts` / `lib/httpRuntimeClient.ts` / `lib/hostBridge.ts`。
- `docs/dev/frontend.md:25` 业务调用路径改为："业务调用统一走 `selectRuntimeClient().invoke(...)`，宿主能力走 `hostBridge` 导出函数"。
- `docs/dev/frontend.md:38` 测试 mock 指引改为："业务调用优先 mock `../lib/runtimeClient`；宿主能力优先 mock `../lib/hostBridge`"。
- `docs/dev/index.md:28-30` 目录结构已删除 `lib/tauri.ts` 行，仅保留 runtimeClient / httpRuntimeClient / hostBridge。
- `docs/dev/backend.md:28` 新增业务能力路径改为："前端通过 `runtimeClient` / `hostBridge` 调用，不绕过统一入口"。
- `docs/dev/architecture.md:12` 架构总览箭头改为：`apps/web (React) -> runtimeClient / hostBridge`。
- `docs/dev/architecture.md:30` 已转为历史注记："`apps/web/src/lib/tauri.ts` 兼容 shim 已于 2026-07-03 拆除，调用方直接消费 `runtimeClient` / `hostBridge`"。

**Fix 2：README.cn.md / SectionAbout.tsx 中 `docs/design/index.md` 链接已修正**

- `README.cn.md:116` 已改为 `[设计系统](docs/DESIGN.md)`。
- `apps/web/src/settings/components/SectionAbout.tsx:135` 已改为 `url: 'https://github.com/quan2005/journal/blob/main/docs/DESIGN.md'`。

**Fix 3：docs/ARCH.md 依赖规则示例已改为实际 API**

- `docs/ARCH.md:29` 允许示例：`selectRuntimeClient().invoke('journal_list')`。
- `docs/ARCH.md:30` 允许示例：`hostRevealInFileManager(p)`。

**AC-2 全量复核（docs / README / AGENTS / CLAUDE / 相关源码）**

- 对 `docs/**/*.md`、`README*.md`、`AGENTS.md`、`CLAUDE.md`、`apps/web/src` 执行 grep：未发现将 `apps/web/src/lib/tauri.ts` 描述为当前入口/兼容 shim 的残留；仅存明确标注"已于 2026-07-03 拆除"的历史注记（`docs/ARCH.md:55`、`docs/dev/architecture.md:30`、`docs/final-state.md:76`）。
- 对同上范围执行 grep：未发现指向 `docs/design/index.md` 或 `docs/design/` 的当前链接；`docs/design/` 目录已不存在（`ls: ... No such file or directory`）。
- `apps/web/src/tests/ipc-contract.test.ts:12-13` 注释明确说 "deleted `lib/tauri.ts` shim"，语义正确，不构成当前实体描述。

## 范围完整性（不少，对照 story.md 范围）

- **WS-1 文档体系重组**：
  - `AGENTS.md` 薄 hub 化 ✅
  - 新增 `docs/CONVENTIONS.md` ✅
  - `docs/ARCH.md` 更新为唯一架构真相 ✅
  - `docs/dev/*` 中 tauri.ts 描述已清理（R1 blocker 修复）✅
  - `README.cn.md` / `SectionAbout.tsx` 设计文档链接已修正（R1 minor 修复）✅
- **WS-2 tauri.ts 彻底内联**：
  - shim 本体与测试已删除 ✅
  - 调用方直接消费 runtimeClient / hostBridge / apiTypes ✅
  - `apps/web/src` 无活跃 tauri import ✅

## 方案落实（不偏，对照 design.md）

| design.md 要求                                     | 结论 | 证据                                                                          |
| -------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `CLAUDE.md` 薄 hub + docs 分层                     | ✅   | `AGENTS.md` 与 `CLAUDE.md` 为同一文件 symlink，48 行导航/摘要/链接。          |
| 每条约定单一权威出处                               | ✅   | `AGENTS.md:7-13` 文档地图明确职责；正文只链接不复述。                         |
| tauri.ts 删除、调用点切到 runtimeClient/hostBridge | ✅   | `git status --short` 显示 `D apps/web/src/lib/tauri.ts`；grep 无活跃 import。 |
| Round-2 修复只改文档描述与等价调用点               | ✅   | 见下方"越界检查"。                                                            |

## 越界检查（不多，对照 story 非目标 + design.md 范围）

- 对 Round-2 涉及文件做 diff spot-check：
  - `docs/dev/frontend.md`、`docs/dev/index.md`、`docs/dev/backend.md`、`docs/dev/architecture.md`：差异仅限删除 `lib/tauri.ts` 行、将调用路径改为 `selectRuntimeClient().invoke(...)` / `hostBridge`、测试 mock 改为 `../lib/runtimeClient`、添加历史注记。
  - `README.cn.md`：差异仅限删除 `lib/tauri.ts` 目录项、将 `docs/design/index.md` 链接改为 `docs/DESIGN.md`。
  - `apps/web/src/settings/components/SectionAbout.tsx`：差异仅限 `tauri` import 改为 `runtimeClient` / `hostBridge`、将 `openUrl` 改为等价 `hostOpenWithSystem`、URL 改为 `docs/DESIGN.md`、本地封装 `getAppVersion` / `resetOnboarding` 改为 `selectRuntimeClient().invoke(...)`。
  - `docs/ARCH.md`：差异中与本轮修复相关的部分仅限依赖规则表第 1、2 行的允许示例；其余内容属 R1 已评审的 WS-1 重写。
- 未发现新增产品功能、行为变更、技术栈替换或 opportunistic 重构。
- `SectionAbout.tsx` 的 `openUrl` → `hostOpenWithSystem` 是 host 能力统一经 `hostBridge` 的等价替换，与 WS-2 其他调用点一致。
- 非目标核对：无语音/转写回归、无 release 渠道改动、无性能优化相关改动。

## 冗余（不重，对照 story.md）

- 未发现同一 AC 的多套并行实现。
- `apiTypes.ts` 与 `types.ts` 职责不重叠；`runtimeClient` / `httpRuntimeClient` / `hostBridge` 边界清晰。

## 验证命令输出

```
$ pnpm -r test
packages/contracts:  Test Files  4 passed (4)  Tests  20 passed (20)
apps/desktop:        Test Files  3 passed (3)  Tests  15 passed (15)
apps/daemon:         Test Files  44 passed (44) Tests  277 passed (277)
apps/web:            Test Files  53 passed (53) Tests  385 passed (385)

$ pnpm --filter @journal/web lint
✖ 9 problems (0 errors, 9 warnings)
```

全部测试通过；lint 0 errors，warnings 数量与 R1 相同，未引入新 lint 问题。

## 结论

Round-1 的全部 3 个 fail 项（1 blocker + 2 minor）已修复；AC-2 全量复核未发现新的文档-代码不一致；验证命令全绿。本轮判为 **pass**。

## 待用户裁决

无。
