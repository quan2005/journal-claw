---
result: pass
round: 1
story: STORY-20260628-runtime-cors-unblock
verifier: verification-gate subAgent (independent)
date: 2026-06-28
evidence_basis: [real-chromium-renderer, curl-headers, daemon-tests, web-tests, typecheck, source-file-lines]
---

# 验收报告 · 桌面真实链路读取旧日志阻断修复

> 独立 subAgent 只读核对。所有结论附证据，证据来自文件行号、命令输出或真实运行现象，不引用实现者自述。

## 总判定

**PASS（round 1）** —— AC-1 / AC-2 / AC-3 全部通过，三类边界守住，design 全部条款落地且有测试覆盖。

验收基线：`pnpm desktop:dev` 正在运行（Electron PID 72575 监听 127.0.0.1:17510，Vite PID 72549 监听 [::1]:1420），workspace 为 `/Users/yanwu/Projects/github/journal`，daemon 旧数据可读（6 个月份、2606 月 19 条）。

---

## AC-1 — 旧日志在真实桌面窗口可见 ✅

**判定：通过。**

证据（真实 Chromium headless 加载 `http://localhost:1420`，`waitUntil: domcontentloaded` + 5s 渲染等待后采样 `document.body.innerText`）：

```
"titleHits": [
  "周报-0626",
  "影音收藏目录-蓝光演唱会与电影",
  "周报-0620"
]
```

DOM 正文里命中了 AC-1 点名的 "周报-0626" 与同月真实条目 "影音收藏目录-蓝光演唱会与电影"。空状态已消失，列表已渲染旧日志标题。

佐证（daemon API 返回的旧数据与渲染一致）：

```
curl http://127.0.0.1:17510/journal/months
-> ["2606","2605","2604","2603","2602","2601"]

curl http://127.0.0.1:17510/journal/entries?yearMonth=2606
-> count: 19, first title: "周报-0626"
```

---

## AC-2 — renderer 到 daemon 的业务读取不被浏览器安全策略阻断 ✅

**判定：通过。**

### 2a. 页面内 fetch 成功（真实浏览器上下文执行）

真实 Chromium 在 `http://localhost:1420` origin 下 `fetch` `http://127.0.0.1:17510`：

```
workspace  -> status 200, ok true, body.path "/Users/yanwu/Documents/journal"
months     -> status 200, ok true, body ["2606",...,"2601"]
entries    -> status 200, ok true, count 19, first "周报-0626"
```

与 curl 返回一致，未被 CORS 拦截。

### 2b. 控制台无阻断错误

```
"consoleErrors": []
"requestFailed": []
"consoleAllCount": 3   // 仅 3 条非 error 级消息
```

无 `CORS policy` / `TypeError: Failed to fetch` / `daemon connection failed`。

### 2c. CORS 响应头实测（curl -D -）

| 场景 | Origin | 状态 | ACAO | AC-Methods | AC-Headers |
|---|---|---|---|---|---|
| loopback GET | `http://localhost:1420` | 200 | `http://localhost:1420` | GET,POST,...,OPTIONS | Content-Type, Authorization |
| loopback 预检 OPTIONS | `http://127.0.0.1:1420` | **204** | `http://127.0.0.1:1420` | 同上 | 同上 |
| 非 loopback GET | `https://example.com` | 200 | **无**（不回显） | — | — |
| 无 Origin（curl 同源） | — | 200 | 无（不需要） | — | — |

`Vary: Origin` 在所有允许的响应里都有设置。非 loopback 不下发 CORS 头，浏览器会拒绝跨源读 —— 安全边界正确。

实现位置：`apps/daemon/src/server.ts:66-80`（白名单判定）、`:252-265`（中间件）、`:260-263`（OPTIONS→204）。

---

## AC-3 — 健康进程不再掩盖不可用 UI ✅

**判定：通过。**

本轮验收没有用 `/health`、端口监听或 daemon curl 替代真实窗口验收。所有 AC-1/AC-2 证据均来自**真实 renderer**：DOM 正文文本、页面内 `fetch`、浏览器控制台与请求失败事件。这正是 AC-3 要求的"renderer 可见旧数据 + 无阻断控制台错误"。

---

## 三类边界 ✅

1. **不为 daemon CLI/curl 开发者优化**：实现只动 renderer↔daemon 链路（CORS 中间件、SSE 多路复用、pinned 映射、desktop 预构建 daemon），无 CLI 新增。
2. **不处理远程/多用户/非 loopback 暴露**：
   - daemon 绑定 `127.0.0.1`：`apps/daemon/src/server.ts:2036`（`app.listen(opts.port, '127.0.0.1', ...)`）。
   - 非 loopback origin 实测不下发 ACAO（见 AC-2c 表）。
   - 无 `Access-Control-Allow-Origin: *`：`server.ts:255` 只回显允许的 origin（`rg` 结果确认无 `*`）。
3. **不迁移数据 / 不重做 UI**：diff 仅限 CORS 中间件、`publishEvent` 转发、`HttpRuntimeClient.subscribe` 复用、pinned 映射、`apps/desktop/package.json` 预构建 —— 不涉及数据迁移或日志列表 UI 重写。

