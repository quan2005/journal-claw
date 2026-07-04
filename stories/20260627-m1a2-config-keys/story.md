---
status: verified
phase: M1a-2
created: 2026-06-27
---

# M1a-2 · Config 服务（API key 加密 + engine config + app/platform）

## 背景

M1 地基收尾。Rust `config.rs` 把配置存于 Tauri app config dir 的 `config.json`（含 workspace_path、engine config、api_key 明文、legacy 字段）。命令：get/set_api_key、get/set_engine_config、get/set_workspace_path、get_app_version、get_platform_capabilities、list_models。

## 决策（用户已定）

- API key **简单加密存储**（非明文），存用户配置目录（非 workspace，避免随仓库泄露）。
- 逐能力渐进切换，Tauri 不回退。

## 目标

daemon ConfigService 覆盖上述配置；API key 用 node crypto 对称加密（AES-256-GCM，密钥派生自用户配置目录内一份受限权限的本地 secret 文件，首次生成）；engine config / workspace_path / app version / platform capabilities 经 daemon 提供。

## 范围

1. daemon `apps/daemon/src/config/service.ts` + 测试：
   - config 存储位置：用户配置目录（如 XDG_CONFIG_HOME/journal 或 os 等价；与现有 daemon 约定一致）。
   - API key：setApiKey 加密落盘、getApiKey 解密返回；secret 文件 0600 权限；解密失败/无 key 返回 null。
   - engine config / workspace_path：读写；**Gate G 迁移**：若存在 Rust 旧 config.json，首次读取迁移 workspace_path（只读取，不破坏旧文件）。
   - app version（从 package.json 读）、platform capabilities（daemon 侧推断；音频相关能力恒 false，已下线）。
2. HTTP 路由：GET/PUT /config/api-key、/config/engine、/config/workspace-path、GET /config/app-version、/config/platform-capabilities。对齐现有风格。
3. 前端 tauri.ts 对应封装经 runtime flag 走 daemon，Tauri 不回退。
4. 测试：加密往返、权限、迁移读取、engine 读写、缺失默认。

## 不在范围

- ASR/whisperkit 配置（M0 下线）。
- list_models（依赖 vendor，留 M4/M5 引擎决策后）。

## 验收（Given-When-Then）

- Given setApiKey，Then 落盘密文（非明文）、getApiKey 解密一致。
- Given 旧 config.json 有 workspace_path，Then daemon 首次能读到、不破坏旧文件。
- Given 非法 engine config，Then 结构化拒绝。
- Given daemon 测试，Then 全绿 ≥325 不回退；web tsc clean。
