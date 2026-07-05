# M7-c 验收报告（Leader 独立验收）：PASS

- apps/desktop preload.cts：contextBridge.exposeInMainWorld('electronAPI', {...})，白名单通道 journal:host:\*（reveal/openPath/openExternal/pickFolder/setZoom/onFileDrop），经 ipcRenderer.invoke，**不暴露 ipcRenderer 本身**
- main.ts 接 ipcMain.handle（shell.showItemInFolder/openPath/openExternal/dialog.showOpenDialog）+ BrowserWindow 加 preload + contextIsolation
- hostBridge Electron 分流：window.electronAPI 存在则走它，否则 Tauri，否则 noop
- tauri.ts reveal/open_with_system 经 hostBridge
- 安全性：renderer 侧 rg ipcRenderer = 0（仅 preload 内 invoke）
- desktop tsc clean + 13 测试（+4 hostIpc/preload）；web tsc clean + 失败 9（基线子集）
- M7 全部完成（a 骨架 + b 默认 daemon + c host Electron）
