---
status: verified
phase: cleanup
created: 20260627
---

# 下线 directiveMigration + 清 compile_mdx 残留

## 验收（Leader 独立验收）：PASS
- 删 directiveMigration.ts + legacyDirectives.ts + SectionGeneral 入口 + tauri.ts/httpRuntimeClient 映射 + daemon directive_migration/ + daemon mdx/ + server.ts /mdx + /directive 路由 + 测试
- rg 残留为 0；Rust 侧 directive_migration.rs/mdx.rs 留 M8 删
- web tsc clean + 失败 9（基线子集）；daemon tsc clean + 446（-2 删测试，预期）
