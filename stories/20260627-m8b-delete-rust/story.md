---
status: verified
phase: M8-b
created: 2026-06-27
---

# M8-b · 删除 Rust 后端（终局）

## 背景

M8-a 已清前端 @tauri-apps 硬依赖。ME 引擎(pi)+ M1-M7 daemon/Electron 已覆盖全部用户可见能力。Gate A–J 前置达成。删除 src-tauri + @tauri-apps 依赖。

## 范围

1. 删 apps/web/src-tauri/（83 .rs + target/ 37G + Cargo.toml/tauri.conf.json/build.rs 等 214 tracked 文件）。
2. 删 @tauri-apps npm 依赖（api/cli/plugin-dialog/plugin-opener）——改 package.json（Leader 事后 pnpm install）。
3. 清 4 个测试 vi.mock('@tauri-apps') 残留（AutomationWorkbench/SectionAiEngine/HistoryFloatingButton/App）；保留 useConversation.test 守护断言。
4. 全量测试矩阵：daemon + web + desktop tsc + vitest 全绿（web 失败基线子集 9）。
5. 文档：parity 矩阵全 replaced/retired；AGENTS.md（约束6 IPC→daemon、技术架构段去 Tauri、CI/CD 去 Rust/cargo）；回滚说明 + release note + Gate A–J 验收报告。
6. CI 矩阵建议（M7/M8 补 Win/Linux，标注）。

## 约束

- 删除前 git 已干净（src-tauri tracked，删后可 git checkout 恢复）。
- @tauri-apps 删后前端不崩（M8-a 已清静态 import；测试 mock 清理后守护断言保留）。
- 不动 apps/daemon、apps/desktop 业务代码。

## 验收（Gate A–J）

- 删除后 `rg "src-tauri|@tauri-apps|tauri::|invoke_handler|#[tauri::command]"` 仅历史/迁移文档。
- daemon vitest 全绿；web tsc clean + 失败基线子集；desktop tsc + 测试绿。
- package.json 无 @tauri-apps；node_modules 无 src-tauri 构建。
- parity 矩阵 blocked=0；Gate A–J 逐条 PASS 记录。
- 回滚说明 + release note 就绪。
