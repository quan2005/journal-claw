---
spec: ./spec.md
date: 2026-06-14
round: 1
result: pass
scope: 'git diff usePinned.ts / types.ts(PinnedItem) / tauri.ts(PinnedItem); git show HEAD TreeSidebar/TreeContextMenu/TopicTree'
---

# 验收报告 — 专题置顶，流水移除置顶

## AC 核对

| AC                                | 结论    | 证据                                                                                                                                                                                                                         |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 专题下 topic 可置顶/取消置顶 | ✅ pass | `TreeContextMenu.tsx` `showPin = itemType === 'topic-file' \|\| 'topic-folder'`；菜单 `label: isPinned ? '取消置顶' : '置顶'`；`handlePin` pinType 映射 → `onPin('topic', path)`。`TreeSidebar.tsx:941` 传 `isPinned` 状态。 |
| AC-1 置顶条目顶部独立区块         | ✅ pass | `TreeSidebar.tsx:782-895` `category==='topics'` 首区块 "Pinned Topics Section"，条件 `pinnedItems.filter(p=>p.type==='topic').length>0`，SectionHeader label="置顶"，在「专题」SectionHeader 之前。                          |
| AC-2 流水下不显示置顶区块         | ✅ pass | `TreeSidebar.tsx:583-617` `category==='journal'` 仅渲染 monthGroups，无 pinnedItems/PinIcon。                                                                                                                                |
| AC-2 流水下无置顶操作入口         | ✅ pass | journal `onMore` → `handleMore('journal',...)`，itemType='journal' 时 `showPin=false`，置顶菜单不进 items。                                                                                                                  |

**PinnedItem.type='topic' 三处一致**：`usePinned.ts:24` / `types.ts:353` / `tauri.ts:696` 均含 `'topic'`。下游 `onPin`/`resolvePinnedEntry`/`handlePin` 类型链路闭环。

## 范围完整性（不少）

持久化复用 `setPinnedItems`；解析 `resolvePinnedEntry` 新增 topic 分支（`TreeSidebar.tsx:498-504`）；文件夹展开 `pinnedExpanded`/`togglePinnedDir`/`listTopicsDir`（`:345-371`）。无遗漏。

## 非目标越界（不多）

范围内 diff 全归属 AC-1。范围外（types.ts `archived`、tauri.ts `archiveIdentity`）属 identity-archive spec，经任务说明豁免。

**命中非目标**：spec 第 19 行「不改变画像分类的置顶行为……此处一并移除即可」——实现移除了 identity 置顶（`showPin` 仅 topic）。符合「一并移除」字面。spec 措辞「保持现状」与「一并移除」矛盾，建议 spec 维护时清理（见裁决）。

## 冗余与均衡

不重 ✓ 不倚 ✓（AC-1/AC-2 完成度对等，无 TODO/stub）。

## 结论：result: pass

六字标准全部通过。

## 待用户裁决（不影响 pass）

spec 第 19 行非目标措辞矛盾（「保持现状：画像可置顶」vs「一并移除即可」）。实现选「移除」。建议回写 spec 删除「保持现状」措辞。
