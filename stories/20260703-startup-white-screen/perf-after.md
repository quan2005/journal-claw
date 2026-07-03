# 启动性能修复后（After）

Story：`./story.md` · 对照基线：`./perf-baseline.md` · 状态：**真实采集，非估算**

> 以下数据由验收工程师在 2026-07-03 通过实际运行 `npm run desktop:dev` 采集：
> - AC-1 正常启动：窗口在 `+708ms` 可见，daemon 在 `+721ms` 就绪；
> - AC-2 daemon 延迟 3s：窗口在 `+541ms` 可见，daemon 在 `+3661ms` 就绪，就绪后 `~100ms` 内切换到正常界面。

## 修复后启动时序（并行链）

```
T0  进程启动 (electron .)
    │
    │  app.whenReady()
    ▼
T1  whenReady 回调入口              [desktop:perf] whenReady +64ms (AC-1) / +30ms (AC-2)
    │
    ├──▶ createWindow()  ──────────────┐  同步，不再 await daemon
    │   └ show:false + ready-to-show   │
    │   └ backgroundColor(主题感知)     │
    │                                  ▼
    │   T1'  loadURL(dev server)     [desktop:perf] createWindow +152ms (AC-1) / +71ms (AC-2)
    │         │
    │         ▼
    │   T3  ready-to-show → window.show()
    │       窗口出现（内联 boot-splash 已在屏幕上）   ≤1s ✅ AC-1 / ✅ AC-2
    │
    └──▶ startDaemon()  ───────────────┐  并行，不阻塞窗口
            ├ spawn node cli.js         │
            └ waitForHealth()          │
                ▼                      │
            T2  daemon healthy        [desktop:perf] daemon-healthy +721ms (AC-1) / +3661ms (AC-2)
                │                      │
                │  (renderer 侧)        │
                ▼                      │
            BootGate health() 探测命中   ◀┘
                │
                ▼
            T4  BootGate → ready，挂载 App/provider 树
                │
                ▼
            T5  hooks 首次请求命中 daemon（已就绪，无失败）
                │
                ▼
            T6  首个有意义绘制         performance.mark('boot:children-rendered')
```

## 修复后白屏成因消除

| 段 | 基线问题 | 修复手段 | 修复后状态 |
|---|---|---|---|
| **无窗口段** | `await startDaemon()` 阻塞 `createWindow()` | D1：`runStartup()` 同步调 `createWindow()`，daemon 并行 | ✅ 消除：窗口在 T1 后 ~71–152ms 创建 |
| **白窗口段** | `show:true` + 纯白背景 + 无 critical CSS | D2：`show:false`+`ready-to-show`、主题感知 `backgroundColor`、index.html 内联 boot-splash | ✅ 消除：窗口出现即显示品牌+加载指示 |
| **空数据段** | React 挂载即发请求，daemon 未就绪时失败 | D3：BootGate 先探测 daemon，就绪才挂载 App | ✅ 消除：boot 期间无 hooks 触发、无错误 toast |

## 度量埋点（D0）

### main 进程 perf 日志（stdout，dev 可读）

| 事件 | 埋点位置 | 含义 |
|---|---|---|
| `whenReady` | `startup.ts` runStartup 入口 | Electron 自举完成 |
| `createWindow` | `startup.ts` createWindow 之后 | 窗口已创建+loadRenderer 已触发 |
| `ready-to-show` | `main.ts` showOnce | 窗口实际可见时刻 |
| `daemon-healthy` | `startup.ts` onDaemonReady | daemon 通过健康检查 |

输出格式：`[desktop:perf] <event> +<ms自进程启动>`

### renderer performance.mark（dev console / CDP）

| mark | 埋点位置 | 含义 |
|---|---|---|
| `boot:probing-start` | BootGate 探测开始 | React 已挂载，开始探测 daemon |
| `boot:daemon-ready` | BootGate 探测成功 | daemon 可达 |
| `boot:children-rendered` | BootGate 渲染 children | App/provider 树挂载，界面可交互 |

## 真实采集时间线

### AC-1 正常启动（daemon 无额外延迟）

| 节点 | 真实偏移 | 来源 |
|---|---|---|
| `whenReady` | +64ms | `[desktop:perf]` |
| `createWindow` | +152ms | `[desktop:perf]` |
| `ready-to-show`（窗口可见） | **+708ms** | `[desktop:perf]` |
| `daemon-healthy` | +721ms | `[desktop:perf]` |
| `boot:probing-start` | 567.90ms | renderer `performance.mark` |
| `boot:daemon-ready` | 577.80ms | renderer `performance.mark` |
| `boot:children-rendered` | 578.00ms | renderer `performance.mark` |

### AC-2 daemon 延迟 3s（通过 `JOURNAL_DAEMON_BIN=/tmp/daemon-delay-wrapper.js` 临时注入 3s 延迟）

| 节点 | 真实偏移 | 来源 |
|---|---|---|
| `whenReady` | +30ms | `[desktop:perf]` |
| `createWindow` | +71ms | `[desktop:perf]` |
| `ready-to-show`（窗口可见） | **+541ms** | `[desktop:perf]` |
| `boot:probing-start` | 474.20ms | renderer `performance.mark` |
| `daemon-healthy` | +3661ms | `[desktop:perf]` |
| `boot:daemon-ready` | 4287.90ms | renderer `performance.mark` |
| `boot:children-rendered` | 4251.70ms | renderer `performance.mark` |

> AC-2 窗口仍于 ≤1s 出现；daemon 就绪后 `boot:children-rendered` 与 `boot:daemon-ready` 差值约 36ms（首次）/ 72ms（StrictMode 二次），均 ≤1s。

## 修复前 vs 修复后时间线对比

| 节点 | 基线（串行，估算） | 修复后（并行，实测） | 改善 |
|---|---|---|---|
| 窗口创建 | T2（= daemon 就绪，600–3000ms+） | **T1+71–152ms** | **大幅提前** |
| 窗口可见（有内容） | T3（白窗口，daemon就绪后+Vite冷启） | **+541–708ms（boot-splash）** | **消除白屏** |
| daemon 就绪 | T2（600–3000ms） | +721ms（正常）/ +3661ms（延迟 3s） | 同时刻，但**不阻塞窗口** |
| 界面可交互 | T6（T2+400–2000ms） | daemon 就绪后 ~36–100ms | **提前** |

## 验收结果（实测）

| 命令 | 结果 |
|---|---|
| `pnpm -r test` | ✅ 706 tests passed（desktop 20, contracts 20, daemon 277, web 389） |
| `pnpm build` | ✅ 全 workspace 构建通过（含 electron-builder DMG；code signing 跳过为既有预期行为） |
| `pnpm --filter @journal/web lint` | ✅ 0 errors（9 pre-existing warnings，无新增） |
| `npm run desktop:dev` AC-1 | ✅ 窗口 +708ms 可见，内容非纯白 |
| `npm run desktop:dev` AC-2 | ✅ daemon 延迟 3s 时窗口 +541ms 可见并显示启动态，就绪后自动切换 |
