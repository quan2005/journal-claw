---
id: STORY-20260628-runtime-cors-unblock
title: "桌面真实链路读取旧日志阻断修复"
status: verified
source: gate
level: L2
hypothesis_basis: data
design: ./design.md
created: 2026-06-28
related:
  - ../20260627-final-state-cleanup/story.md
  - ../../docs/final-state.md
  - ../../apps/web/src/lib/runtimeClient.ts
  - ../../apps/web/src/lib/httpRuntimeClient.ts
  - ../../apps/daemon/src/server.ts
  - ../../apps/desktop/src/main.ts
---

# 桌面真实链路读取旧日志阻断修复

> 一句话概括：**为迁移后验收桌面应用的维护者解决“daemon 能读到旧数据，但真实桌面窗口看不到旧日志”的问题**

## 用户故事（Connextra）

作为 **正在验收 JournalClaw 迁移结果的维护者**，
当我 **运行 `pnpm desktop:dev` 并打开真实 Electron 窗口检查旧数据是否可见**，
我希望 **窗口中的日志列表、详情和基础侧边栏数据能直接显示 daemon 已读取到的旧 workspace 内容**，
以便 **不用怀疑旧数据丢失，也不用绕过 UI 通过 curl 才能确认数据仍在**。

## 真实用户问题（背景，讲故事）

本轮按 3 个“迁移成功”标准验收时，数据面已经证明旧数据仍在：daemon 当前识别 workspace 为 `/Users/yanwu/Documents/journal`，`/journal/months` 返回 `["2606","2605","2604","2603","2602","2601"]`，`/journal/entries?month=2606` 返回 349 条旧日志，文件系统约 2124 个文件、1.9G。[证据：本轮 curl 与 find 输出]

但真实桌面窗口仍显示空状态。Chrome/renderer 实测 `http://localhost:1420` 页面可以加载，body 只显示“谨迹待命中 / 粘贴 / 拖文件 / 创建示例条目”，旧日志标题如“周报-0626”“影音收藏目录-蓝光演唱会与电影”均不可见；页面内 `fetch('http://127.0.0.1:17510/config/workspace-path')` 报 `TypeError: Failed to fetch`，控制台有 `/journal/months`、`/config/workspace-path`、`/identity`、`/topics`、SSE events 等请求被 CORS 拦截。[证据：本轮 Playwright/Chrome runtime smoke]

### 现状失败模式

- 用户现在怎么解决？只能通过 curl 直接访问 daemon API 或检查磁盘目录确认旧数据仍在，真实桌面 UI 无法作为验收入口。[证据：daemon API PASS，renderer UI FAIL]
- 为什么不够好？迁移成功的核心体验是打开桌面端就能浏览旧日志；当前进程都健康但 renderer 无法读 daemon，会让用户误判“数据全丢了”。[证据：用户反馈“仍然没有任何数据，我之前的数据全丢了？”]
- 哪些数据/反馈支撑？本轮实测 daemon 健康、Vite 健康、Electron 窗口加载成功，但 daemon 响应头缺少 `Access-Control-Allow-Origin`，Vite 无 proxy，Electron 未关闭 webSecurity，runtimeClient 恒走 HttpRuntimeClient，因此真实浏览器安全模型会阻断 renderer 到 daemon 的业务请求。[证据：`apps/web/src/lib/runtimeClient.ts`、`apps/web/src/lib/httpRuntimeClient.ts`、`apps/desktop/src/main.ts`、`apps/daemon/src/server.ts` 与 curl headers]

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，迁移验收者会：
- 通过真实桌面窗口确认旧日志是否可见：当前空状态 → 能看到旧月份和旧日志条目。
- 通过浏览器/renderer 控制台判断链路是否健康：当前有阻断性 CORS/Failed to fetch → 无阻断旧数据加载的 CORS/daemon 连接错误。

假设依据：以上基于本轮 live runtime 验收数据，属于 data。

## 验收标准（Given-When-Then）

### AC-1 — 旧日志在真实桌面窗口可见
- **Given** `/Users/yanwu/Documents/journal` 中存在历史月份和旧日志，且 daemon API 能返回这些数据
- **When** 维护者运行 `pnpm desktop:dev` 并打开真实 Electron/dev renderer 页面
- **Then** 日志列表不再停留在“谨迹待命中”的空数据状态
- **And** 页面可见至少一个 daemon 已返回的旧日志标题，例如“周报-0626”或同月其他真实条目

