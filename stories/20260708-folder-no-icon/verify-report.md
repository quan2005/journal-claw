# 验收报告 — STORY-20260708-folder-no-icon

> 独立 subAgent 核对 · 轮次 1 · 仅依据输入契约与指定范围取证

## result: pass

## 核对范围

| 文件 | 状态 |
| --- | --- |
| `apps/web/src/components/TopicTree.tsx` | 存在，已读 |
| `apps/web/src/tests/TopicTree.test.tsx` | 存在，已读 |
| 辅证（非范围、用于验证测试有效性）| `apps/web/src/components/FileTypeIcon.tsx` |

无 design.md（任务声明本任务无 design.md）。

## AC 核对

### AC-1 — 文件夹行无图标 → **pass**

| 验收点 | 结论 | 证据 |
| --- | --- | --- |
| 文件夹行仅显示展开箭头 + 名称，无任何图标 | pass | `TopicTree.tsx:193-197` 对 `isDir` 渲染空占位 `<span style={{ width: 18, minWidth: 18, flexShrink: 0 }} />`，**不渲染** `<FileTypeIcon>`；展开箭头 chevron 仍渲染于 `TopicTree.tsx:164-188`；名称渲染于 `TopicTree.tsx:225-227` |
| 文件行类型图标保持现状 | pass | `TopicTree.tsx:198-199` 非 dir 分支渲染 `<FileTypeIcon kind={iconKind} selected={isSelected} />` |
| 测试覆盖 | pass | `TopicTree.test.tsx:60` `queryByLabelText('文件夹')` 为 null；`TopicTree.test.tsx:173-174` 折叠/展开两种态均断言无 `文件夹` / `已展开的文件夹` aria-label；`TopicTree.test.tsx:61-75` 断言 15 种文件类型图标全部保留 |

测试有效性已交叉验证：`FileTypeIcon.tsx:11-14,276-284` 对 `folder`/`folder-open` kind 会渲染 `role="img"` + `aria-label="文件夹"/"已展开的文件夹"`，故 `queryByLabelText` 断言确为有效红/绿测试（若误渲染图标即 fail）。

### AC-2 — 展开/收起与对齐不受影响 → **pass**

| 验收点 | 结论 | 证据 |
| --- | --- | --- |
| 展开/收起交互正常 | pass | 点击处理 `TopicTree.tsx:111` `isDir ? onToggleDir(entry.path) : onSelectFile(entry)` 未改动；chevron 旋转随 `isExpanded`（`TopicTree.tsx:173`）；递归子树渲染随 `isExpanded`（`TopicTree.tsx:290-337`） |
| 同层文件夹名与文件名视觉对齐不错乱 | pass（代码级证据） | 文件夹空占位 `width:18, minWidth:18`（`TopicTree.tsx:197`）与 `<FileTypeIcon>` 默认 `size=18`、`width:18, minWidth:18`（`FileTypeIcon.tsx:257,264-266`）宽度一致，二者前序 chevron/占位（`TopicTree.tsx:164-191`）对 dir 与 file 完全等宽。实现注释 `TopicTree.tsx:194-196` 明确记录"为对齐保留同宽"意图 |
| 测试覆盖 | pass（交互）| `TopicTree.test.tsx:141-167` 覆盖默认折叠与手动展开两态 |

> 注：像素级对齐无自动化测试，按保守原则以代码级等宽证据（18px===18px）判 pass。若要求像素级回归测试，列入"待用户裁决"。

## Won't 边界核对

| 边界 | 结论 | 证据 |
| --- | --- | --- |
| 不影响文件行类型图标体系（FileTypeIcon） | pass | `FileTypeIcon.tsx` 中 `folder`/`folder-open` kind 定义仍保留（未删），文件行仍调用 `FileTypeIcon`；仅 `TopicTree.tsx` 对 dir 分支不再实例化它 |
| 不影响树之外（列表、详情页）图标 | pass | 改动仅限 `TopicTree.tsx`（指定范围内），无越界文件改动 |
| 不做图标显隐用户设置项 | pass | 未引入任何 settings/toggle 代码 |
| 不调整行高/缩进体系 | pass | 行 padding `TopicTree.tsx:93` `5px 4px 5px ${rowIndent}px`、`rowIndent = 8 + indent*16`（`TopicTree.tsx:70`）均未改动 |

## 越界 / 偏差清单

1. **死代码（轻微，非缺陷）**：`TopicTree.tsx:71-75` 仍为 dir 计算 `iconKind = isExpanded ? 'folder-open' : 'folder'`，但该值在 dir 分支已不再被消费（dir 走空占位，FileTypeIcon 分支仅 file 命中）。属无害残留，不影响任何 AC。建议（非阻断）后续清理为 `const iconKind = fileTypeIconKindFromName(entry.name)`，或保留以降低 diff 面——不影响验收。

## 待用户裁决项

无。AC-2 的"像素级对齐"已以代码级等宽证据判 pass；如用户要求专门的像素回归测试再升级。

## 测试执行证据

```
$ ./node_modules/.bin/vitest run src/tests/TopicTree.test.tsx   (cwd: apps/web)
 RUN  v4.1.9
 Test Files  1 passed (1)
      Tests  12 passed (12)
   Duration  791ms
```

12 个用例全部通过，其中 folder-no-icon 直接相关用例：
- `labels topic icons by folder and file type`（含 `queryByLabelText('文件夹')` 为 null）
- `shows no folder icon whether collapsed or expanded`

SUMMARY: result=pass | fail=0 | pending=0
