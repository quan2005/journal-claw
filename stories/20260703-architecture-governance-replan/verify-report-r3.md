---
story: ./story.md
design: ./design.md
date: 2026-07-03
round: 3
result: pass
scope: "WS-3 护栏机器化：apps/web/eslint.config.js、scripts/check-docs-consistency.mjs、.github/workflows/ci.yml、ws3-evidence.md，及 AC-5 分发可用性。"
---

# 验收报告 — 架构治理重规划：全景技术设定 + 落地清理（Round 3）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-4 护栏机器化 | ✅ pass | 见下表逐项；红测试已独立复现，本地/CI 均失败并给出可读错误。 |
| AC-5 分发可用性 | ✅ pass（有保留） | 无独立 WS-3 任务书，但 design.md WS-3 节、`AGENTS.md` 铁律摘要均直接引用 `docs/ARCH.md` 具体章节；ESLint 错误信息也引用 `docs/ARCH.md` 章节。Hub 文档已可引用。 |

### AC-4 逐项核对

| 检查项 | 结论 | 证据 |
|---|---|---|
| ESLint 禁 `import electron`（含命名/default/namespace） | ✅ | `apps/web/eslint.config.js:28-36` 配置 `no-restricted-imports`；独立探针 `import { ipcRenderer } from 'electron'` / `import * as electron from 'electron'` / `import electron from 'electron'` 均被拦截，输出 `LINT_EXIT=1`。 |
| ESLint 禁直接访问 `window.electronAPI` | ✅ | `apps/web/eslint.config.js:52-58` 配置 `no-restricted-syntax`，selector `MemberExpression[object.name='window'][property.name='electronAPI']`；独立探针 `const api = window.electronAPI` 触发 error。 |
| ESLint 禁 import 已删除 `lib/tauri` 路径 | ✅ | `apps/web/eslint.config.js:43-49` 配置 patterns `['**/lib/tauri', '**/lib/tauri.*']`；独立探针 `import { oldShim } from '../lib/tauri'` 触发 error。 |
| ESLint 禁 `localhost`/`127.0.0.1` 字面量（consumer 层） | ✅ | `apps/web/eslint.config.js:59-63` 配置 selector `Literal[value=/localhost|127\.0\.0\.1/]`；独立探针 `'http://localhost:9999/bad'` 触发 error。说明：规则覆盖所有含 `localhost`/`127.0.0.1` 的字面量，比 design.md 字面「`localhost:`」稍宽，语义一致。 |
| ESLint 禁 consumer 层 localStorage 业务持久化，白名单纯 UI 状态 | ✅ | `apps/web/eslint.config.js:64-69` 配置 selector 匹配 `localStorage`；consumer 层现存 4 处纯 UI 用法均带 `// eslint-disable-next-line no-restricted-syntax -- ARCH.md 白名单：…` 并说明理由：SkillsWorkbench.tsx:50-58（skills 收藏 UI 偏好）、TreeSidebar.tsx:102-116（侧栏折叠态）、UIContext.tsx:22-120（面板宽度/pinned/树选中态）、useTopics.ts:19-36（topics 树展开态）。 |
| 每条白名单均有 inline reason comment 且确为纯 UI 状态 | ✅ | 上述 4 处 disable 注释均明确指向「ARCH.md 白名单」并声明「非业务状态/非业务数据」；代码本身只保存视图/布局/折叠/收藏，不保存 journal/topics/identity 等业务实体。 |
| 红测试证据真实可信 | ✅ | `ws3-evidence.md:15-46` 的 ESLint 探针与 `ws3-evidence.md:53-70` 的 docs 探针均已独立复现，输出与证据文件一致（见「独立复现命令输出」）。 |
| docs-consistency 脚本检查范围与逻辑正确 | ✅ | `scripts/check-docs-consistency.mjs:14-18` 扫描 `AGENTS.md`、`docs/ARCH.md`、`docs/CONVENTIONS.md`、`docs/final-state.md`，用反引号路径正则匹配 `apps/|packages/|docs/|scripts/` 开头路径，校验文件存在性；通配符路径跳过；缺失时输出文件与路径清单并退出 1。 |
| docs-consistency 脚本运行通过 | ✅ | `node scripts/check-docs-consistency.mjs` → `[check-docs-consistency] OK — 已校验 27 个反引号路径，全部存在。` |
| CI 集成新增检查 | ✅ | `.github/workflows/ci.yml:22` 新增 `node scripts/check-docs-consistency.mjs`，位于 lint/test 之前；lint 命令 `pnpm --filter @journal/web lint` 已包含新 ESLint 规则。 |
| CI 失败信息可读 | ✅ | ESLint 错误含规则 ID、`docs/ARCH.md` 引用及修复方向；docs-consistency 错误列出 `✗ 文档 → 路径` 并给出修复建议。 |

### AC-5 分发可用性

- 未找到独立的 WS-3 任务书/分发 prompt；现有 `tasks.md` 是 WS-2 分批任务书，WS-3 仅写「见 design.md WS-3 节」。
- `design.md` WS-3 节直接引用 `docs/ARCH.md「依赖方向规则」`、`docs/ARCH.md 已下线能力`、`docs/ARCH.md 历史注记`，未在任务文本中重述架构。
- `AGENTS.md:7-13` 文档地图与 `AGENTS.md:33-44` 铁律摘要均链接到 `docs/ARCH.md` 具体章节（依赖方向规则、desktop 零业务语义、ChangeSet、Theme 持久化等）。
- ESLint 错误信息也引用 `docs/ARCH.md` 章节，进一步证明设定文档可作为约束引用。
- 结论：Hub 文档已足够可引用，AC-5 通过；建议后续 WS 仍附一份简短分发 prompt 以形成更直接的证据。

