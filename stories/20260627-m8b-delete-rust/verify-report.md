# M8-b 终局验收报告（Leader 独立验收）：PASS 🏁

## 删除确认

- apps/web/src-tauri 物理删除（83 .rs + target/ + Cargo.toml/tauri.conf.json，214 tracked 文件 git rm）
- @tauri-apps npm 依赖删除（api/cli/plugin-dialog/plugin-opener），node_modules 已清除
- 磁盘 apps/web 从 37G → 48M（释放 target/ 构建产物）

## Gate 验收（决定性）

- Gate A（前端不依赖 Tauri）：✅ 源码 rg @tauri-apps = 0；package.json 无 @tauri-apps
- Gate H（默认 build/test 不依赖 Rust/平台二进制）：✅ 删 src-tauri 后全量测试全绿
- 残留：rg "src-tauri|@tauri-apps|tauri::|#[tauri::command]" 源码 = 0（仅历史/迁移文档）

## 全量测试矩阵（删 Rust 后）

- daemon：tsc clean + 446 passed（零回退）
- desktop：tsc clean + 13 passed
- web：tsc clean + 失败 9（全基线子集：HistoryFloatingButton/IdeasWorkbench/light-theme-unit/SandboxPreview，零新增）

## 文档产出

- AGENTS.md：技术架构段去 Tauri、约束全改写（runtime 单一入口→daemon/hostBridge）、CI/CD 去 Rust
- docs/adr/rust-removal-acceptance.md（Gate A–J）、rollback.md、release-note.md
- parity 矩阵 blocked=0

## 结论

Rust 后端彻底删除，TS daemon（pi 引擎）+ Electron host 完全覆盖用户可见能力。迁移完成。
