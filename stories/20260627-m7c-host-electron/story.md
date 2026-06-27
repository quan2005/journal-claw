---
status: verified
phase: M7-c
created: 2026-06-27
---

# M7-c · host 层命令接 Electron（reveal/open/dialog/zoom/file-drop）

## 背景
M7-b 建 hostBridge.ts（loadTauri 抽象，Tauri 不可用返 null）。但在 Electron 宿主下这些 host 能力全退化 noop。M7-c 给 hostBridge 补 Electron 实现，使前端在 Electron 下 reveal_in_file_manager/open_with_system/folder picker/zoom/file-drop 等可用。

## 目标
1. hostBridge 检测运行环境（Tauri / Electron / web），分流：
   - Tauri：现有 loadTauri 路径。
   - Electron：经 Electron 提供的桥（preload IPC 或 window.electronAPI）调 shell.showItemInFolder / shell.openExternal / shell.openPath / dialog。
   - web：noop/默认。
2. 补 Electron preload（apps/desktop）暴露安全 IPC：reveal(path)、openPath(path)、openExternal(url)、pickFolder()、setZoom、onFileDrop；main 进程实现（shell/dialog）。
3. 前端 hostBridge 调用点（tauri.ts 的 reveal_in_file_manager/open_with_system、hostBridge 的 pickHostFolder/setHostZoom/onHostFileDrop）走 Electron 桥。
4. open_settings / open_privacy_settings：Electron 下打开设置 UI（菜单项或路由），非系统操作。

## 范围
- apps/desktop：补 preload.ts（contextBridge 暴露安全 API）+ main 接 IPC handler（shell/dialog）。
- apps/web/src/lib/hostBridge.ts：补 Electron 分流（window.electronAPI）。
- apps/web/src/lib/tauri.ts：reveal/open_with_system 走 hostBridge。
- 测试：hostBridge Electron 分流测试（mock window.electronAPI）；preload 安全性（不暴露任意 IPC）。

## 约束
- Electron preload 只经 contextBridge 暴露白名单 API（安全，不暴露 ipcRenderer）。
- 不删 src-tauri；Tauri 路径保留 fallback。
- 只动 apps/desktop + apps/web hostBridge/tauri.ts。

## 验收（Given-When-Then）
- Given Electron 宿主，When reveal_in_file_manager(path)，Then 调 shell.showItemInFolder（测试 mock）。
- Given Electron，When pickFolder，Then 调 dialog.open。
- Given web（无 host），Then noop/默认，不崩。
- preload 仅暴露白名单 API（rg ipcRenderer on renderer 侧 = 0）。
- desktop tsc + web tsc clean；测试不回退。
