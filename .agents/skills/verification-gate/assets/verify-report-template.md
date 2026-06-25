---
story: ./story.md
design: ./design.md   # 无则填 N/A
date: {YYYY-MM-DD}
round: 1
result: fail          # pass | fail（六项全过才是 pass）
scope: "{核对范围：diff 命令或文件清单描述}"
---

# 验收报告 — {story 标题}

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 | ✅ pass | `src/foo.ts:42` — 实现了 X，测试 `test/foo.test.ts:10` 通过 |
| AC-2 | ❌ fail | 预期 Y，实际 Z（`src/bar.ts:17`） |

## 范围完整性（不少，对照 story.md 范围）

<!-- story 范围逐条对照；AC 未显式覆盖的范围条目也在此核对 -->

## 方案落实（不偏，对照 design.md）

<!-- design 存在时：NFR、依赖、架构方案是否照做。无 design 填 N/A -->

## 越界检查（不多，对照 story 非目标 + design 范围）

<!-- diff 中无法归属到 AC / design 范围 / 必要基础设施的改动逐项列出；命中非目标的单独标注 -->

- ✅ / ❌ 说明

## 冗余（不重，对照 story.md）

<!-- 同一 AC 的重复实现 -->

## 结论

<!-- 全部通过 / 存在偏差：fail 项的修复建议，按风险排序 -->

## 待用户裁决

<!-- 灰色地带。写清两边代价。用户接受的项：影响"要什么"回写 story，影响"怎么做"回写 design，回写后方可计入通过 -->