---

## design 方案逐条核对 ✅

| design 条款 | 落地证据 | 状态 |
|---|---|---|
| daemon 端 CORS 白名单中间件 | `server.ts:252-265` | ✅ |
| 允许 loopback（localhost/127.0.0.1/[::1]） | `server.ts:70-80`（含 `[::1]` 兜底） | ✅ |
| 允许 `file://` 与 `null`（打包态 loadFile） | `server.ts:70`；`main.ts:93` `loadFile` | ✅ |
| 不允许非 loopback、不用 `*` | `server.ts:74-76` 显式 host 比对；curl 实测 example.com 无 ACAO | ✅ |
| `Vary: Origin` | `server.ts:256`；curl 实测可见 | ✅ |
| Methods/Headers 覆盖 | `server.ts:66-67, 257-258` | ✅ |
| OPTIONS 预检 204 + CORS 头 | `server.ts:260-263`；curl 实测 204 | ✅ |
| 覆盖 JSON + SSE | 中间件在所有路由前；`/events/:event` 也走同一中间件 | ✅ |
| `publishEvent` 同时投递 `app-event` wrapper | `server.ts:299-316` | ✅ |
| `subscribe` 普通命名事件复用单一 `/events/app-event` | `httpRuntimeClient.ts:918-979`（`sharedEventSource`） | ✅ |
| `agent-run` 保持独立 stream | `httpRuntimeClient.ts:922`（`if (event !== 'agent-run')`） | ✅ |
| `get_pinned_items`/`set_pinned_items` 映射 settings | `httpRuntimeClient.ts:146-153`、`normalizePinnedItems:46-67` | ✅ |
| 不新增 daemon route（沿用 `/settings`） | 实现确认无新 route | ✅ |
| `apps/desktop` dev/start/build 前置 `@journal/daemon build` | `apps/desktop/package.json:12-14`（三条脚本均 `pnpm run build:daemon &&`） | ✅ |
| `startDaemon({ port: 0 })` 返回实际 OS 端口 | `server.ts:2036-2039`（`server.address()` 取实际端口） | ✅ |
| 保持 Electron `webSecurity` 默认开启 | `apps/desktop/src/main.ts:77-84`（`webPreferences` 无 `webSecurity:false`，且 `contextIsolation:true`/`nodeIntegration:false`/`sandbox:true`） | ✅ |
| 不暴露 raw Electron IPC / 不关闭 webSecurity | 同上；renderer 经 HTTP 走 daemon | ✅ |

---

## 测试要求核对 ✅

| design 要求 | 落地证据 | 运行结果 |
|---|---|---|
| `server.test.ts` loopback origin 带 ACAO | `server.test.ts:21-33` | 5/5 pass |
| `OPTIONS` 预检 204 + CORS 头 | `server.test.ts:35-51` | pass |
| 非 loopback 不带 ACAO | `server.test.ts:53-64` | pass |
| `startDaemon({ port: 0 })` 实端口 | `server.test.ts:6-13`（`handle.url` 正则） | pass |
| 命名事件复用单一 `/events/app-event` 断言 | `httpRuntimeClient.test.ts:399-423` | 19/19 pass |
| pinned settings 映射断言 | `httpRuntimeClient.test.ts:127-158` | pass |

### 运行结果

```
daemon: npx vitest run src/server.test.ts
  Test Files  1 passed (1)
  Tests       5 passed (5)

web: npx vitest run src/tests/httpRuntimeClient.test.ts
  Test Files  1 passed (1)
  Tests       19 passed (19)

daemon typecheck (tsc --noEmit): exit 0
```

---

## 六字标准自检

- **真**：用真实 Chromium + 真实运行中的 Electron/Vite/daemon，采 DOM 正文、页面内 fetch、控制台、请求失败事件；CORS 头用 `curl -D -` 实测。
- **全**：AC-1/2/3 + 三类边界 + design 全部条款 + 测试要求逐条核对，无遗漏。
- **严**：AC-1/AC-2 不接受"单元测试通过"替代，必须真实 renderer 可见旧标题、真实页面内 fetch 成功 —— 已满足。
- **证**：每条结论均附 `文件:行` / curl 输出 / vitest 输出 / playwright JSON。
- **独**：subAgent 自行读码、自行起 playwright、自行 curl，未引用实现者描述。
- **断**：每项给出明确 ✅/❌ 判定，本轮全部 ✅。

---

## 建议（非阻断）

1. 真实渲染验证目前靠临时 playwright 脚本（本轮放 `/var/folders/.../opencode/verify-cors.mjs`，未污染 workspace）。design "是否需要为 `HttpRuntimeClient` 增加真实浏览器链路的集成/e2e 守卫" 仍是 open 项；建议后续把这条真实链路 e2e 沉淀进 `apps/web` 的 playwright 套件，避免回归只能靠手动起 desktop:dev。
2. `get_pinned_items` 降噪已落地，story 交棒清单 Q6 可关闭或拆独立 story。

以上均不阻断本轮验收。
