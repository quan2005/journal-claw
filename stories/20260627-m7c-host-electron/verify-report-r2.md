---
story: ./story.md
design: N/A
date: 2026-06-27
round: 2
result: pass
scope: 'git diff -- apps/desktop/src apps/desktop/tests apps/web/src/lib/hostBridge.ts apps/web/src/lib/tauri.ts apps/web/src/tests/hostBridge.test.ts stories/20260627-m7c-host-electron/verify-report.md；同时用 git status --short 纳入同范围 untracked 新文件；重点复核第 1 轮 fail 项'
---

# 验收报告 — M7-c · host 层命令接 Electron（reveal/open/dialog/zoom/file-drop）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                                                                                                         | 结论 | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| AC-1 Given Electron 宿主，When reveal_in_file_manager(path)，Then 调 shell.showItemInFolder（测试 mock）。 | pass | `apps/web/src/lib/tauri.ts:28`-`29` 将 `revealInFileManager` 转到 `hostRevealInFileManager`；`apps/web/src/lib/hostBridge.ts:185`-`189` Electron 下调用 `electron.reveal(path)`；`apps/desktop/src/preload.cts:45`-`46` 暴露固定 `reveal` IPC；`apps/desktop/src/hostIpc.ts:24`-`25` 调 `shell.showItemInFolder`；`apps/desktop/tests/hostIpc.test.ts:54`-`55` mock 断言 showItemInFolder。                                                                   |
| AC-2 Given Electron，When pickFolder，Then 调 dialog.open。                                                | pass | `apps/web/src/lib/hostBridge.ts:175`-`177` Electron 下调用 `electron.pickFolder()`；`apps/desktop/src/preload.cts:49` 暴露固定 `pickFolder` IPC；`apps/desktop/src/hostIpc.ts:37`-`44` 调 `dialog.showOpenDialog` 并返回首个路径或 null；`apps/desktop/tests/hostIpc.test.ts:67`-`71` 断言 dialog 被调用并返回 `/picked`。                                                                                                                                    |
| AC-3 Given web（无 host），Then noop/默认，不崩。                                                          | pass | `apps/web/src/lib/hostBridge.ts:44`-`47` 无 `window.electronAPI` 返回 null；`apps/web/src/lib/hostBridge.ts:64`-`65` 非 Tauri 返回 null；`apps/web/src/lib/hostBridge.ts:175`-`181` pickFolder 默认 null，`apps/web/src/lib/hostBridge.ts:185`-`194` reveal 无 host 直接返回，`apps/web/src/lib/hostBridge.ts:198`-`211` open 无 host 直接返回；`apps/web/src/tests/hostBridge.test.ts:67`-`76` 覆盖 no-host 不抛错和默认值。                                 |
| AC-4 preload 仅暴露白名单 API（rg ipcRenderer on renderer 侧 = 0）。                                       | pass | `apps/desktop/src/preload.cts:45`-`59` 只 expose `electronAPI` 的 reveal/openPath/openExternal/pickFolder/setZoom/onFileDrop；`apps/desktop/tests/preload.test.ts:57`-`70` 断言 keys 且无 `api.ipcRenderer/window.ipcRenderer`；命令 `rg -n "ipcRenderer" apps/web/src` 退出 1 且无输出，renderer 侧命中数为 0。                                                                                                                                              |
| AC-5 desktop tsc + web tsc clean；测试不回退。                                                             | pass | `pnpm --filter @journal/desktop typecheck` 退出 0，输出 `tsc --noEmit`；`pnpm --filter @journal/web typecheck` 退出 0，输出 `tsc --noEmit`；`pnpm --filter @journal/desktop test` 退出 0，输出 `Test Files 3 passed (3), Tests 13 passed (13)`；`pnpm --filter @journal/web exec vitest run src/tests/hostBridge.test.ts` 退出 0，输出 `Test Files 1 passed (1), Tests 3 passed (3)`；`pnpm --filter @journal/web test` 仍退出 1，但输出 `Test Files 4 failed | 45 passed (49), Tests 9 failed | 335 passed (344)`，失败数等于用户给定 web 基线 9，未新增失败。 |

## 上一轮 fail 项复核

- pass：第 1 轮 AC-4 fail 是 renderer 侧 `ipcRenderer` 字面命中（`stories/20260627-m7c-host-electron/verify-report.md:19`）；本轮命令 `rg -n "ipcRenderer" apps/web/src` 退出 1 且无输出，已修复。
- pass：第 1 轮指出 `open_settings / open_privacy_settings` 仍依赖 Tauri invoke（`stories/20260627-m7c-host-electron/verify-report.md:27`）；本轮 `apps/web/src/lib/tauri.ts:31` 转到 `hostOpenSettings()`，`apps/web/src/lib/tauri.ts:302`-`303` 转到 `hostOpenPrivacySettings(pane)`，非 Tauri 下 `apps/web/src/lib/hostBridge.ts:103`-`119` 派发本地 `open-settings` 事件，`apps/web/src/App.tsx:451`-`454` 监听后打开 settings view。
- pass：第 1 轮完整 web 测试为 `Tests 9 failed | 334 passed (343)`（`stories/20260627-m7c-host-electron/verify-report.md:20`）；本轮完整 web 测试为 `Tests 9 failed | 335 passed (344)`，按用户指定的 9 failed 基线未新增失败。

