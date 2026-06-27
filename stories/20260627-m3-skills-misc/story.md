---
status: verified
phase: M3
created: 2026-06-27
---

# M3 · Skills + MDX + onboarding + 杂项（daemon）

## 背景
M3 迁移低风险模块。Rust：skills.rs、mdx.rs、onboarding.rs、permissions.rs、auto_lint.rs、event_log.rs、directive_migration.rs。

## 范围（读对应 Rust 源对齐）
1. **skills**（skills.rs，排除已迁的 list_workspace_dir）：list_skills / get_skill_content / list_at_mention_candidates(若未迁) / skill 启停（set_skill_enabled / set_global_skill_enabled / get_global_skills_enabled / set_global_skills_enabled）/ skills 目录。注意 skill 启停状态与 M1a 的 .setting.json（disabled_skills/enabled_global_skills）一致，复用 SettingsService，不要另起存储。
2. **mdx**（mdx.rs）：compile_mdx → daemon 纯 TS 编译 MDX→HTML（对齐 Rust 输出结构/字段）。
3. **onboarding**（onboarding.rs）：get_onboarding_status / complete_onboarding / set_onboarding_step / reset_onboarding。
4. **permissions**（permissions.rs）：check_app_permissions / request_permission / open_privacy_settings —— 跨平台 daemon 下 Apple 权限多为 noop/降级；macOS 特有的可标记为 host 层（M7 再定），daemon 返回合理默认。说明处理方式。
5. **auto_lint**（auto_lint.rs）：get_auto_lint_status / trigger_lint_now（运行态，区别于 M1a 的 config）。
6. **event_log**（event_log.rs）：get_events_since。
7. **directive_migration**（directive_migration.rs）：scan_legacy_directive_files / apply_directive_migration。

## 约束
- Gate G：文件格式/路径对齐；skill 启停复用 SettingsService（不重复存储）。
- 前端 tauri.ts 对应封装经 runtime flag。
- 不删 Rust；不碰范围外 dirty；音频不涉及。

## 验收（Given-When-Then）
- skills 列举/读取/启停经 daemon，启停落到 .setting.json（与 M1a 一致）。
- compile_mdx daemon 输出与 Rust 对齐（同一 MDX 输入产出等价 HTML 结构）。
- onboarding 状态读写正确。
- daemon 测试全绿 ≥380 不回退；web tsc clean。
- 越界：仅相关 daemon 模块 + server.ts + 前端 tauri.ts + 测试 + story。
