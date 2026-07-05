# M3 验收报告（Leader 独立验收）：PASS

- daemon 392 passed/65 files（基线 380，+12，零回退）；web tsc clean
- 7 模块：skills/mdx/onboarding/permissions/auto_lint/event_log/directive_migration
- skill 启停复用 M1a SettingsService（disabled_skills/enabled_global_skills），未另起存储 ✓
- onboarding 状态存 config（onboarding_completed/last_step，Rust 同款，纯增）
- mdx：纯 TS compileMdx + validateMdxDocument
- 越界：config 增 onboarding 字段（内聚）；其余均 M3 模块 + server.ts + 前端 + 测试
- 待办（cutover 项）：MDX 输出与 Rust 真实渲染等价性，切换前需真渲染链验证
