# M7-b 验收报告（Leader 独立验收）：PASS（含一轮打回修复）

## 功能（codex 第一轮完成，正确）
- selectRuntimeClient 默认翻 daemon（'http'，line 86）；JOURNAL_RUNTIME=tauri 作 fallback
- 事件层切 SSE：appEventBus/App.tsx/SessionList 的 Tauri listen → daemon SSE（new EventSource）
- tauri.ts 降 shim：默认走 HttpRuntimeClient；系统命令标 host 层

## 打回修复（第二轮，测试质量）
- 第一轮验收发现 119 测试回归（EventSource is not defined）+ tsc 1 错误 → 打回 codex
- 修复：tests/setup.ts 加 EventSource mock（实质实现：常量+handler+listeners+addEventListener，非 stub）；hostBridge.ts OpenDialogOptions 类型修复
- tsc clean；失败 119→9（全为基线子集：HistoryFloatingButton/IdeasWorkbench/light-theme-unit/SandboxPreview；其余基线项随 MDX 清理删除）

## 结论
功能正确 + 测试回归基线 + tsc clean。Gate A 核心（前端默认走 daemon）达成。
