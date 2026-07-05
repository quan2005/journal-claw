---
status: verified
slug: 20260628-timeline-tag-truncation
owner: codex (视觉验收)
source: 终局 UI 10 优化目标 — G5
---

# Timeline 标签溢出裁切修复（codex 批次）

## 用户故事

作为一名在 Timeline 侧栏快速扫读日志条目的知识工作者，
我希望每条条目的分类标签完整可读、不被边缘生切，
以便我靠标签（weekly-report / research / personal…）快速判断条目类型，而不是看到 `rese...` `use...` 这种切一半的无意义碎片。

## 背景与失败模式

[证据] Timeline 列表项右侧 tag 被容器边缘硬切：截图可见 `personal/co...`、`rese...`、`lea...`、`use...`。tag 承载分类语义，切一半等于丢失信息。属 CLAUDE.md 约束7「视觉修复必须验证真实渲染链」范畴。
[证据] 条目标题亦为无策略截断。

## 成功标准（GWT 验收）

- **AC-1**（标签不裁切）Given Timeline 列表渲染含较长 tag 的条目，When 条目宽度不足以容纳全部 tag，Then tag 要么完整显示、要么以 ellipsis 优雅截断、要么折叠为「+N」气泡——任何情况下不出现被容器右边缘生切的半截字符。
- **AC-2**（标题安全截断）Given 条目标题超出可用宽度，When 渲染该条目，Then 标题以 `line-clamp`/ellipsis 截断，不溢出、不重叠 tag、不撑破行高。
- **AC-3**（红/绿测试）Given 修复完成，When 运行单测，Then 存在一条针对「长 tag / 长标题不裁切溢出」的测试，修复前红、修复后绿。

## 边界（Won't）

- 不改 tag 的取值、配色、点击行为。
- 不改 Timeline 的日期分组、排序逻辑。
- 不处理详情面板（DetailView）内的渲染，仅限 Timeline 列表项。

## 交棒 design（实现层）

- 定位真实渲染组件与 CSS（Timeline 列表项 component + 对应 .css），以 computed style 为准确认 `max-width` / `flex` / `overflow` / `text-overflow`。
- 「+N」与「ellipsis」二选一由实现按现有视觉语言定，保持与 `想法` 行内 tag 一致。
