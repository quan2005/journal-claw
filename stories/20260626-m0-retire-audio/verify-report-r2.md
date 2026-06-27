---
story: ./story.md
design: N/A
date: 2026-06-26
round: 2
result: pass
scope: "限定核对用户列出的 M0 文件；不核对范围外 dirty 文件，除非能证明由 M0 引入"
evidence_files:
  - apps/web/src/settings/SettingsLayout.tsx
  - apps/web/src/settings/navigation.ts
  - apps/web/src/settings/components/SectionVoice.tsx
  - apps/web/src/settings/components/SectionSpeakers.tsx
  - apps/web/src/lib/tauri.ts
  - apps/web/src/App.tsx
  - apps/web/src/types.ts
  - apps/web/src/locales/zh.ts
  - apps/web/src/locales/en.ts
  - apps/web/src/tests/SettingsLayout.test.tsx
  - apps/web/src/tests/settingsNavigation.test.ts
  - apps/web/src/tests/tauri.test.ts
  - apps/web/src/tests/ipc-contract.test.ts
  - apps/web/src/tests/App.test.tsx
  - apps/web/src/tests/SectionVoice.test.tsx
  - docs/adr/rust-api-parity.md
  - docs/adr/rust-removal-roadmap.md
---

# 验收报告 - M0 下线音频 / 语音 / 转写能力

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| 设置面板不再有 Voice / Speakers 入口，其余 section 正常 | pass | `apps/web/src/settings/navigation.ts:1` 的 `NavId` 仅包含 `general/ai/permissions/automation/about`；`apps/web/src/settings/SettingsLayout.tsx:47` 的路由 case 仅渲染 General / AI / Permissions / Automation / About；`apps/web/src/settings/SettingsLayout.tsx:69` 的 nav items 不含 Voice/Speakers；`test ! -e apps/web/src/settings/components/SectionVoice.tsx` 与 `test ! -e apps/web/src/settings/components/SectionSpeakers.tsx` 均成立。 |
| `apps/web` typecheck 通过，无悬空 import / 类型错误 | pass | 已在 `apps/web` 执行 `npx tsc --noEmit`，退出码 0。`apps/web/src/App.tsx:38` 的 Tauri import 已不含 `importAudioFile/getAsrConfig/checkWhisperkit*/prepareAudioForAi`；`apps/web/src/lib/tauri.ts:1` 类型 import 已不含 `Transcript/SpeakerProfile`。 |
| web 测试不新增失败 | pass | 已在 `apps/web` 执行 `npx vitest run`，结果为 `Test Files 6 failed | 61 passed (67)`、`Tests 10 failed | 548 passed (558)`，退出码 1；低于用户给定基线 `11 failed / 568 passed`，按本轮口径通过。失败文件为既有无关范围：`JournalMdxExamples.test.ts`、`journalBlockStyles.test.ts`、`light-theme-unit.test.ts`、`HistoryFloatingButton.test.tsx`、`SandboxPreview.test.ts`、`IdeasWorkbench.test.tsx`。 |
| identity 创建/合并不受影响，speaker 遗留字段保留 | pass | `apps/web/src/types.ts:86` 保留 `speaker_id`，`apps/web/src/types.ts:91` 保留 `MergeMode = 'voice_only' | 'full'`；`apps/web/src/lib/tauri.ts:277` 的 `createIdentity` 仍接收 `speakerId` 并调用 `create_identity`；`apps/web/src/lib/tauri.ts:285` 的 `mergeIdentity` 仍调用 `merge_identity`；`apps/web/src/components/MergeIdentityDialog.tsx:17` 仍按 `source.speaker_id` 默认 `voice_only`，`apps/web/src/components/MergeIdentityDialog.tsx:159` 仅在有 `speaker_id` 时显示 voice-only 分支，且未调用音频 API。 |
| parity 矩阵中音频/ASR/speaker/transcription 命令为 retired | pass | `docs/adr/rust-api-parity.md:56`、`:84-85`、`:95-100`、`:222-226`、`:255-256` 均将指定命令标为 `retired`，并在 TS daemon route/service 列写明 `M0 下线`；`docs/adr/rust-api-parity.md:22-24` 将 retired 计数调整为 16、blocked 为 117。 |

## 范围完整性（不少，对照 story.md 范围）

