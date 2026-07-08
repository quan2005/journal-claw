---
status: obsolete
slug: mdx-component-hygiene
title: MDX 组件库清洁与 AI 引导提示词对齐
level: L2
created: 2026-06-16
superseded_by: stories/20260627-mdx-retire/story.md
obsoleted: 2026-07-08
---

# MDX 组件库清洁与 AI 引导提示词对齐

> **已作废（2026-07-08）**：本 story 针对的 `apps/web/src/components/mdx/*` 组件库、`mdxComponents` 映射、`component-catalog.md`/`component-recipes.md` 提示词整个子系统，已在 `stories/20260627-mdx-retire/story.md`（`status: verified`）中被整体删除——项目彻底下线 MDX，改用纯 Markdown 渲染。本 story 的验收标准、范围与交棒清单全部依赖已不存在的实现对象，不再具备可执行性，故标记 `obsolete`，不落地实现。历史背景保留供追溯。

## 背景

谨迹的 AI 引擎在整理日志时，依据 `component-catalog.md` 和 `component-recipes.md` 选择 JSX 组件。

**现状问题** [证据]：

1. **幽灵组件**：catalog 列出 ~97 个组件名，实际注册仅 62 个。约 35 个组件（`ActionTable`、`EvidenceCard`、`IncidentTimeline`、`RiskMatrix`、`Transcript`、`Hero`、`AudioCard`、`VideoCard`、`PhonePreview`、`MacPreview` 等）只存在于提示词中，前端没有实现 → AI 生成后渲染白屏或报错。[`src/components/mdx/index.ts` vs `component-catalog.md`]

2. **重复实现**：同名组件在两个位置有不同实现（`Quote` in `callout.tsx` vs `layout/evidence.tsx`；`Checklist` in `cards.tsx` vs `layout/conversion.tsx`；`Timeline` in `display.tsx` vs `layout/infographic.tsx`）。`layout/*` 通过 `export *` 覆盖了前者，但 AI 看到两种 API 签名仍可能生成错误版本。[`src/components/mdx/index.ts` 导出顺序]

3. **prop 命名不一致**：同类组件混用 `heading`/`title`/`caption` 表达同一语义。[`layout/conversion.tsx`]

4. **内容困在 prop 中**：`Quote`、`Faq`（answer）、`Summary`（body）等组件的大段文本通过 prop 传入，Markdown 语法无法被解析。[`layout/evidence.tsx`、`layout/conversion.tsx`]

5. **无防御性**：非 layout 系列组件（`display.tsx`、`cards.tsx`）对 `undefined`/空数组无保护，AI 生成缺字段的 props 时整块崩溃。[`display.tsx` Timeline]

## 目标与假设

**目标**：让 AI 引擎在整理日志时，100% 只生成能正确渲染的组件代码，不再出现白屏/报错。

**假设**：

- 当提示词与实际组件库严格对齐时，AI 生成的 MDX 渲染成功率将从目前的 ~70%（估计）提升到 >95%
- 提示词精简后，token 占用更小，AI 选择组件更准确

## 验收标准

- **AC-1** 当 AI 引擎整理素材时，`component-catalog.md` 中列出的每一个组件名，都能在 `mdxComponents` 映射中找到对应实现，无幽灵组件
- **AC-2** 当 AI 引擎生成 MDX 日志时，同一语义概念（如「引用」「清单」「时间线」）只有唯一推荐组件名，不存在需要 AI 选择的歧义
- **AC-3** 当组件接收到空数据或缺失必填字段时，组件渲染为空状态/错误提示，而不是抛出异常导致白屏
- **AC-4** 当 AI 引擎读取 `component-catalog.md` 时，每个组件的 props 描述与实际 TypeScript 类型定义一致
- **AC-5** 当 AI 引擎通过 `component-recipes.md` 学习用法时，所有示例代码可直接渲染无报错

## 非目标

- **不新增组件**：本次只清洁和对齐，不实现 catalog 中列出但不存在的幽灵组件（如 `ActionTable`、`RiskMatrix` 等）
- **不改变渲染架构**：`blockFactory` / `LayoutBlock` / `MdxRenderer` 机制不动
- **不优化视觉样式**：CSS/排版不在本次范围
- **不改 children 支持**：将 prop-only 组件改为支持 children 属于 API 变更，影响已有日志，本次不做（标记为后续）
- **不做 ARIA 无障碍补全**：标记为后续任务

## 范围

| 层       | 动作                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| 提示词层 | 重写 `component-catalog.md`：只列实际存在的组件，统一 prop 命名描述                    |
| 提示词层 | 重写 `component-recipes.md`：只用真实可渲染的示例，删除幽灵组件用例                    |
| 组件层   | 消除重复导出：确定每对重复组件的唯一权威实现，废弃方标记 `@deprecated` 或删除          |
| 组件层   | 为非 layout 系列组件补充空数据保护（items 为空/undefined 时不崩溃）                    |
| 组件层   | 统一 prop 命名：`heading` → `title`（保留 `heading` 作为 deprecated alias 兼容旧日志） |
| 验证层   | 补充冒烟测试：catalog 中每个组件至少一条快照或渲染测试                                 |

## 交棒清单（→ design.md）

以下实现层问题需在方案设计阶段决策：

1. **重复组件的权威版本选择**：`Quote`（callout.tsx 简版 vs layout/evidence.tsx 完整版）、`Checklist`、`Timeline` 各保留哪个？需评估已有日志中的实际使用情况
2. **向后兼容策略**：旧日志已使用废弃 prop（如 `heading`），是运行时 alias 还是迁移脚本？
3. **catalog token 预算**：当前 catalog + recipes 合计 ~3K tokens，精简后目标多少？是否拆成「核心组件」和「扩展组件」两档？
4. **测试策略**：快照 vs DOM 断言 vs 视觉回归？

## 待确认

1. ❓ 幽灵组件中是否有你计划近期实现的？（如 `ActionTable`、`EvidenceCard`、`RiskMatrix`）——如果有，catalog 保留但标注 `[计划中]`；否则全部删除
2. ❓ 旧日志中 `heading` prop 的使用量大吗？是否需要保持运行时兼容，还是可以一次性迁移？
