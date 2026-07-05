# 启动性能基线（修复前）

Story：`./story.md` · 采集方式：代码路径静态分析 + `apps/desktop/src/main.ts` 串行链拆解。

## 当前启动时序（串行链）

```
T0  进程启动 (electron .)
    │
    │  app.whenReady()          ← Electron 初始化（~50–200ms）
    ▼
T1  whenReady 回调入口
    │
    │  await startDaemon()      ← 串行阻塞！窗口在此期间完全不创建
    │    ├ spawn node cli.js
    │    ├ Express 监听端口
    │    └ waitForHealth()：每 500ms 轮询，最多 30 次（= 最长 ~15s）
    ▼
T2  daemon healthy              ← 典型 500ms–3s（冷启 + Node 启动）
    │
    │  createWindow()           ← 窗口这才创建
    │    └ show:true（默认）→ 立即显示空白窗口
    ▼
T3  窗口出现（纯白 #FFFFFF）
    │
    │  loadURL(dev server)      ← Vite 冷启动首次 transform（~200ms–1s+）
    ▼
T4  HTML 到达 renderer
    │
    │  JS bundle 解析 + React 挂载（main.tsx → providers → App）
    ▼
T5  React 首次提交（仍未有数据）
    │
    │  hooks 首次请求（useJournal/useIdentity/useTheme…）命中 daemon
    ▼
T6  首个有意义绘制（数据返回 + 列表渲染）
```

## 白屏成因（三个叠加段）

| 段           | 时间区间 | 成因                                                                               | 严重度  |
| ------------ | -------- | ---------------------------------------------------------------------------------- | ------- |
| **无窗口段** | T1 → T3  | `await startDaemon()` 阻塞 `createWindow()`，daemon 未就绪前连窗口都不出现         | 🔴 主因 |
| **白窗口段** | T3 → T5  | `show:true` + `backgroundColor:#FFFFFF` + 无 critical CSS，Vite/React 加载期间纯白 | 🟠 次因 |
| **空数据段** | T5 → T6  | React 已挂载但 hooks 首次请求 daemon，返回前列表为空（骨架/空态闪烁）              | 🟡      |

## 关键证据（代码行号）

- `main.ts:115` — `daemonHandle = await startDaemon()` **在** `createWindow()` (line 120) **之前 await**，串行阻塞。
- `main.ts:76` — `backgroundColor: '#FFFFFF'`，深色主题下出现白闪。
- `main.ts:106` — `new BrowserWindow(windowOptions())`，无 `show:false` / `ready-to-show`。
- `index.html:19-21` — `<body>` 内无内联内容，JS 未执行前 renderer 完全空白。
- `main.tsx:14` — React 直接挂载 `<App/>`，无 boot 态兜底；App 内 hooks（`useJournal` 等）挂载即发请求，daemon 未就绪时失败。

## 估算时间线（dev 模式，daemon 冷启）

| 节点              | 估算偏移（ms） | 说明                                       |
| ----------------- | -------------- | ------------------------------------------ |
| T0 进程启动       | 0              | `electron .`                               |
| T1 whenReady      | ~100–200       | Electron 自举                              |
| T2 daemon healthy | ~600–3000      | spawn + Express + 首次 health 轮询命中     |
| T3 窗口出现       | **= T2**       | 被串行阻塞，窗口出现时刻 = daemon 就绪时刻 |
| T4 HTML 到达      | T3 + ~200–1200 | Vite dev 冷启动 transform                  |
| T5 React 挂载     | T4 + ~100–300  | provider 树 + lazy 解析                    |
| T6 首个有意义绘制 | T5 + ~100–500  | hooks 请求往返                             |

**窗口出现时间 ≈ T2（600ms–3s+），首个有意义绘制 ≈ T2 + 400–2000ms。**

AC-1（窗口出现即有内容且 ≤1s）在 daemon 冷启 >600ms 时即不达标；AC-2（daemon 延迟 3s）完全不达标。

## 修复方向（对应 design.md D1–D3）

- **D1**：打碎 T1→T3 串行链，`createWindow()` 与 `startDaemon()` 并行 → 窗口出现提前到 T1+~50ms。
- **D2**：`show:false` + `ready-to-show` + 主题感知 `backgroundColor` + index.html critical CSS → 消除白窗口段。
- **D3**：BootGate 先渲染启动态，指数退避探测 daemon，就绪后才挂载 App → 消除空数据段白屏，且 boot 期间不弹错误 toast。
