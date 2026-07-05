# Rust removal rollback

日期：2026-06-27

适用范围：M8-b 删除 Rust/Tauri 后端后的短期回滚。长期主干不再维护双后端。

## 快速回滚步骤

1. 恢复删除的 Rust/Tauri 目录：

   ```bash
   git checkout HEAD~1 -- apps/web/src-tauri
   ```

   如果已经合并多次提交，改用最后一个 Rust-backed tag 或 commit：

   ```bash
   git checkout <last-rust-backed-ref> -- apps/web/src-tauri
   ```

2. 恢复 Tauri npm 依赖和脚本：

   - `apps/web/package.json`
     - `@tauri-apps/api`
     - `@tauri-apps/cli`
     - `@tauri-apps/plugin-dialog`
     - `@tauri-apps/plugin-opener`
     - 如需旧剪贴板文件粘贴能力，恢复 `tauri-plugin-clipboard-api`
     - 恢复 `tauri` script
   - root `package.json`
     - 恢复 `tauri` script

3. 重新安装依赖：

   ```bash
   pnpm install
   ```

4. 切回 Tauri runtime：

   - 恢复 M8-a 前的 `@tauri-apps/*` imports 或 runtime fallback。
   - 恢复四个测试里的旧 Tauri mock（仅用于旧 runtime 测试）。
   - 恢复 CI 中 Rust job 与 release 中 Tauri build 路径。

5. 验证旧 runtime：

   ```bash
   pnpm --filter @journal/web typecheck
   pnpm --filter @journal/web test
   cargo test --manifest-path apps/web/src-tauri/Cargo.toml
   pnpm --filter @journal/web tauri build
   ```

## 数据回滚

M8-b 不执行 workspace 数据迁移。回滚不会改变用户已有 Markdown、topics、todos、identity、conversation、automation 数据。

如果用户已使用 M8-b 后的新 daemon 写入 run events、ChangeSet、artifact index 或 memory/rule 记录，这些文件应保留为普通 workspace 文件；旧 Rust-backed release 可能不会读取全部新元数据，但不应删除它们。

## 发布回滚

若 M8-b release 已发布并发现阻断问题：

1. 暂停最新 release。
2. 重新发布最后一个 Rust-backed build 作为 fallback release。
3. 在 release note 中说明 Electron/daemon 版本回滚原因和受影响能力。
4. 在修复分支恢复 M8-b 删除前状态，复跑 Gate A–J 后再重新发布。
