# M7-a 验收报告（Leader 独立验收）：PASS

- apps/desktop Electron 骨架：main.ts（whenReady→拉 daemon+健康检查→窗口+菜单，before-quit 回收）+ daemon.ts（spawn/waitForHealth/stopChild SIGTERM→SIGKILL）+ menu.ts（标准菜单）
- Gate A 零业务语义：rg 业务模块名在 apps/desktop/src 命中 0（仅 electron/node/本地 import）
- daemon 生命周期：spawn 同进程组、健康检查轮询 /health（30×500ms+AbortSignal）、before-quit SIGTERM→SIGKILL 回收 + will-quit 兜底
- 依赖：electron@33.2.1 + electron-builder 等（Leader 联网装，lockfile 更新）；codex 离线用 stub 验证，诚实上报未伪造
- menu.ts 类型修复：内联 {role/type} 加 as const（codex 离线 stub 未抓到，真 electron 类型更严，Leader 修）
- desktop tsc clean；9/9 单元测试（stopChild/healthcheck/spawn）；daemon 448（基线 452，-4 为 MDX 清理删 mdx 测试，预期）
- 待 M7-b/c：前端停 import @tauri-apps、tauri.ts 降 shim；真实窗口 e2e 验证
