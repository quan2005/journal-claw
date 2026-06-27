---
title: 构建与发布
description: JournalClaw 构建配置、DMG 打包和发布流程。
---

# 构建与发布

## 开发构建

```bash
npm run desktop:dev
```

## 生产构建

```bash
npm run desktop:build
```

Electron 打包产物输出到 `apps/desktop/release/`。

## 分包构建

```bash
pnpm --filter @journal/web build
pnpm --filter @journal/daemon build
pnpm --filter @journal/desktop build
```

`apps/desktop/electron-builder.yml` 负责桌面包配置。当前 host 只承载窗口、菜单与 daemon 生命周期；业务状态和文件操作仍由 daemon services 负责。

## 版本管理

版本号遵循 SemVer，由 release-please 自动维护根 package 与 workspace package manifest。不要手动修改版本号。

## CI/CD

GitHub Actions 自动化构建：

- `ci.yml`：web lint/typecheck/test、contracts/daemon/desktop typecheck + vitest。
- `release.yml`：tag push 后构建 web renderer、TS daemon 与 Electron app，并上传 `apps/desktop/release/*.dmg`。

## 发布流程

1. 合并 release-please PR。
2. release-please 创建 tag 与 GitHub Release。
3. `release.yml` 构建 Electron DMG 并上传 Release assets。

## 本地构建验证

```bash
npm run desktop:build
open apps/desktop/release/mac*/JournalClaw.app
du -sh apps/desktop/release/*.dmg
```
