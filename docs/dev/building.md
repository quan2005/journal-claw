---
title: 构建与发布
description: JournalClaw 构建配置、DMG 打包和发布流程。
---

# 构建与发布

工程与版本规则以 `docs/CONVENTIONS.md` 为唯一权威；本页只说明实际操作入口。

## 开发与生产构建

```bash
bun run desktop:dev
bun run desktop:build
```

Electron 打包产物输出到 `apps/desktop/release/`。分包构建：

```bash
bun run --filter @journal/web build
bun run --filter @journal/daemon build
bun run --filter @journal/desktop build
```

`apps/desktop/electron-builder.yml` 负责桌面包配置。host 只承载窗口、菜单与 daemon 生命周期；业务状态和用户资产操作由 daemon services 负责。

## 版本规则

JournalClaw 保持 `0.x`：修复和兼容功能升 patch，breaking change 升 minor。release-please 锁步维护根与 workspace package version、CHANGELOG、`vX.Y.Z` tag 和 GitHub Release；不要手改版本号。

## CI/CD

- `ci.yml`：PR policy/docs、lint、format、typecheck、Vitest；Windows 额外验证 web/daemon build。
- `release-please.yml`：维护 Release PR；合并后创建 tag/Release，并在同一次 workflow run 调用资产构建。
- `release.yml`：复跑发布门禁、构建 Electron DMG，并用 GitHub CLI 上传到既有 Release；不改 Release notes。

## 发布流程

1. 确认 Release PR 的目标版本和 CHANGELOG，且所有 required checks 通过。
2. 经用户确认后合并 Release PR。
3. release-please 创建 `vX.Y.Z` tag 与 GitHub Release。
4. 同一 workflow run 在该 tag 上复验、构建并上传 DMG。
5. 若资产任务失败，经用户确认后对既有 tag 人工运行 `release.yml`；不得创建替代 tag 掩盖失败。

当前错误基线生成的 1.0 Release PR 不得直接合并；关闭或替换它属于远端操作，需要用户确认。

## 本地构建验证

```bash
bun run desktop:build
open apps/desktop/release/mac*/JournalClaw.app
du -sh apps/desktop/release/*.dmg
```
