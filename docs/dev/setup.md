---
title: 环境搭建
description: JournalClaw 开发环境搭建指南，包括依赖安装、开发模式、调试方法。
---

# 环境搭建

## 系统要求

- macOS 12（Monterey）及以上
- macOS 26+ 可获得 Apple SpeechAnalyzer 支持（开发/调试时需要）
- Rust stable（通过 rustup 安装）
- Node.js 18+
- Xcode Command Line Tools（包含 macOS SDK）

## 安装依赖

```bash
# 克隆仓库
git clone https://github.com/quan2005/journal.git
cd journal

# 安装前端依赖
npm install

# Rust 依赖会自动在首次构建时安装
```

## 开发模式

```bash
# 全栈开发（Vite 热重载 + Tauri 热重载）
npm run tauri dev

# 仅前端开发（不启动 Rust 后端，适合 UI 调试）
npm run dev
```

`npm run tauri dev` 会同时启动：
- Vite 开发服务器（前端 HMR）
- Tauri 开发窗口（Rust 后端 + WebView）

修改 Rust 代码后，Tauri 会自动重新编译并重启窗口。

## 运行测试

```bash
# 前端测试（vitest）
npm test

# 前端测试（监听模式）
npm run test:watch

# Rust 单元测试
cd src-tauri && cargo test

# E2E 测试（Playwright）
npm run test:e2e
```

## 代码检查

```bash
# ESLint
npm run lint

# Rust 格式
cd src-tauri && cargo fmt --check

# Rust lint
cd src-tauri && cargo clippy
```

## 调试

### Rust 后端

1. 在 `Cargo.toml` 中设置 `[profile.dev]` 优化级别为 0
2. 使用 `println!` / `dbg!` 宏输出到终端
3. Rust 端日志通过 `env_logger` 输出，可设置 `RUST_LOG=debug` 环境变量

### 前端

1. macOS WebView 调试：`Safari → 开发 → 你的 Mac → WebView 页面`
2. React DevTools 可连接到 Tauri WebView
3. `console.log` 输出到 Safari 检查器

### Tauri 配置

`src-tauri/tauri.conf.json` 控制窗口大小、权限、安全策略等。

## 常见问题

### 首次构建很慢

首次 `cargo build` 需要编译所有 Rust 依赖（包括 tauri、cpal、reqwest 等）。后续增量编译会快很多。

### 麦克风权限

开发模式下，首次调用录音功能需要授权麦克风权限。测试中可以通过 `permissions.rs` 中的模拟逻辑绕过。

### Swift sidecar 编译

声纹识别依赖 Swift sidecar 组件。如果不需要此功能，可以在 `Cargo.toml` 中排除相关 feature。

### 飞书桥接调试

飞书 WebSocket 调试需要真实的飞书开放平台应用凭据。可使用 `RUST_LOG=debug` 查看 WebSocket 通信日志。
