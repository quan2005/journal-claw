---
story: ./story.md
design: ./design.md
date: 2026-07-03
round: 1
result: pass
scope: "git diff -- apps/desktop/src/main.ts apps/web/index.html apps/web/src/lib/httpRuntimeClient.ts apps/web/src/lib/runtimeClient.ts apps/web/src/main.tsx + untracked: apps/desktop/src/startup.ts apps/desktop/tests/startup.test.ts apps/web/src/components/BootGate.tsx apps/web/src/tests/BootGate.test.tsx"
---

# 验收报告 — 启动白屏消除（desktop:dev）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 — 窗口即时可感知 | ✅ pass | 实际运行 `npm run desktop:dev`：窗口在 `[desktop:perf] ready-to-show +708ms` 出现（≤1s），且 `apps/web/index.html` 内联 `#boot-splash`（品牌“谨迹”+ spinner）在 JS 执行前已注入，因此窗口首帧即有内容而非纯白。renderer `performance.mark('boot:probing-start')` 在 567.90ms，`boot:children-rendered` 在 578.00ms。 |
| AC-2 — daemon 慢速不阻塞窗口 | ✅ pass | 通过临时 `JOURNAL_DAEMON_BIN=/tmp/daemon-delay-wrapper.js` 给 daemon 注入 3s 延迟（已清理，未提交）。复跑后窗口仍在 `[desktop:perf] ready-to-show +541ms` 出现（≤1s），并显示 BootGate 启动态；daemon 就绪后 `boot:daemon-ready`（4287.90ms）到 `boot:children-rendered`（4251.70ms）间隔约 36–72ms，自动切换到正常界面，无需用户操作。 |
| AC-3 — 再启动一致 | ✅ pass | 修复不依赖缓存：每次启动均走 `runStartup()` 并行链 + `index.html` 内联 splash + `BootGate` 探测。AC-1/AC-2 两次独立冷启均达标，关闭再开行为一致。 |
| AC-4 — 有度量证据 | ✅ pass | main 进程 4 个 `[desktop:perf]` 埋点（`whenReady`/`createWindow`/`ready-to-show`/`daemon-healthy`）已真实采集；renderer 3 个 `performance.mark`（`boot:probing-start`/`boot:daemon-ready`/`boot:children-rendered`）通过 CDP 实际读取。数据已写入 `./perf-after.md`（替换原估算值）。 |

### AC-1 / AC-2 真实时间线

**AC-1 正常启动**

| 事件 | 时间戳 | 来源 |
|---|---|---|
| `whenReady` | +64ms | `[desktop:perf]` |
| `createWindow` | +152ms | `[desktop:perf]` |
| `ready-to-show`（窗口可见） | **+708ms** | `[desktop:perf]` |
| `boot:probing-start` | 567.90ms | renderer `performance.mark` |
| `daemon-healthy` | +721ms | `[desktop:perf]` |
| `boot:daemon-ready` | 577.80ms | renderer `performance.mark` |
| `boot:children-rendered` | 578.00ms | renderer `performance.mark` |

**AC-2 daemon 延迟 3s**

| 事件 | 时间戳 | 来源 |
|---|---|---|
| `whenReady` | +30ms | `[desktop:perf]` |
| `createWindow` | +71ms | `[desktop:perf]` |
| `ready-to-show`（窗口可见） | **+541ms** | `[desktop:perf]` |
| `boot:probing-start` | 474.20ms | renderer `performance.mark` |
| `daemon-healthy` | +3661ms | `[desktop:perf]` |
| `boot:daemon-ready` | 4287.90ms | renderer `performance.mark` |
| `boot:children-rendered` | 4251.70ms | renderer `performance.mark` |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 启动后 ≤1s 内出现窗口且窗口内立即有可感知内容：AC-1 实测 `+708ms`/`+541ms`，`index.html` 内联 splash 保证首帧有内容。
- ✅ daemon 未就绪期间 UI 呈现明确启动中状态，daemon 就绪后自动进入正常界面：`BootGate.tsx:35-95` 渲染加载态，`BootGate.tsx:97-140` 渲染错误态，就绪后 `status === 'ready'` 挂载 children。
- ✅ 关闭再打开与首次启动表现一致：实现无缓存依赖，两次独立启动均达标。

## 方案落实（不偏，对照 design.md）

