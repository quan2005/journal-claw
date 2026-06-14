---
spec: ./spec.md
date: 2026-06-14
round: 1
result: fail
scope: "git diff commands/identity.rs / identity.rs / main.rs / App.tsx / tauri.ts / types.ts / DetailView.test.tsx / TreeSidebar.test.tsx; git show HEAD TreeSidebar.tsx / TreeContextMenu.tsx / prompt.rs"
---

# 验收报告 — 画像分组展示与归档

## AC 核对

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 region 分组 + 可折叠 SectionHeader | ✅ pass | `TreeSidebar.tsx:445-466` identityGroups 按 region 分组；`:701-726` 每 region 渲染可折叠 SectionHeader。 |
| AC-2 region 为空归「其他」 | ✅ pass | `:451` `key = id.region \|\| '其他'`；`:462-464` 「其他」排最后。 |
| AC-3 右键「归档」+ frontmatter archived:true | ✅ pass | `TreeContextMenu.tsx:143-160` 普通（非 core）显示「归档」；`identity.rs:239-243` archive_identity → set_archived_flag(true)；format_identity_content:52 写入。单测覆盖。 |
| AC-4 归档分组底部默认折叠 | ✅ pass | `:34` DEFAULT_COLLAPSED_SECTIONS=['identity-archived']；`:728-767` 底部渲染；测试 `:140-148`。 |
| AC-5 右键「取消归档」+ 移除字段 | ✅ pass | `TreeContextMenu.tsx:146-152`；`identity.rs:245-247` unarchive → set_archived_flag(false)；false 时不输出 archived 行。单测 roundtrip。 |
| AC-6 build_system_prompt 跳过 archived | ⚠️ 待裁决 | `prompt.rs:45-48` 只读 identity/README.md，不遍历画像、无显式过滤。但 README 受 AC-8 不可归档，archived 画像结构上不可能进入 prompt。spec 依赖第 76 行自承「prompt.rs 不受影响」。 |
| AC-7 文件位置不变 agent 可读 | ✅ pass | 非目标第 54 行「不移动文件」；set_archived_flag 仅改 frontmatter 不 rename。 |
| AC-8 核心画像不可归档 | ✅ pass | `TreeContextMenu.tsx:143` `!isCoreIdentity` 才显示归档；核心 onMore 传 isCoreIdentity=true；archivedIdentities 也排除 __soul__/README。 |

## 范围完整性
存储 frontmatter ✓ IdentityEntry.archived（后端+前端）✓ 核心画像 ✓ 分割线 ✓ region 默认展开 ✓ 归档默认折叠 ✓ 右键归档/取消 ✓ 写入/移除 ✓。AC-6 对应项见待裁决。

## 非目标越界
- App.tsx `></div>` 格式化（轻微，无功能影响）
- tauri.ts/types.ts 的 PinnedItem.type 'topic' 属 topic-pin spec（建议拆 commit）
- merge_identity 重构用 format_identity_content 保留 archived——必要基础设施 ✓
- 未命中「多级子目录/批量/移动文件/改 identity-profiling skill」

## 冗余与均衡
不重 ✓（单一 set_archived_flag + format_identity_content）。不倚：AC-1~5/7/8 完整，AC-6 见待裁决。

## 结论：result: fail（仅 AC-6 待裁决保守计入）

七项 AC 完整且有测试覆盖。

## 待用户裁决（2 项）

### 1. AC-6 显式过滤逻辑
- 现状：prompt.rs 只读 README.md（核心画像不可归档），archived 画像结构上不可能进入 prompt。
- spec 依赖第 76 行自承「prompt.rs 不受影响」。
- **处置**：接受现状 + 回写 spec AC-6 注明「由 AC-8 + 当前只读 README.md 架构共同保证」。未来若 prompt.rs 扩展为遍历画像，需另起 spec 加显式 guard。

### 2. spec 内部矛盾（子目录 vs frontmatter）
- 第 14 行/依赖第 75 行提「identity/archived/ 子目录」「需扫描子目录」；第 54 行非目标「不移动文件」。
- 实现选 frontmatter 方案（与非目标一致）。
- **处置**：spec 文档问题，修正第 14 行/依赖第 75 行过时表述。
