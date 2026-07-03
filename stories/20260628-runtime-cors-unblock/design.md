# 桌面真实链路读取旧日志阻断修复设计

## 目标

让真实 Electron/dev renderer 能从本机 daemon 读取旧 workspace 数据，消除 CORS 导致的空列表误判。修复后仍保持 Electron `webSecurity` 默认开启，daemon 仍只绑定 loopback，不引入 Tauri/IPC 回退。

## 方案

在 `apps/daemon/src/server.ts` 增加 daemon 端 CORS 白名单中间件：

- 允许 loopback HTTP origins：`localhost`、`127.0.0.1`、`[::1]`，端口不限，用于 Vite dev 和未来本地预览。
- 允许桌面打包态常见 file/opaque origin：`file://` 与 `null`，用于 Electron `loadFile` 场景。
- 不允许非 loopback host，例如局域网 IP、外网域名或任意 `*`。
- 对允许 origin 回显 `Access-Control-Allow-Origin`，并设置 `Vary: Origin`。
- 覆盖 JSON API 与 SSE：允许 `GET,POST,PUT,PATCH,DELETE,OPTIONS`，允许 `Content-Type, Authorization`。
- 对预检 `OPTIONS` 返回 204，避免 Express 默认 `Allow: GET,HEAD` 响应缺少 CORS 头。

选择 daemon 端而不是 Vite proxy 的原因：Vite proxy 只解决开发态，无法覆盖 Electron `loadFile` 后 renderer 访问 loopback daemon 的生产态路径。

同时修复 CORS 生效后的第二个运行时问题：前端启动时会订阅多个命名事件，若每个事件都打开一条 `/events/:event` SSE，浏览器对 `127.0.0.1:17510` 的连接池会被长连接占满，导致普通 fetch 被排队到超时。方案：

- daemon 的 `publishEvent(event, payload)` 继续投递给原命名事件订阅者，并额外投递 `{ event, payload }` 到 `app-event`。
- `HttpRuntimeClient.subscribe(event, handler)` 对普通命名事件复用单一 `/events/app-event` EventSource，在客户端按 `event` 分发。
- `agent-run` 这类 run-specific stream 保持独立，不混入 app-event。

最后补齐真实链路验收中暴露的非阻断但 noisy 的 runtime command：

- `get_pinned_items` / `set_pinned_items` 映射到已有 workspace settings 的 `pinned` 字段。
- 不新增 daemon route；沿用 `GET/PUT /settings`，过滤坏数据后返回 `PinnedItem[]`。

## 安全边界

- daemon 继续 `listen(..., '127.0.0.1')`，不成为网络服务。
- 不关闭 `webSecurity`，不暴露 raw Electron IPC。
- 不使用 `Access-Control-Allow-Origin: *`。
- `null`/`file://` 仅为桌面本地 file origin 兼容；后续若切到自定义 `app://` protocol，应把白名单收窄到该 origin。

## 测试

- `server.test.ts` 增加 CORS 集成测试：
  - loopback origin 请求 `/config/workspace-path` 带 ACAO。
  - `OPTIONS` 预检返回 204 与 CORS 头。
  - 非 loopback origin 不带 ACAO。
- 修正 `startDaemon({ port: 0 })` 返回实际 OS 分配端口，支撑真实 HTTP 集成测试。
- `httpRuntimeClient.test.ts` 增加命名事件复用断言：多个 app-level 订阅只创建一条 `/events/app-event` EventSource，并按 wrapper 分发。
- `httpRuntimeClient.test.ts` 增加 pinned settings 映射断言，避免控制台继续出现 `unsupported command "get_pinned_items"`。
- `apps/desktop` 的 dev/start/build 前置 `@journal/daemon build`，避免 Electron 启动陈旧的 `apps/daemon/dist/cli.js`。

## 验收

- 复跑 daemon typecheck/test。
- 启动 `pnpm desktop:dev`。
- 用真实 Chromium 访问 `http://localhost:1420`，确认旧日志标题可见，页面内 fetch daemon 成功，控制台无阻断旧数据加载的 CORS/Failed to fetch。