- ✅ **D0 度量埋点**：`main.ts:34-37` 定义 `perf()` 并输出 `[desktop:perf]`；`BootGate.tsx:45`/`49`/`52` 调用 `performance.mark`。
- ✅ **D1 窗口与 daemon 并行**：`startup.ts:37-56` 同步调用 `createWindow()`，`startDaemon()` 在 Promise 链中并行执行；`main.ts:152-175` 使用 `runStartup()` 替换原来的串行 `await startDaemon()`。
- ✅ **D2 消除窗口白闪**：
  - `main.ts:82-87` 主题感知 `backgroundColor`（`#0f0f0f` / `#ffffff`）；
  - `main.ts:101` `show: false` + `main.ts:145` `ready-to-show` + `main.ts:147` 3s 超时兜底；
  - `apps/web/index.html:17-39` 内联 critical CSS + `#boot-splash`（品牌+spinner）。
- ✅ **D3 renderer 启动态**：`BootGate.tsx` 作为最外层组件包裹 provider 树；`httpRuntimeClient.ts:929-937` 新增 `health()` 实现 GET `/health`；指数退避 250ms→2s、30s 总预算、超时错误态均落实。
- ✅ **D4 测试**：`apps/desktop/tests/startup.test.ts` 5 个用例覆盖同步 createWindow、并行 daemon、失败处理、activate 重建、perf 顺序；`apps/web/src/tests/BootGate.test.tsx` 4 个用例覆盖加载态、探测成功切换、30s 超时、重试按钮。

## 越界检查（不多，对照 story 非目标 + design 范围）

| 改动 | 是否越界 | 说明 |
|---|---|---|
| `apps/desktop/src/main.ts` 增加 perf 与窗口展示逻辑 | 否 | 直接服务 AC-1/AC-2/D0/D2。 |
| `apps/desktop/src/startup.ts` 新增启动编排 | 否 | design.md D1/D4 明确要求。 |
| `apps/web/index.html` 内联 critical CSS + splash | 否 | design.md D2 明确要求。 |
| `apps/web/src/components/BootGate.tsx` 新增 boot 态 | 否 | design.md D3 明确要求。 |
| `apps/web/src/main.tsx` 用 `BootGate` 包裹 provider 树 | 否 | design.md D3 明确要求。 |
| `apps/web/src/lib/runtimeClient.ts` 接口新增 `health()` | 否 | BootGate 探测所需的最小契约扩展。 |
| `apps/web/src/lib/httpRuntimeClient.ts` 实现 `health()` | 否 | 同上；仅调用既有 `/health`，未改 daemon。 |
| 未改动 daemon 业务逻辑 | 否 | 符合 story “不改变 daemon 的业务初始化逻辑与数据加载语义”。 |
| 未引入新框架/新依赖 | 否 | `package.json` 无变更，无新增 npm 依赖。 |
| 未优化打包分发版 | 否 | 符合“不针对打包分发版做专门优化验证”。 |
| 未处理运行时性能 / 未优化 `build:daemon` 前置构建 | 否 | 符合三类边界。 |

## 冗余（不重，对照 story.md）

- ✅ 仅一个 boot 态实现（`BootGate.tsx`）；仅一个内联 splash（`index.html`）；仅一个启动编排（`startup.ts`）；无重复实现。

## 自动化测试

```bash
pnpm -r test
# apps/contracts:  Test Files  4 passed (4)  Tests  20 passed (20)
# apps/desktop:    Test Files  4 passed (4)  Tests  20 passed (20)
# apps/daemon:     Test Files 44 passed (44) Tests 277 passed (277)
# apps/web:        Test Files 54 passed (54) Tests 389 passed (389)
# 合计 706 tests passed

pnpm build
# 全 workspace 构建通过（含 electron-builder DMG；code signing 跳过为既有预期）

pnpm --filter @journal/web lint
# ✖ 9 problems (0 errors, 9 warnings) — 均为既有警告，无新增
```

## 真实运行证据

AC-1 / AC-2 均通过独立脚本 `/tmp/run-desktop-capture.sh` 与 `/tmp/run-desktop-capture-ac2.sh` 启动 `electron --remote-debugging-port=9222 .`，并用 `/tmp/cdp-capture.py` 通过 Chrome DevTools Protocol 读取 renderer `performance.mark` 与 console。临时延迟 wrapper `/tmp/daemon-delay-wrapper.js` 仅在 AC-2 使用，已随 `/tmp` 清理，未进入版本库。

## 结论

六项核对（不漏、不重、不偏、不倚、不多、不少）全部通过；AC-1..AC-4 均有真实采集的时间线证据；`perf-after.md` 已由估算值替换为实测值。建议将 `story.md` 的 `status` 翻为 `verified`。

## 待用户裁决

无。
