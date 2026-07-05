# Design：启动白屏消除

Story：`./story.md`（approved 2026-07-03）。约束引用：`docs/ARCH.md` 依赖方向规则（renderer 只经 runtimeClient/hostBridge）、`docs/CONVENTIONS.md` §3 测试策略。

## 方案（四层防线 + 度量先行）

### D0 度量埋点（先做，改动前后各采一次作对比证据）

- main 进程：`app.whenReady`、`createWindow`、`ready-to-show`、daemon `healthy` 四个时间点打日志（`log('perf', ...)`，相对 `process.getCreationTime()`/启动时刻的 ms）。
- renderer：`performance.mark` 记录 React 挂载完成、首个 daemon 响应到达、界面可交互；boot 阶段经 console 输出（dev 可读）。
- 产出前后对比表进 verify-report（AC-4）。

### D1 窗口与 daemon 并行（主因修复）

`apps/desktop/src/main.ts`：`app.whenReady()` 后**立即 `createWindow()`**，`startDaemon()` 不再 await 阻塞——并行启动，健康结果经现有日志与 hostIpc 通知 renderer（若无现成通道则不加：renderer 本就自带 HTTP 重试探测，见 D3）。退出时序与 daemonHandle 生命周期语义不变。

### D2 消除窗口自身的白闪

- `BrowserWindow` 增加 `backgroundColor`（取 DESIGN.md 的 app 背景 token 值，深浅主题各一，按上次持久化主题选择；拿不到时用浅色默认）。
- `show: false` + `ready-to-show` 再 show：避免"空窗骨架→内容"跳变。dev 模式 Vite 首次 transform 可能 >1s，`ready-to-show` 需配 3s 超时兜底强制 show，防止 dev server 慢时窗口迟迟不出现（AC-1 的 ≤1s 以窗口出现为锚，兜底不牺牲该指标——超时兜底只在异常慢时触发）。
- `apps/web/index.html`：`<body>` 内联最小 critical CSS（背景色 + 居中品牌加载指示），JS bundle 未执行前就有内容。

### D3 renderer 启动态（daemon 未就绪不白屏不报错）

- App 挂载后立即渲染 boot/加载态（复用现有 UI token，朴素即可，不做美术）。
- 增加 daemon 可达性探测：经 `runtimeClient`（如轻量 `health`/现有最廉价 command）指数退避重试（250ms 起，上限 2s，总时长 30s 后转错误态含重试按钮）；就绪后 ≤1s 内进入正常界面（AC-2）。
- 现有各 hook 的首次数据请求失败不得弹错误 toast——boot 阶段统一由启动态兜住（只改启动窗口期行为，不改数据语义）。

### D4 测试

- desktop：main.ts 启动顺序单测（createWindow 不等待 daemon —— 以模块内时序/调用序断言）。
- web：boot 状态组件测试（未就绪显示启动态、探测成功切换、超时转错误态）。红测试先行（CONVENTIONS §3）。
- AC-2 人工验证脚本：临时给 daemon 加 3s 延迟环境变量或 kill daemon 后启动，记录时间线。

## 任务分发

单个 opencode 任务（改动跨 desktop+web 但内聚，串行一次交付），kimi 验收（对照 AC-1..4 + 时间线证据），Claude 终审。

## 风险

- `ready-to-show` 在 dev 下受 Vite 冷启动影响 → 已用超时兜底。
- 并行化后 daemon 崩溃场景：renderer 探测 30s 超时转错误态，不再有"永远白屏"。
