---
status: verified
phase: M2
created: 2026-06-27
---

# M2 · 本地数据 CRUD（daemon）

## 背景

M2 把文件型本地数据 CRUD 迁到 daemon。Rust 模块：journal.rs、todos.rs、topics.rs、identity.rs、materials.rs。均为 workspace 内文件读写。

## 目标

daemon 提供各模块的 service + HTTP 路由，**严格对齐 Rust 文件格式/路径/字段（Gate G，现有 workspace 文件不需重导）**；前端经 runtime flag 走 daemon，Tauri 不回退。

## 范围（逐模块，读对应 Rust 源对齐行为）

1. **journal**（apps/web/src-tauri/src/journal.rs）：list months / list by months / list all / paginated / get content / save content / delete / create sample entry（+ if_needed）。
2. **todos**（todos.rs）：list / add / toggle / delete / set due / set path / set session / remove path / update text。
3. **topics**（topics.rs）：list dir / create / delete / import file（含 import_file_to_topic）。
4. **identity**（identity.rs）：list / get content / save content / delete / archive / unarchive / create / merge（保留 speaker_id 遗留字段，M0 已下线音频但 identity 数据兼容）。
5. **materials**（materials.rs）：4 命令对齐。

## 约束

- Gate G：文件路径、frontmatter/字段、排序、分页语义与 Rust 一致；写操作可复用 ChangeSetService（合成 runId，如各模块 'journal-manual' 等）或直接写——择优说明。
- 前端 tauri.ts 对应封装经 selectRuntimeClient runtime flag。
- 不删 Rust；不碰范围外 dirty；音频不涉及。

## 验收（Given-When-Then）

- 每模块：daemon service + 路由 + 前端封装 + 测试；读已有 workspace 文件与 Rust 行为一致。
- delete 类操作可恢复或符合 Rust 语义。
- daemon 测试全绿 ≥334 不回退；web tsc clean。
- 越界核查：仅各模块 daemon service + server.ts + 前端 tauri.ts + 测试 + story。

> 工作量较大（5 模块~35 命令）。建议按模块顺序实现，每模块完成即跑该模块测试，最后整体自验。
