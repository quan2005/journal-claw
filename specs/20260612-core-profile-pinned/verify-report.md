---
spec: ./spec.md
date: 2026-06-14
round: 1
result: pass
scope: 'git show HEAD TreeSidebar.tsx / App.tsx(SOUL_ENTRY) / TreeContextMenu.tsx(isCoreIdentity) / types.ts / tauri.ts'
---

# 验收报告 — 核心画像置顶

## AC 核对

| AC                                  | 结论    | 证据                                                                                                                                                                                                                        |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 顶部「核心画像」含 Soul+README | ✅ pass | `TreeSidebar.tsx:666` label="核心画像"；`:437-443` `coreIdentities = identities.filter(i => i.path==='__soul__' \|\| i.filename==='README.md')`。Soul 源 `App.tsx:846-854` SOUL_ENTRY；README 为后端 list_identities 返回。 |
| AC-2 始终置顶不参与字母排序         | ✅ pass | 核心画像 SectionHeader `:659-684` 在普通画像 `identityGroups :693+` 之前；coreIdentities 仅 filter 无 sort。                                                                                                                |
| AC-3 点击走 DetailView              | ✅ pass | `:677` onClick → `handleSelect({type:'identity',path})` 与普通画像 `:717` 一致；App `allIdentities.find` 解析。无 DetailView 改造。                                                                                         |
| AC-4 普通列表不重复 Soul/README     | ✅ pass | identityGroups `:445-446`、archivedIdentities `:472`、sortedIdentities `:481` 三处均过滤 `__soul__` + README。                                                                                                              |

## 范围完整性

顶部固定 ✓ 含 Soul+README ✓ 与普通分开（`:688-696` 分隔线）✓ 选中走 DetailView ✓。

## 非目标越界

- 不改造 DetailView ✓（未触碰）
- 不新增后端命令 ✓（HEAD tauri.ts 无新 invoke）
- ⚠️ `isCoreIdentity?: boolean` UI 状态字段（`TreeContextMenu.tsx:15` + `TreeSidebar handleMore:521`）——非持久化、不进 IdentityEntry、不传后端。唯一作用：`:143` 禁用核心画像归档菜单。spec 未显式要求，但与 identity-archive AC-8「核心画像不可归档」一致，是合理的防误操作保护。

## 冗余与均衡

不重 ✓ 不倚 ✓（四条 AC 完整，无 TODO/stub）。

## 结论：result: pass

四条 AC 全部通过，后端无新命令、DetailView 未改造。

## 待用户裁决（已处置：接受 + 回写 spec）

`isCoreIdentity` UI 字段禁用归档：接受——核心画像是系统级身份，禁用归档是合理防误操作，且与 identity-archive AC-8 一致。回写 spec 非目标补充授权。
