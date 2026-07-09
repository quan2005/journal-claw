# Verify Report — STORY-20260708-rename-topic-to-workspace

> 独立 subAgent 验收（轮次 1）。结论仅基于输入契约与指定核对范围的客观证据。

- **result: pass**
- 轮次：1
- 核对范围：`apps/web/src/components/NavRail.tsx`、`apps/web/src/components/TreeSidebar.tsx`、`apps/web/src/components/DetailView.tsx`、`apps/web/src/lib/topicCuration.ts`
- design.md：本任务无
- 实现落点：commit `3265606`（已在 main，4 个范围内文件工作树无未提交改动）

---

## 1. 验收标准逐条核对

### AC-1 — 全界面无「专题」字样 — PASS

契约要求：导航、侧栏、右键菜单、详情页、设置、空状态、错误提示处处显示「工作空间」，不再出现「专题」。

证据：

| 位置 | 现值 | 证据（文件:行） |
| --- | --- | --- |
| 导航项 label | 工作空间 | `apps/web/src/components/NavRail.tsx:27` |
| 侧栏区段标题 | 工作空间 | `apps/web/src/components/TreeSidebar.tsx:1241` |
| 详情页空状态文案 | 工作空间（两处） | `apps/web/src/components/DetailView.tsx:1720`、`1722` |
| 详情页面包屑根 label | 工作空间 | `apps/web/src/components/DetailView.tsx:1755`（`rootLabel="工作空间"`） |
| topicCuration 注释 | 工作空间 | `apps/web/src/lib/topicCuration.ts:4`、`16` |

grep 取证（用户可见源码）：

```
$ rg -n "专题" NavRail.tsx TreeSidebar.tsx DetailView.tsx topicCuration.ts
（无输出，exit 1）

$ rg -n "专题" apps/web/src   # 含测试
apps/web/src/tests/TopicTree.test.tsx:171,172,175,238,246,251,252
apps/web/src/tests/TreeContextMenu.test.tsx:16,17,29,32
apps/web/src/tests/DetailView.test.tsx:195,197   # 注释 + 断言 queryByText('专题').toBeNull()（守护测试）
```

- 范围内 4 文件：0 处「专题」。
- `apps/web/src` 全量：剩余「专题」**仅在测试文件**，且为 **fixture 数据/守护断言**，非用户可见文案。
- locales（`apps/web/src/locales/en.ts`、`zh.ts`）、desktop、i18n：均无「专题」。
- 右键菜单组件 `TreeContextMenu.tsx`（AC-1 列举项，虽不在声明核对范围）：`rg` 显示其文案用「删除文件夹/删除条目」等，无「专题」。

结论：用户可见界面已无「专题」，概念处处为「工作空间」。符合 AC-1。

### AC-2 — 功能行为不变 — PASS

契约要求：更名后浏览、右键操作、新建等行为与更名前一致，仅文案变化。

证据：

- 相关测试全绿（vitest run，5 文件 / 46 用例通过）：

```
$ bun run test -- src/tests/DetailView.test.tsx src/tests/NavRail.test.tsx \
    src/tests/TreeSidebar.test.tsx src/tests/TopicTree.test.tsx \
    src/tests/TreeContextMenu.test.tsx
Test Files  5 passed (5)
Tests       46 passed (46)
```

- 实现提交 `3265606` 的 diff 表明更名是纯文案/注释改动：
  - `NavRail.tsx`：`label: '专题'` → `'工作空间'`（1 行，无逻辑）。
  - `TreeSidebar.tsx`：`label="专题"` → `label="工作空间"`（1 行，无逻辑）。
  - 代码内部标识符（`topic`、`TopicEntry`、`topicCuration`、`topic-file`、`displayTopicName` 等）刻意保留，符合 Won't「不重命名代码内部标识符」。
- 守护测试 `DetailView.test.tsx:197` 断言 `queryByText('专题')` 为 null，反向锁定「不再出现」。

结论：行为未变，仅文案变化。符合 AC-2。

---

## 2. 越界 / 偏差清单

无阻断性越界。低优先观察项见下。

1. **提交 `3265606` 捆绑了非本故事改动**：同一 commit 在 `topicCuration.ts:45-46` 给 `displayTopicName` 增加了 `if (entry.display_name) return entry.display_name`（属 compact-folders/显示名诉求，非文案更名）。该行不影响本故事 AC（更名部分为纯注释），仅记录「多故事同提交」事实，不构成偏差。

---

## 3. 待用户裁决项

1. **交棒清单复选框未勾**：`story.md` 第 61 行 `[ ] 清点 26 处命中…测试随文案同步更新`。事实上依赖 UI 文案断言的测试（DetailView/NavRail/TreeSidebar）已同步（`DetailView.test.tsx:192` 断言「工作空间」），仅剩 fixture 数据残留。是否勾选由用户定。

2. **测试 fixture 残留「专题」**（可选清理，非 AC 要求）：
   - `apps/web/src/tests/TopicTree.test.tsx`、`apps/web/src/tests/TreeContextMenu.test.tsx`：以「专题」作文件夹名/路径的样本数据。
   - `apps/daemon/src/settings/service.test.ts:150,154`、`apps/daemon/src/files/service.test.ts:174-190`：后端 fixture 目录名。
   - 按 Won't「用户不可见…不强制」，可不改；若希望全仓 `rg 专题` 零噪音，可顺手换成中性名。→ 建议用户裁决是否纳入本故事收尾。

3. **中英混排一致性（既有，非本故事引入）**：`TreeSidebar.tsx:751` 顶部标题为 `<span>Workspace</span>`、`:1259` `aria-label="Workspace"`（英文），而区段标题 `:1241` 为「工作空间」（中文）。两者非「专题」，不违反 AC-1，但与「处处显示为工作空间」字面略有出入。该英文标签未在更名 commit 中改动（diff 仅含 `:1241`），属既有双语不一致。是否一并统一由用户定（可能超出本故事范围）。

---

## 4. 六字诀自检

- **不漏**：范围内 4 文件 + AC 列举界面位置全部取证；扩查 `apps/web/src` 全量、locales、desktop、右键菜单组件。✓
- **不重**：未对同一证据重复计分；测试与代码证据分开。✓
- **不偏**：fixture 数据与用户可见文案严格区分；未把既有的英文 Workspace 问题记为本次 fail。✓
- **不倚**：未采信实现者自述，结论基于 grep 输出、test 运行结果、git diff。✓
- **不多**：无超出 AC/Won't 的额外要求。✓
- **不少**：两条 AC 均有证据闭环。✓

---

## 裁定（2026-07-08，主对话）

1. **交棒清单复选框**：已勾选，见 story.md 更新。
2. **测试 fixture 残留"专题"**：接受不改。这些是内部测试样本数据（文件夹名/路径），非用户可见文案，Won't 明确"用户不可见的...不强制"。
3. **`TreeSidebar.tsx` 英文 "Workspace" 标签与中文"工作空间"混排**：接受不改，明确移出本故事范围。这是与"专题"无关的既有中英文混排问题（该英文标签从未叫过"专题"），本故事的 AC 是"消除专题/工作空间两套新旧名词并存"，不是"统一全站语言"，纳入会越界。留给后续单独的 i18n/文案一致性故事处理。

pending 清零。

SUMMARY: result=pass | fail=0 | pending=0
