---
status: verified
phase: M1a
created: 2026-06-27
---

# M1a · Settings 服务（daemon）

## 背景

Rust 退出 M1 地基首子单元。Rust `workspace_settings.rs` 把设置存于 `<workspace>/.setting.json`（serde pretty JSON，结构体 WorkspaceSettings：theme / auto_lint / automation frequency-time-min_entries 等）。daemon 需提供同等读写，**保持 .setting.json 格式兼容（Gate G）**。

## 目标

daemon 实现 SettingsService + HTTP 路由，读写 `<workspaceRoot>/.setting.json`，覆盖：theme、auto_lint config、automation settings、global skills enabled / per-skill enabled。前端经 feature flag 切到 daemon，Tauri 路径不回退。

## 范围

1. daemon `apps/daemon/src/settings/service.ts`：load/save `.setting.json`（路径 = workspace root，与 WorkspaceService 一致）；schema 对齐 Rust WorkspaceSettings（字段名、默认值、校验：theme∈{light,dark,system}、frequency/time/min_entries 校验）。读不存在返回默认；写 merge 保留未知字段（向前兼容）。
2. HTTP：`GET /settings`、`PUT /settings`（部分更新）；或细分 `GET/PUT /settings/theme`、`/settings/auto-lint`、`/settings/automation`、`/settings/skills`。对齐现有 daemon 路由风格。
3. 前端 `apps/web/src/lib/tauri.ts`：theme / auto_lint / automation / skills 开关相关命令经 runtime flag 走 daemon（参考 G5 HttpRuntimeClient 模式）；flag off 仍走 Tauri。
4. 测试：daemon service 单元测试（含 schema 兼容、默认值、merge 保留未知字段、校验拒绝）；前端 client 测试。

## 不在范围

- config.rs 的 API key / engine config（安全敏感，留 M1a-2）。
- ASR/音频设置（M0 已下线）。

## 验收（Given-When-Then）

- Given 已有 .setting.json，When daemon GET /settings，Then 返回与文件一致、未知字段保留。
- Given PUT /settings 改 theme，Then .setting.json theme 更新、其余字段不丢。
- Given 非法 theme，Then 结构化拒绝。
- Given daemon 测试，When 运行，Then 全绿；daemon 既有 281 测试不回退。
- Given 前端 flag on，Then theme/skills 切换走 daemon 持久化。

## Leader 范围裁决（2026-06-27）

"automation settings" 指 `.setting.json` 内 auto_lint（含 frequency/time/min_entries 调度字段）。Automation Workbench 的 routine/template/run 命令属 **M6**，不在 M1a。codex 实现符合此原意。

## 验收结论（Leader 独立验收）：PASS

- daemon: tsc clean；vitest 288 passed/39 files（基线 281，+7 settings 测试，零回退）
- web: tsc clean
- Gate G: 服务读写 `<workspace>/.setting.json`（pretty JSON），schema 与 Rust AutoLintConfig 完全对齐（enabled/frequency/time/min_entries），merge 保留未知顶层字段 + auto_dream 遗留命名 fallback
- 前端: theme/auto_lint/skills 经 selectRuntimeClient runtime flag 走 daemon，Tauri 不回退
- 越界: 仅 daemon settings/ + server.ts + 前端 tauri.ts/useTheme + 测试 + story