## 范围完整性（不少，对照 story.md 范围）

- **WS-3 护栏机器化**：
  - ESLint 边界规则 ✅
  - docs-consistency CI 脚本 ✅
  - CI 集成 ✅
  - 红测试证据 ✅

## 方案落实（不偏，对照 design.md）

| design.md 要求 | 结论 | 证据 |
|---|---|---|
| 优先 ESLint 内建，零新依赖 | ✅ | `apps/web/eslint.config.js` 仅使用 `no-restricted-imports` / `no-restricted-syntax`，无新增 npm 依赖。 |
| 组件禁 import raw electron、禁绕过 hostBridge/runtimeClient、禁 import `lib/tauri` | ✅ | 见 AC-4 逐项。 |
| 组件禁硬编码 daemon URL、禁 localStorage 业务持久化（面板宽度白名单除外） | ✅ | localhost/127.0.0.1 与 localStorage 规则已启用；面板宽度等 UI 状态已加白名单注释。 |
| docs 一致性 CI 脚本核对核心文档引用 | ✅ | `scripts/check-docs-consistency.mjs` 实现并运行通过。 |
| 每条规则附红测试证明 | ✅ | `ws3-evidence.md` 记录并独立复现。 |

## 越界检查（不多，对照 story 非目标 + design.md 范围）

- 本次 diff 可归因为 WS-3 护栏及其必要配套：
  - `apps/web/eslint.config.js`：新增护栏规则。
  - `scripts/check-docs-consistency.mjs`、`ws3-evidence.md`：新增检查与证据。
  - `.github/workflows/ci.yml`：CI 调用新检查。
  - `SkillsWorkbench.tsx`、`TreeSidebar.tsx`、`UIContext.tsx`、`useTopics.ts`：为既有纯 UI localStorage 用法补 `eslint-disable-next-line` 注释与说明，**无行为变更**。
  - `docs/ARCH.md`、`docs/final-state.md`：为通过 docs-consistency 脚本，将反引号路径从已删除实体（`apps/web/src/lib/tauri.ts`、`apps/web/src-tauri/`）改为仍存在的父目录 + 裸文件名描述，属于 AC-2 不一致清理，在 WS-3 顺带修复范围内。
- 未发现新增产品功能、行为变更、技术栈替换或 WS-3 范围外的 opportunistic 重构。
- 非目标核对：无语音/转写回归、无 release 渠道改动、无性能优化相关改动。

## 冗余（不重，对照 story.md）

- 未发现同一规则的多套并行实现。
- `no-restricted-imports` 与 `no-restricted-syntax` 职责不重叠。

## 独立复现命令输出

### ESLint 红测试（探针文件已删除，无残留）

```bash
$ cat > apps/web/src/components/__ws3_guard_probe.tsx <<'EOF'
import { ipcRenderer } from 'electron'
import { oldShim } from '../lib/tauri'

export function ws3Probe(): unknown {
  const daemonUrl = 'http://localhost:9999/bad'
  const api = window.electronAPI
  localStorage.setItem('journal_business_state', 'leak')
  return { ipcRenderer, oldShim, daemonUrl, api }
}
EOF
$ pnpm --filter @journal/web lint
...
apps/web/src/components/__ws3_guard_probe.tsx
  1:1   error  'electron' import is restricted ...  no-restricted-imports
  2:1   error  '../lib/tauri' import is restricted ...  no-restricted-imports
  5:21  error  禁止硬编码 daemon URL ...  no-restricted-syntax
  6:15  error  禁止直接访问 window.electronAPI ...  no-restricted-syntax
  7:3   error  禁止在消费层用 localStorage ...  no-restricted-syntax
✖ 14 problems (5 errors, 9 warnings)
LINT_EXIT=1
```

### docs-consistency 红测试（ARCH.md 已恢复）

```bash
$ echo '- 临时探针：`apps/nonexistent/ws3-probe.ts`' >> docs/ARCH.md
$ node scripts/check-docs-consistency.mjs
[check-docs-consistency] 发现 1 处文档引用指向不存在的文件：

  ✗ docs/ARCH.md
      → apps/nonexistent/ws3-probe.ts

修复：更正路径，或移除/更新引用（docs/ARCH.md 是架构唯一真相，优先核对）。
DOCS_EXIT=1
$ git checkout docs/ARCH.md
```

### 最终绿

```bash
$ pnpm --filter @journal/web lint
✖ 9 problems (0 errors, 9 warnings)

$ node scripts/check-docs-consistency.mjs
[check-docs-consistency] OK — 已校验 27 个反引号路径，全部存在。

$ pnpm -r test
packages/contracts:  Test Files  4 passed (4)  Tests  20 passed (20)
apps/desktop:        Test Files  3 passed (3)  Tests  15 passed (15)
apps/daemon:         Test Files  44 passed (44) Tests  277 passed (277)
apps/web:            Test Files  53 passed (53)  Tests  385 passed (385)
```

## 结论

WS-3 护栏机器化实现完整：5 条 ESLint 边界规则 + docs-consistency 脚本 + CI 集成均生效，红测试独立复现成功，白名单均为纯 UI 状态并附理由，全仓测试/lint/docs 检查全绿。AC-4 通过；AC-5 通过，但建议为后续 WS 补充独立分发 prompt 以形成更直接证据。本轮判为 **pass**。

## 待用户裁决

无。仅一项非阻塞观察：`scripts/check-docs-consistency.mjs` 的 DOCS 列表未包含 `docs/DESIGN.md`，但 `docs/DESIGN.md` 当前无反引号文件路径引用，实际不影响一致性校验。是否将 `docs/DESIGN.md` 加入扫描列表纯属完整性偏好，不影响本轮结果。
