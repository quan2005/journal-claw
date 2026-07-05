---
status: verified
date: 2026-07-03
slug: startup-white-screen
level: L2
---

# 启动白屏消除（desktop:dev）

## 用户故事

作为本项目的维护者（每天多次以 `npm run desktop:dev` 启动应用进行开发与自测），
我需要应用窗口出现后立即有可感知的界面反馈，而不是长时间白屏，
以便每次启动/重启不打断心流，也能在真实使用中对产品首启体验有信心。

## 背景与失败模式（证据）

- 现象：首次启动出现一段白屏；关闭应用后再次打开，白屏依旧（非仅冷启动问题，每次启动必现）。
- [证据] `apps/desktop/src/main.ts:110-120`：`app.whenReady()` 后 **先 `await startDaemon()`（spawn + waitForHealth 轮询）再 `createWindow()`**——daemon 未就绪前连窗口都不出现；daemon 起慢时用户面对的是"无窗口→白窗口"的串行等待。
- [证据] `apps/desktop` dev 启动含 `build:daemon` 前置构建（commit 567c454），进一步拉长窗口出现前的时间。
- [推测，需 design 阶段实测] renderer 首屏可能等待 daemon 数据返回才渲染有意义内容，白屏 = 窗口出现但 React 未挂载/未绘制的叠加段。

## 成功标准（Q4）

- 启动后 ≤1 秒内出现应用窗口且窗口内立即有可感知内容（品牌/骨架/加载态，而非纯白）。
- daemon 未就绪期间 UI 呈现明确的启动中状态，daemon 就绪后自动进入正常界面，无需用户操作。
- 关闭再打开与首次启动表现一致达标。

## 验收标准（GWT）

- **AC-1 窗口即时可感知**：Given 维护者运行 `npm run desktop:dev`（daemon 前置构建完成后），When Electron 窗口出现，Then 窗口从出现起任一时刻均不呈现纯白内容（有背景色/品牌/骨架/加载指示），且窗口出现到首个有意义绘制 ≤1 秒。
- **AC-2 daemon 慢速不阻塞窗口**：Given daemon 启动被人为延迟（如 3 秒），When 启动应用，Then 窗口仍在 ≤1 秒内出现并显示启动中状态，daemon 就绪后 ≤1 秒内自动切换为正常界面。
- **AC-3 再启动一致**：Given 应用已完整退出，When 再次启动，Then AC-1/AC-2 同样成立。
- **AC-4 有度量证据**：Given 修复完成，When 运行验收，Then 提供启动时间线度量（窗口出现、首次绘制、daemon 就绪、界面可交互各时间点）作为 verify-report 证据，而非目测。

## 三类边界（Won't）

- **不为谁**：不针对打包分发版做专门优化验证（用户当前只在 dev 模式使用；打包版受益但不作为本次验收对象）。
- **不做哪些场景**：不处理运行时（启动完成后）的性能问题；不优化 `build:daemon` 前置构建本身的耗时；不做启动画面美术设计（用现有 DESIGN.md token 做朴素加载态即可）。
- **不解决哪些相关问题**：不改变 daemon 的业务初始化逻辑与数据加载语义；不引入新框架/新依赖。

## 交棒清单（→ design.md）

1. 白屏时间线实测拆解：窗口创建时机 / renderer 加载 / React 挂载 / 首个数据返回，各占多少（先测量再动手）。
2. 窗口与 daemon 启动的并行化方案及 renderer 侧"daemon 未就绪"状态的呈现与重连机制。
3. `show: false` + `ready-to-show` / 背景色兜底等 Electron 惯用手段的取舍。
4. 度量手段选型（性能标记如何采集进验收证据）。

## 门禁判定

- Readiness：可开发（用户 2026-07-03 批准）