## 范围完整性（不少，对照 story.md 范围）

- pass：`apps/desktop` 的 preload 和 IPC handler 已补。`apps/desktop/src/main.ts:77`-`83` 配置 `preload.cjs`、contextIsolation、nodeIntegration false、sandbox true；`apps/desktop/src/main.ts:110`-`112` 注册 host IPC；`apps/desktop/src/preload.cts:45`-`59` 暴露白名单 API；`apps/desktop/src/hostIpc.ts:23`-`49` 实现 shell/dialog/zoom handlers。
- pass：`apps/web/src/lib/hostBridge.ts` 已补 Electron 分流。`apps/web/src/lib/hostBridge.ts:29`-`35` 定义 Electron API；`apps/web/src/lib/hostBridge.ts:123`-`133` 处理 zoom；`apps/web/src/lib/hostBridge.ts:140`-`168` 处理 file-drop；`apps/web/src/lib/hostBridge.ts:175`-`211` 处理 folder/reveal/open。
- pass：`apps/web/src/lib/tauri.ts` 的 reveal/open_with_system/folder picker 已走 hostBridge。`apps/web/src/lib/tauri.ts:28`-`31` 覆盖 reveal/settings，`apps/web/src/lib/tauri.ts:146`-`148` 覆盖 open file/url，`apps/web/src/lib/tauri.ts:162`-`163` 覆盖 folder picker。
- pass：`open_settings / open_privacy_settings` Electron/web 下打开设置 UI 而不是系统操作。`apps/web/src/lib/hostBridge.ts:103`-`119` 非 Tauri 下派发 `open-settings` 本地事件；`apps/web/src/App.tsx:451`-`454` 监听后 `setView('settings')`；`apps/web/src/tests/hostBridge.test.ts:79`-`88` 覆盖 settings 命令的本地事件路由。
- pass：测试范围已补。`apps/web/src/tests/hostBridge.test.ts:41`-`65` 覆盖 Electron shell/dialog/zoom/file-drop 路由；`apps/web/src/tests/hostBridge.test.ts:67`-`76` 覆盖 web no-host；`apps/desktop/tests/preload.test.ts:57`-`90` 覆盖 preload 白名单和固定 IPC；`apps/desktop/tests/hostIpc.test.ts:42`-`72` 覆盖主进程 IPC handler。

## 方案落实（不偏，对照 design.md）

N/A。本任务无 design.md。

## 越界检查（不多，对照 story 非目标 + design 范围）

- pass：未发现无法归属的功能性改动。`git diff --name-only -- apps/desktop/src apps/desktop/tests apps/web/src/lib/hostBridge.ts apps/web/src/lib/tauri.ts apps/web/src/tests/hostBridge.test.ts stories/20260627-m7c-host-electron/verify-report.md` 输出已跟踪改动为 `apps/desktop/src/main.ts`、`apps/web/src/lib/hostBridge.ts`、`apps/web/src/lib/tauri.ts`；`git status --short -- apps/desktop/src apps/desktop/tests apps/web/src/lib/hostBridge.ts apps/web/src/lib/tauri.ts apps/web/src/tests/hostBridge.test.ts stories/20260627-m7c-host-electron/verify-report.md stories/20260627-m7c-host-electron/verify-report-r2.md` 显示未跟踪新增为 `apps/desktop/src/hostIpc.ts`、`apps/desktop/src/preload.cts`、`apps/desktop/tests/hostIpc.test.ts`、`apps/desktop/tests/preload.test.ts`、`apps/web/src/tests/hostBridge.test.ts`、`stories/20260627-m7c-host-electron/verify-report.md`，均可归属到 story 范围或上一轮报告留痕。
- pass：未命中明确约束禁区。`git status --short -- src-tauri` 无输出，符合“不删 src-tauri”；`apps/web/src/lib/hostBridge.ts:64`-`71` 保留 Tauri loadTauri fallback；`apps/web/src/tests/ipc-contract.test.ts:95`-`105` 和 `apps/web/src/tests/ipc-contract.test.ts:364`-`368` 仍覆盖 Tauri 下 openSettings/openPrivacySettings invoke。

## 冗余（不重，对照 story.md）

- pass：未发现同一 AC 的多套并行实现。Electron 与 Tauri 通过 hostBridge 单一路由分流：`apps/web/src/lib/hostBridge.ts:123`-`133` zoom，`apps/web/src/lib/hostBridge.ts:175`-`181` pickFolder，`apps/web/src/lib/hostBridge.ts:185`-`194` reveal，`apps/web/src/lib/hostBridge.ts:198`-`211` openWithSystem 均为 Electron 优先、否则 Tauri/noop。

## 结论

result: pass。

第 1 轮 fail 项均已修复；六字标准均通过。完整 web 测试仍有既有 9 个失败，但本轮按用户指定基线判断未新增失败。

## 待用户裁决

无。