| 范围项 | 结论 | 证据 |
|---|---|---|
| 删除 Voice/Speakers 组件及设置入口 | pass | `SectionVoice.tsx`、`SectionSpeakers.tsx` 文件不存在；`apps/web/src/settings/SettingsLayout.tsx:11-15` 仅 import 仍保留的五个 section；`apps/web/src/settings/navigation.ts:3-9` 的 `ALL_NAV_IDS` 不含 voice/speakers。 |
| 删除指定音频 invoke wrapper | pass | `rg -n "getTranscript|retryTranscription|prepareAudioForAi|getAsrConfig|setAsrConfig|getAppleSttVariant|getWhisperkitModelsDir|checkWhisperkitModelDownloaded|downloadWhisperkitModel|checkWhisperkitCliInstalled|installWhisperkitCli|getSpeakerProfiles|updateSpeakerName|deleteSpeakerProfile|mergeSpeakerProfiles|checkSpeakerEmbedder" apps/web/src` 无结果；`apps/web/src/tests/App.test.tsx:83-89` 的 mock 已删除 ASR/WhisperKit/prepareAudioForAi，仅保留通用 import/mock。 |
| App 中移除 ASR readiness、prepareAudioForAi、audio import 特判 | pass | `apps/web/src/App.tsx:230-241` 只检查 AI engine，不再检查 ASR readiness；`apps/web/src/App.tsx:581-607` 文件提交统一走 `importFile`，音频扩展名只从 `enqueueWork` 中排除，不触发转写/模型下载/说话人识别；`apps/web/src/App.tsx:866-875` 非 work-queue retry 仅 dismiss，不再 retry local audio pipeline。 |
| orphan locale/types 清理，需保留项未误删 | pass | `apps/web/src/types.ts:1-91` 已无 `Transcript/TranscriptSegment/TranscriptionProgress/SpeakerProfile`；`rg -n "audioRejected|voiceNotReady" apps/web/src/locales apps/web/src/types.ts` 无结果；`apps/web/src/locales/zh.ts:156-157` 与 `apps/web/src/locales/en.ts:141-142` 保留 `voiceOnly/voiceOnlyDesc`，符合 MergeIdentityDialog 仍引用的要求。 |
| ADR 更新 | pass | `docs/adr/rust-api-parity.md:56` 等 retired 行含 `M0 下线`；`docs/adr/rust-removal-roadmap.md:44` 有用户可见变化说明；`docs/adr/rust-removal-roadmap.md:140` 将 M0 状态标为 `✅`。 |
| settingsNavigation 测试反映新导航 | pass | `apps/web/src/tests/settingsNavigation.test.ts:5-10` 的 section tops 仅包含 `general/ai/permissions/automation/about`；`apps/web/src/tests/settingsNavigation.test.ts:17`、`:21` 断言 `permissions/automation`，不保留 Voice/Speakers 死入口。 |

## 方案落实（不偏，对照 design.md）

N/A。本任务无 `design.md`，仅按 `story.md` 核对。

## 越界检查（不多，对照 story 非目标）

- pass：Rust 侧 `apps/web/src-tauri` 未在本轮改动中出现。证据：`git diff --name-only -- apps/web/src-tauri` 输出为空。
- pass：`apps/daemon` 当前工作区存在 dirty 文件，但用户明确要求不把范围外 dirty 作为本 story 失败；限定 M0 文件列表与 `git diff --name-only` 的 M0 核对结果不含 `apps/daemon`。单独执行 `git diff --name-only -- apps/daemon` 可见 dirty 文件存在，但均在本 story 核对范围外。
- pass：`apps/web/src/lib/tauri.ts:113` 仍保留 `importAudioFile` 作为 `import_file` 的别名，`apps/web/src/tests/ipc-contract.test.ts:193` 仍覆盖该别名；该项不是 story 明列需 retired 的 command，且 App 的音频导入特判已移除，因此不计为越界或未清理失败。
- pass：`apps/web/src/App.tsx` diff 中存在侧栏 toggle / lucide icon 等范围外改动，但用户本轮只要求核对 App 内与音频/ASR/prepareAudioForAi/import audio 特判相关 hunks；未将这些既有 unrelated hunks 计入本 story 失败。

## 冗余（不重，对照 story.md）

pass。未发现同一 AC 存在两套并行实现。设置入口移除集中在 `navigation.ts` 与 `SettingsLayout.tsx`；指定 retired command wrapper 在 `lib/tauri.ts` 清除，测试侧同步删除对应 mock/contract；ADR 仅在 parity 与 roadmap 两处维护契约状态。

## 结论

result: pass。

六字标准结论：不漏、不重、不偏、不倚、不多、不少均通过。实现与 `stories/20260626-m0-retire-audio/story.md` 的 M0 范围一致；在用户给定的测试基线下，typecheck 通过，vitest 未新增失败。

## 待用户裁决

无。
