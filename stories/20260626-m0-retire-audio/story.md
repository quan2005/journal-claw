---
status: verified
phase: M0
owner: Claude (Leader) + codex executor
created: 2026-06-26
---

# M0 · 下线音频 / 语音 / 转写能力

## 背景
Rust 退出路线图（`docs/adr/rust-removal-roadmap.md`）首阶段。用户已决策：音频/语音/转写（Apple Speech、WhisperKit、ffmpeg、speaker profiles）从默认跨平台主干**下线（retire）**，不迁移。清除 `rust-removal-acceptance.md` Gate H「默认 build/test 不得依赖平台专属二进制」一票否决项的前置。

## 目标
移除前端录音/转写/说话人识别能力的用户可触达入口 + 文档下线 + parity 矩阵标 retired。Rust 侧音频代码保留至 M8 删除。

## 范围（边界）
1. 删除 `apps/web/src/settings/components/SectionVoice.tsx`（1304 行）+ `SectionSpeakers.tsx`（509 行）及其在 `SettingsLayout.tsx` 的 import / nav 注册 / 路由 case。
2. 从 `apps/web/src/lib/tauri.ts` 删除音频相关 invoke 封装：`get_transcript`、`retry_transcription`、`prepare_audio_for_ai`、`get/set_asr_config`、`get_apple_stt_variant`、`get_whisperkit_models_dir`、`check_whisperkit_model_downloaded`、`download_whisperkit_model`、`check_whisperkit_cli_installed`、`install_whisperkit_cli`、`get_speaker_profiles`、`update_speaker_name`、`delete_speaker_profile`、`merge_speaker_profiles`、`check_speaker_embedder`。
3. 清理因上述移除而 orphan 的 locale 键（zh/en）与 types（仅在确认无其它引用时删）。
4. **identity 不破坏**：保留 `speaker_id` / `speaker` 为遗留数据字段；`MergeIdentityDialog` 的 voice_only 分支仅读 `speaker_id` 标志、不调音频 API，可保留。不得删除 identity 的创建/合并能力。
5. parity 矩阵 `docs/adr/rust-api-parity.md`：上述命令对应行状态从 `blocked` 翻为 `retired`，备注「M0 下线」。
6. roadmap `docs/adr/rust-removal-roadmap.md`：M0 看板状态翻 ✅；补一句用户可读下线说明。

## 不在范围
- 不删除 Rust 侧音频代码（留 M8）。
- 不动 daemon。
- 不碰除上述外的其它 dirty 文件。

## 验收标准（Given-When-Then）
- Given 设置面板，When 打开，Then 不再有 Voice / Speakers 入口；其余 section 正常。
- Given `apps/web`，When `pnpm --filter @journal/web build`（tsc + vite），Then 通过、无悬空 import / 类型错误。
- Given web 测试，When `npx vitest run`，Then 既有非相关测试不新增失败。
- Given identity 功能，When 创建/合并身份，Then 不受影响（speaker_id 遗留字段保留）。
- Given parity 矩阵，When 检查，Then 音频命令行均为 `retired`。