### AC-2 — renderer 到 daemon 的业务读取不被浏览器安全策略阻断
- **Given** renderer origin 为 `http://localhost:1420`，daemon 为 `http://127.0.0.1:17510`
- **When** 页面加载并触发 workspace、months、entries、topics、identity 等基础读取
- **Then** 控制台不出现阻断数据加载的 CORS policy / `TypeError: Failed to fetch` / daemon connection failed 错误
- **And** 页面内发起的基础业务读取能拿到和 curl daemon API 一致的旧数据

### AC-3 — 健康进程不再掩盖不可用 UI
- **Given** Vite、Electron、daemon 三个进程均健康
- **When** 验收者按“数据完整可达、桌面端真实链路可用、迁移边界干净”三项复验
- **Then** “桌面端真实链路可用”必须以 renderer 可见旧数据和无阻断控制台错误为准
- **And** 不能只用 `/health`、端口监听或 daemon curl 成功替代真实窗口验收

## 三类边界（脊柱 Q5 · Won't · 输出闸必填）

- **不为哪些用户做**：不为仅使用 daemon CLI/curl 的开发者优化 API；本故事服务于桌面端迁移验收和真实窗口读取旧数据。
- **不在哪些场景出现**：不处理远程网络访问、多用户服务部署、非 loopback daemon 暴露或移动端浏览器访问；本故事只覆盖本地桌面应用的 renderer 与本机 daemon。
- **不解决哪些相关但不同的问题**：不迁移/恢复丢失数据，不重做日志列表 UI，不恢复语音/转写能力，不处理与旧数据加载无关的设置页文案和历史文档残留；`get_pinned_items` 等非阻断旧日志可见性的 unsupported command 可作为相邻风险记录，但不扩大为本故事核心目标。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] 本地桌面 runtime 应通过 daemon loopback CORS、Vite dev proxy、Electron protocol/same-origin 还是 preload bridge 解决跨源读取？
- [ ] 修复是否同时覆盖开发态 `http://localhost:1420` 和打包态 renderer？
- [ ] SSE/event endpoints 是否需要和普通 JSON API 一起纳入验收？
- [ ] CORS/同源策略的允许范围如何限制在安全的 loopback origin，不误开放局域网或任意 origin？
- [ ] 是否需要为 `HttpRuntimeClient` 增加真实浏览器链路的集成/e2e 守卫？
- [ ] `get_pinned_items` unsupported command 是否应在本故事中降噪，还是拆为独立 story？

## 待确认（意图层）

| # | 问题 | 当前默认值 | 状态 |
|---|---|---|---|
| Q1 | 是否把“真实桌面窗口能看到旧数据”作为必须修复项，而不是仅记录验收失败？ | 必须修复 | 已由用户确认 |
| Q2 | 是否允许本故事只修复 renderer 到 daemon 的本地读取链路，不顺手重做 UI 或数据迁移？ | 只修链路 | 已由用户确认 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：可独立修复 renderer-daemon 读取链路，不依赖其他迁移 story
- [x] **N** Negotiable：story 不钉死实现手段，CORS/proxy/protocol/bridge 取舍交给 design.md
- [x] **V** Valuable：直接解决“旧数据还在但桌面端看不到”的验收阻断
- [x] **E** Estimable：失败链路、涉及模块和验收命令已有本轮 runtime 证据
- [x] **S** Small：限定本地桌面 runtime 读取链路，不扩大到数据迁移或 UI 重做
- [x] **T** Testable：AC 可由 daemon API、真实 renderer 控制台和页面可见旧标题验证

## 门禁记录

| 轮次 | 日期 | Readiness | 主要缺口 |
|---|---|---|---|
| 1 | 2026-06-28 | 待澄清 | 需要用户确认是否从“验收失败记录”进入“修复真实链路阻断”；approved 前不写实现代码 |
| 2 | 2026-06-28 | 可开发 | 用户已确认 approved；按当前故事范围只修本地 renderer-daemon 读取链路 |
