# WS-3 护栏红测试证据（AC-4）

记录两条新增护栏在「故意违反」时确实失败、恢复后转绿的实证。AC-4 要求：提交一个故意违反架构约定的改动 → 本地或 CI 检查失败并给出可读错误。

## 1. ESLint 架构边界规则

**规则位置**：`apps/web/eslint.config.js`（新增单一护栏 block）。

**作用域**：`files: src/**/*.{ts,tsx}` + `ignores: src/lib/**, src/tests/**` —— 即「lib/ 与 tests/ 之外的全部 src」。这样 `hostBridge.ts`/`runtimeClient.ts` 等 lib 合法实现、以及 tests 的合法 mock 不受约束；其余消费层（components/hooks/contexts/App/settings/entities/shared）全覆盖。采用单一 block 是因为 flat-config 中 `no-restricted-syntax` 属同一规则键，两个 block 各自定义会「后者覆盖前者」（实测会丢规则并报 Unused eslint-disable）。

**规则清单**：
- `no-restricted-imports`：禁止 import `electron` / `tauri` / `**/lib/tauri`（防回潮）。
- `no-restricted-syntax`：禁止 `window.electronAPI` 直访、禁止 `localhost`/`127.0.0.1` 字面量、禁止消费层 `localStorage` 持久化业务状态。

**红测试命令**：

```bash
cat > apps/web/src/components/__ws3_guard_probe.tsx <<'EOF'
import { ipcRenderer } from 'electron'
import { oldShim } from '../lib/tauri'

export function ws3Probe(): unknown {
  const daemonUrl = 'http://localhost:9999/bad'
  const api = window.electronAPI
  localStorage.setItem('journal_business_state', 'leak')
  return { ipcRenderer, oldShim, daemonUrl, api }
}
EOF
pnpm --filter @journal/web lint
```

**输出（5 errors，精确对应 5 条规则，规则 ID 全部命中）**：

```
apps/web/src/components/__ws3_guard_probe.tsx
  1:1   error  'electron' import is restricted from being used. 禁止直接 import 'electron' — 宿主能力走 lib/hostBridge.ts。  no-restricted-imports
  2:1   error  '../lib/tauri' import is restricted … by a pattern. lib/tauri.ts shim 已于 2026-07-03 拆除。  no-restricted-imports
  5:21  error  禁止硬编码 daemon URL（localhost/127.0.0.1）— 业务调用走 runtimeClient。  no-restricted-syntax
  6:15  error  禁止直接访问 window.electronAPI — 走 lib/hostBridge.ts 包装。  no-restricted-syntax
  7:3   error  禁止在消费层用 localStorage 持久化业务状态 … 白名单请加 eslint-disable-next-line。  no-restricted-syntax

✖ 14 problems (5 errors, 9 warnings)
```

> 9 warnings 为既有的 react-hooks/react-refresh 提示，与本任务无关；探针贡献的恰是 5 errors。

**恢复**：`rm apps/web/src/components/__ws3_guard_probe.tsx` → `pnpm --filter @journal/web lint` 恢复 `0 errors`（见本文件末「最终绿」）。

## 2. docs 一致性脚本

**脚本**：`scripts/check-docs-consistency.mjs`（零依赖；扫描 `AGENTS.md`、`docs/ARCH.md`、`docs/CONVENTIONS.md`、`docs/final-state.md` 的反引号仓库路径，校验存在性）。

**红测试命令**（向 `docs/ARCH.md` 临时注入一个不存在路径）：

```bash
# 在 ARCH.md「参考」节追加：- 临时探针：`apps/nonexistent/ws3-probe.ts`
node scripts/check-docs-consistency.mjs
```

**输出（非零退出，定位到文件与路径）**：

```
[check-docs-consistency] 发现 1 处文档引用指向不存在的文件：

  ✗ docs/ARCH.md
      → apps/nonexistent/ws3-probe.ts

修复：更正路径，或移除/更新引用（docs/ARCH.md 是架构唯一真相，优先核对）。
EXIT=1
```

**恢复**：移除该行后 `node scripts/check-docs-consistency.mjs` → `OK — 已校验 27 个反引号路径，全部存在。` 退出 0。

## 附：本次脚本顺带修掉的真实 AC-2 不一致（基线扫到的）

脚本初次运行即暴露 2 处文档把「已删除实体」当成反引号路径引用，已就地修复（改为引用仍存在的父目录 + 裸文件名）：

| 文档 | 原引用（已删除） | 修后表述 |
|---|---|---|
| `docs/ARCH.md` 历史注记 | `apps/web/src/lib/tauri.ts` | `apps/web/src/lib/` 下的 `tauri.ts` |
| `docs/final-state.md` ×3 | `apps/web/src-tauri/` | `apps/web/` 下的 `src-tauri/` 目录 |

## 最终绿

```
pnpm --filter @journal/web lint   → ✖ 9 problems (0 errors, 9 warnings)
node scripts/check-docs-consistency.mjs  → OK（27 路径）
pnpm -r test                       → 全绿（见 verify）
```
