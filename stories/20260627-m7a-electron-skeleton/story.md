---
status: verified
phase: M7-a
created: 2026-06-27
---

# M7-a · Electron host 骨架（去 Tauri 第一步）

## 背景
M7 目标：桌面宿主从 Tauri 迁到 Electron，最终删 Rust。M7-a 先建 Electron 骨架，只管窗口/菜单/daemon 生命周期，不承载业务语义。Gate A 前置。

## 范围
1. 新建 apps/desktop（Electron）：main 进程 = 创建 BrowserWindow 加载 apps/web 前端（dev 时 localhost:1420，prod 时打包产物）；管理 daemon 子进程生命周期（启动/健康检查/退出回收）；基础菜单。
2. package.json scripts：dev 启动 electron + vite + daemon；build 打包。
3. 不改 apps/web（前端仍可独立跑）；不改 daemon；不动 tauri.conf（Tauri 路径保留，M7-b/c 再切）。
4. Electron 仅窗口/菜单/daemon lifecycle，**零业务语义**（ADR §2/Gate A）。

## 约束
- 纯新建 apps/desktop/；不改其它包（除非加 workspace 引用）。
- Electron 主进程不 import 任何业务模块。
- 锁版本（electron 等）。

## 验收（Given-When-Then）
- apps/desktop 可启动：打开窗口加载前端 + 自动拉起 daemon + 健康检查通过。
- daemon 子进程在 electron 退出时被回收。
- electron 不含任何 journal 业务逻辑（rg 业务模块名 = 0）。
- 独立可构建（tsc/electron-builder 或等效）。
