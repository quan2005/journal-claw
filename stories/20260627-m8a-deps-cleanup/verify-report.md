# M8-a 验收报告（Leader 独立验收）：PASS

- 源码静态 `from '@tauri-apps'` 清零（rg = 0）
- TauriRuntimeClient 类删除；selectRuntimeClient 只返 HttpRuntimeClient
- 组件 Tauri API（convertFileSrc/ask/open/listen/getCurrentWindow）改走 hostBridge（M7-c Electron 分流）
- web tsc clean + 失败 9（基线子集）；desktop tsc clean + 13 测试
- 遗留（非阻塞，Gate A 允许）：4 个测试文件 vi.mock('@tauri-apps')（测试 fixture，防 hostBridge 动态加载真模块；可在 M8-b 一并清）；useConversation.test 守护断言（保留，防回归）
