---
status: verified
phase: ME-a
created: 2026-06-27
---

# ME-a · pi 引擎集成骨架 + vendor 配置

## 背景
决策 1 = A′（用户 2026-06-27）：采用 pi（@earendil-works/pi-agent-core + @earendil-works/pi-ai，MIT）作 daemon 内建 LLM 引擎，替代 Rust 内建引擎。ME-a 是骨架层。

## 目标
- daemon 加 pi 依赖（锁版本）。
- 引擎 service：用 pi Agent / agentLoop 封装一个最小可跑的 daemon 引擎入口。
- vendor/model 配置：anthropic/openai 原生；volcengine/zhipu/dashscope 经 pi 的 openai-completions provider + 自定义 baseURL 注册（用户配置可指定 vendor/baseURL/model）；接 ConfigService（M1a-2 加密 api key + engine config）。
- 用 pi 的 `faux` provider 写测试（无需真 key 跑通一轮 agent）。

## 范围
1. `apps/daemon/package.json` 加 @earendil-works/pi-ai + @earendil-works/pi-agent-core（锁定具体版本，pnpm install）。
2. `apps/daemon/src/engine/service.ts`：封装 pi Agent；从 ConfigService 读 engine config（vendor/model/baseURL）+ 解密 api key，getModel 或自定义 OpenAI-compatible provider 注册；getApiKey 动态解析（pi 支持 getApiKey 回调）。
3. 国产 vendor：用 pi 的 openai-completions / 自定义 baseURL 机制注册 volcengine/zhipu/dashscope（读 pi-ai 文档/源码确认注册方式）。先把配置面打通，真实调用待 key。
4. `apps/daemon/src/engine/service.test.ts`：用 faux provider 跑通一轮 agent.prompt，断言事件序列（agent_start→…→agent_end）；vendor 配置解析测试（含国产 baseURL 注册不报错）。
5. 不接 AgentRunService、不实现工具、不接前端（ME-b/ME-c 做）。

## 约束
- 锁版本（供应链）；只动 apps/daemon（package.json + engine/）。
- 不删 Rust；不碰范围外 dirty。
- 若 npm/pnpm 网络不可用导致装不上 pi，停止并报告（我来处理网络）。

## 验收（Given-When-Then）
- Given faux provider，When engine 跑一轮 prompt，Then 收到完整 pi 事件序列。
- Given engine config 指定国产 vendor + baseURL + 加密 key，Then 配置解析成功、provider 注册不报错。
- daemon tsc clean；vitest ≥392 passed 无新失败（新增 engine 测试）。
