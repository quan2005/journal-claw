# M0 验收报告

验收人：Claude（Leader，独立验收）· 2026-06-26

## 结论：PASS

| 验收点                            | 结果 | 证据                                                                                                          |
| --------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| SectionVoice/SectionSpeakers 删除 | ✅   | 两文件 + SectionVoice.test.tsx 已 git D                                                                       |
| tauri.ts 音频命令移除             | ✅   | 16 个音频 invoke 封装清空；残留仅 apple_stt/whisperkit 布尔字段（capabilities 类型，无害）                    |
| tsc 干净                          | ✅   | `npx tsc --noEmit` 0 错误                                                                                     |
| vitest 不回退                     | ✅   | 10 failed/548 passed vs 基线 11/568；无新增失败文件（6 个全是基线子集），并修复了基线 settingsNavigation 失败 |
| identity 未破坏                   | ✅   | create/merge/archive/save identity 命令完好；speaker_id 遗留字段保留（types.ts:86）                           |
| parity 矩阵翻 retired             | ✅   | 19 行 retired（原 0）；音频命令均标 retired                                                                   |
| 越界                              | ✅   | 改动限于 apps/web 设置/音频 + docs + story；未碰 daemon                                                       |

## 备注

- codex 额外跑了 vite build（产 dist/，已 gitignore，不入提交）。
- 提交策略待定：App.tsx 会话前已 dirty（AgentRun 工作）+ 本轮 M0 音频移除混合，且为构建依赖，无法与旧 WIP 切开单独干净提交。
