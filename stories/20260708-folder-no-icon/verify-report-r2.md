result: pass

# STORY-20260708-folder-no-icon R2 验收报告

验收基准：
- `stories/20260708-folder-no-icon/story.md` AC-1、AC-2 与三类 Won't。

## AC-1 — 文件夹行无图标

结论：pass

证据：
- `TopicTree` 只为文件行计算 `FileTypeIcon` kind；文件夹行不需要 folder/folder-open kind：`apps/web/src/components/TopicTree.tsx:71-80`。
- 行渲染中，chevron 后的图标位置为 `{isDir ? null : <FileTypeIcon kind={iconKind!} selected={isSelected} />}`，文件夹分支完全不渲染图标：`apps/web/src/components/TopicTree.tsx:191-195`。
- 文件行仍保留类型图标：同一条件表达式的非文件夹分支渲染 `<FileTypeIcon ...>`：`apps/web/src/components/TopicTree.tsx:195`。
- 测试覆盖文件夹无 `文件夹` aria-label、文件类型图标仍存在：`apps/web/src/tests/TopicTree.test.tsx:39-76`；覆盖展开/折叠文件夹均无 folder icon：`apps/web/src/tests/TopicTree.test.tsx:169-176`。

## AC-2 — 展开/收起与对齐不受影响

结论：pass

证据：
- 文件夹行 DOM 结构为：chevron span（宽 10）→ 无图标占位 → 名称。chevron 见 `apps/web/src/components/TopicTree.tsx:161-187`；图标位置对 folder 返回 `null`：`apps/web/src/components/TopicTree.tsx:191-195`；名称紧随其后：`apps/web/src/components/TopicTree.tsx:197-220`。
- 文件行 DOM 结构为：固定宽度 chevron gap（宽 10）→ `FileTypeIcon` → 名称。文件行 gap 见 `apps/web/src/components/TopicTree.tsx:187-189`；文件图标见 `apps/web/src/components/TopicTree.tsx:195`；名称见 `apps/web/src/components/TopicTree.tsx:197-220`。
- `rg` 检查 `TopicTree.tsx` 未发现 `width: 18`、`width={18}`、`18px` 等旧占位残留；仅有 `FileTypeIcon` 条件渲染：`apps/web/src/components/TopicTree.tsx:191-195`。
- 展开/收起交互仍由 folder chevron 与 `onToggleDir` 路径承担，未因移除图标改变；已有测试覆盖折叠时深层不可见、展开后深层可见：`apps/web/src/tests/TopicTree.test.tsx:140-167`。

对“同层对齐规则明确”的判定：
- 文件夹没有图标而文件有图标，因此同一层级下文件夹名称起始 x 坐标会比文件名称更靠左。
- 这符合本轮返工要求“文件夹行名称紧跟 chevron”，不是旧问题中的“删除图标后仍保留固定宽度占位”。当前规则明确为：文件夹名紧跟 chevron；文件名紧跟文件类型图标。

## 越界/偏差清单

- 未发现影响文件行类型图标体系；文件行仍渲染 `FileTypeIcon`：`apps/web/src/components/TopicTree.tsx:195`。
- 未发现树外组件改动。
- 未发现新增图标显隐设置项。
- 未发现调整树行高/缩进体系的代码；本轮相关结构只移除 folder 图标占位。

## 运行验证

```text
cd apps/web && bunx vitest run src/tests/TopicTree.test.tsx
Test Files  1 passed (1)
Tests       12 passed (12)
Duration    786ms
```

## 待用户裁决项

- 无。文件夹名比文件名更靠左是“名称紧跟 chevron”的设计结果，已在本报告中明示，不判为新的不对齐 bug。

SUMMARY: result=pass | fail=0 | pending=0
