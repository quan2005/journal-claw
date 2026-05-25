---
title: 构建与发布
description: JournalClaw 构建配置、代码签名、DMG 打包和发布流程。
---

# 构建与发布

## 开发构建

```bash
npm run tauri dev
```

启动开发模式，包含热重载。前端修改即时生效，Rust 修改自动重新编译。

## 生产构建

```bash
npm run tauri build
```

生成产物在 `src-tauri/target/release/bundle/`：

```
bundle/
├── dmg/              # DMG 安装包（分发用）
│   └── JournalClaw_x.x.x_x64.dmg
├── macos/            # .app 包
│   └── JournalClaw.app
└── osx-universal/    # 通用二进制（x86_64 + aarch64）
```

## 构建配置

`src-tauri/tauri.conf.json` 关键配置项：

| 配置 | 说明 |
|---|---|
| `productName` | 应用名称 |
| `version` | 版本号（同步自 package.json） |
| `identifier` | Bundle identifier |
| `bundle.icon` | 应用图标路径 |
| `bundle.resources` | 打包的额外资源 |
| `security.csp` | Content Security Policy |

## 代码签名

macOS 分发需要代码签名：

1. 获取 Apple Developer 证书
2. 在 `tauri.conf.json` 中配置签名参数
3. 使用 `npm run tauri build -- --sign` 签名构建

未签名的 DMG 在首次打开时会提示"无法验证开发者"，用户需手动授权。

## 图标生成

```bash
npm run generate-icons
```

使用 `scripts/generate-icons.mjs` 从源图标生成所有所需尺寸。

## 版本管理

版本号遵循 SemVer，在三个位置同步：

- `package.json` — `version` 字段
- `src-tauri/Cargo.toml` — `version` 字段
- `src-tauri/tauri.conf.json` — `version` 字段

发布中使用 `release-please` 自动管理版本号和 CHANGELOG：

```bash
# release-please 会：
# 1. 根据 conventional commits 决定版本号递增
# 2. 更新上述三个文件的 version
# 3. 生成 CHANGELOG.md 条目
# 4. 创建 Release PR
```

## CI/CD

GitHub Actions（`.github/workflows/`）自动化构建：

- **PR 检查** — lint + test + build
- **发布构建** — 在 tag push 时触发，构建 DMG 并附加到 Release

## 发布流程

1. 合并 release-please PR（版本号 + CHANGELOG 更新）
2. release-please 自动创建 GitHub Release
3. CI 构建 DMG 并上传到 Release assets
4. 用户在 [Releases](https://github.com/quan2005/journal/releases) 下载

## 本地构建验证

```bash
# 构建 + 打开
npm run tauri build
open src-tauri/target/release/bundle/macos/JournalClaw.app

# 检查包大小
du -sh src-tauri/target/release/bundle/dmg/*.dmg
```
