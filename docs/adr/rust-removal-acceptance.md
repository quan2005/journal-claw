# Rust 后端删除验收记录

日期：2026-06-27

范围：M8-b 删除 `apps/web/src-tauri/`、移除 Tauri npm 依赖、清理死 mock、同步 Electron/daemon 文档与 release/rollback 资料。

## 总结

| Gate | 结论 | 证据 |
|---|---|---|
| A Host 与 Runtime | PASS | `apps/desktop` 是默认桌面宿主；root package 删除 Tauri script；`apps/web/src/lib/runtimeClient.ts` 固定 HTTP runtime；活跃源码无 `@tauri-apps` import |
| B API Parity | PASS | `docs/adr/rust-api-parity.md` 记录 `blocked = 0`；旧 134 command 归为 replaced/retired |
| C Agent Run 主路径 | PASS | daemon `runs/`, `engine/`, `conversation/` services 与 tests 通过；`cd apps/daemon && npx vitest run` 72 files / 446 tests passed |
| D 三家 CLI adapter | PASS | daemon claude/codex/opencode defs 与 stream parser tests 通过 |
| E ChangeSet 与恢复 | PASS | daemon changeset service/authorization tests 通过 |
| F 自动沉淀 | PASS | daemon sediment service tests 通过 |
| G 数据与文件迁移 | PASS | M8-b 不迁移 workspace 数据；builtin skills 从旧资源路径搬到 `apps/web/resources/workspace-template/.claude/skills`（63 files） |
| H 测试矩阵 | PASS with known baseline | daemon vitest pass；web tsc pass；web vitest 保留既有 9 failed baseline；desktop tsc pass；daemon tsc pass |
| I 真实任务验收 | PASS by prior M1-M7 evidence | 本次是删除收尾；M8-b 无新增用户工作流，依赖 M1-M7 已验收能力与本次 smoke/test |
| J 回滚与发布 | PASS | `docs/adr/rust-removal-rollback.md` 与 `docs/adr/rust-removal-release-note.md` 已新增；release workflow 改为 Electron |

## 删除与依赖检查

- `apps/web/src-tauri/` 已从工作区删除。
- 删除前/由 Git 记录的 tracked 文件：214。
- tracked Rust 文件：86。
- 删除前目录体积：约 37G（含 build target）。
- `package.json` / `apps/web/package.json` 中无 `@tauri-apps/*` 或 `tauri-plugin-clipboard-api` 依赖。
- 未运行 `pnpm install`，因此 `pnpm-lock.yaml` 仍保留旧依赖条目，按 M8-b 指令交由后续 install 更新。

## 命令结果

```text
cd apps/daemon && npx vitest run
PASS: 72 test files, 446 tests

cd apps/web && npx tsc --noEmit
PASS: 0 errors

cd apps/web && npx vitest run
KNOWN BASELINE: 46 test files, 329 tests, 9 failed
Failed files:
- src/tests/HistoryFloatingButton.test.tsx
- src/tests/IdeasWorkbench.test.tsx
- src/tests/SandboxPreview.test.ts
- src/tests/light-theme-unit.test.ts

cd apps/desktop && npx tsc --noEmit
PASS: 0 errors

cd apps/daemon && npx tsc --noEmit
PASS: 0 errors
```

## 引用扫描

活跃源码、package、workflow、AGENTS、README、dev docs、guide docs 扫描：

```text
rg "src-tauri|@tauri-apps|tauri::|#[tauri::command]|invoke_handler" \
  README.md README.cn.md release-please-config.json \
  apps/web apps/daemon apps/desktop .github docs/dev docs/ARCH.md docs/guide \
  AGENTS.md package.json apps/web/package.json

Only remaining active hit:
apps/web/src/hooks/useConversation.test.ts guard assertion:
does not import @tauri-apps/api/event
```

全仓扫描仍会命中：

- `pnpm-lock.yaml`：按要求未更新 lockfile。
- `stories/`, `specs/`, `docs/superpowers/`, `repomix-output.xml`：历史/迁移/快照资料。
- `docs/adr/rust-removal-*`：本次迁移与回滚文档。

## 备注

`opencode run` 独立代理按 AGENTS 约定已尝试派发；当前沙箱下首次因日志目录权限失败，重试后一个实例因临时 DB 锁失败，另一个长时间无返回后中止。最终验收以本地命令和项目门禁记录为准。
