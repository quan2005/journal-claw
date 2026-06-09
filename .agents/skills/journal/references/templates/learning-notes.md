# Learning Notes Templates

## Family Boundary

- Recognition signal: 书籍、论文、课程、概念、例题、理解检查或复习计划。
- Expected output: 形成可复习、可解释、可应用的知识记录。
- Routing rule: 以材料要完成的工作为准，不按单个关键词分类；会议产出的独立规格文档只有在用户明确要求时才切换家族。

## Subtypes

### book-note

- Classification signal: 读书笔记相关素材，且主要任务与标题一致。
- Expected output: 读书笔记；形成可复习、可解释、可应用的知识记录。
- Required information: 书籍信息、章节一句话、关键摘录、可复用概念、二次压缩摘要、未来调用场景、个人应用实验、重读触发条件。
- Recommended components: `Quote`（保留关键原文）、`InsightCard`（记录自己的解释）、`ReferenceList`（回到学习来源）。
- Example: [读书笔记](../template-examples/learning-notes/book-note.mdx)

### concept-explanation

- Classification signal: 概念解释相关素材，且主要任务与标题一致。
- Expected output: 概念解释；形成可复习、可解释、可应用的知识记录。
- Required information: 定义、必要属性、非必要属性、正例、反例、判断边界、易混概念、诊断题。
- Recommended components: `Definition`（固定概念边界）、`MythFact`（暴露常见误解）、`Steps`（安排解释和应用练习）。
- Example: [概念解释](../template-examples/learning-notes/concept-explanation.mdx)

### cornell-note

- Classification signal: 康奈尔笔记相关素材，且主要任务与标题一致。
- Expected output: 康奈尔笔记；形成可复习、可解释、可应用的知识记录。
- Required information: 线索/问题、主笔记、课后总结、自测问题、错误回忆、迁移题、复习计划。
- Recommended components: `Quote`（保留关键原文）、`InsightCard`（记录自己的解释）、`ReferenceList`（回到学习来源）。
- Example: [康奈尔笔记](../template-examples/learning-notes/cornell-note.mdx)

### course-video-note

- Classification signal: 课程视频笔记相关素材，且主要任务与标题一致。
- Expected output: 课程视频笔记；形成可复习、可解释、可应用的知识记录。
- Required information: 视频/课程来源、关键时间点、知识点、示例、自己的复述、未解问题、练习任务与结果、回看原因。
- Recommended components: `Quote`（保留关键原文）、`InsightCard`（记录自己的解释）、`ReferenceList`（回到学习来源）。
- Example: [课程视频笔记](../template-examples/learning-notes/course-video-note.mdx)

### deep-reading

- Classification signal: 深度阅读笔记相关素材，且主要任务与标题一致。
- Expected output: 深度阅读笔记；形成可复习、可解释、可应用的知识记录。
- Required information: 核心命题、论证链、关键证据、隐含假设、反向复述、我的批判、可迁移工作场景、复习问题。
- Recommended components: `Quote`（保留关键原文）、`InsightCard`（记录自己的解释）、`ReferenceList`（回到学习来源）。
- Example: [深度阅读笔记](../template-examples/learning-notes/deep-reading.mdx)

### feynman-note

- Classification signal: 费曼笔记相关素材，且主要任务与标题一致。
- Expected output: 费曼笔记；形成可复习、可解释、可应用的知识记录。
- Required information: 概念、禁用术语清单、小白解释、卡壳点、类比、新例子、修正版解释、复讲对象/日期。
- Recommended components: `Definition`（固定概念边界）、`MythFact`（暴露常见误解）、`Steps`（安排解释和应用练习）。
- Example: [费曼笔记](../template-examples/learning-notes/feynman-note.mdx)

### flashcard

- Classification signal: 闪卡相关素材，且主要任务与标题一致。
- Expected output: 闪卡；形成可复习、可解释、可应用的知识记录。
- Required information: 问题、答案、提示、易错点、掌握度。
- Recommended components: `Definition`（提供准确答案）、`CopyButton`（复用问题文本）、`RatingBar`（记录掌握度）。
- Example: [闪卡](../template-examples/learning-notes/flashcard.mdx)

### knowledge-card

- Classification signal: 知识卡片相关素材，且主要任务与标题一致。
- Expected output: 知识卡片；形成可复习、可解释、可应用的知识记录。
- Required information: 原子概念、一句话定义、正例、反例、适用边界、易混概念、使用条件、相关笔记。
- Recommended components: `Definition`（固定概念边界）、`MythFact`（暴露常见误解）、`Steps`（安排解释和应用练习）。
- Example: [知识卡片](../template-examples/learning-notes/knowledge-card.mdx)

### learning-plan

- Classification signal: 学习计划相关素材，且主要任务与标题一致。
- Expected output: 学习计划；形成可复习、可解释、可应用的知识记录。
- Required information: 当前水平、目标行为、资源队列、刻意练习任务、训练排期、反馈来源、进度指标、复盘节奏。
- Recommended components: `MilestoneTimeline`（安排学习阶段）、`Toolbox`（绑定资源与用途）、`Checklist`（检查阶段成果）。
- Example: [学习计划](../template-examples/learning-notes/learning-plan.mdx)

### literature-matrix

- Classification signal: 文献矩阵相关素材，且主要任务与标题一致。
- Expected output: 文献矩阵；形成可复习、可解释、可应用的知识记录。
- Required information: 主题维度、论文/年份、研究问题、方法/样本、发现、限制、共识、冲突/研究缺口。
- Recommended components: `ComparisonMatrix`（统一比较维度）、`InsightCard`（提炼差异含义）、`Verdict`（给出有边界的结论）。
- Example: [文献矩阵](../template-examples/learning-notes/literature-matrix.mdx)

### paper-note

- Classification signal: 论文笔记相关素材，且主要任务与标题一致。
- Expected output: 论文笔记；形成可复习、可解释、可应用的知识记录。
- Required information: 阅读轮次、研究问题、方法与样本、主要发现、限制与威胁、关键图表、可复用方法/指标/数据、后续追踪论文。
- Recommended components: `Quote`（保留关键原文）、`InsightCard`（记录自己的解释）、`ReferenceList`（回到学习来源）。
- Example: [论文笔记](../template-examples/learning-notes/paper-note.mdx)

### problem-solving

- Classification signal: 解题记录相关素材，且主要任务与标题一致。
- Expected output: 解题记录；形成可复习、可解释、可应用的知识记录。
- Required information: 问题重述、已知/未知、约束条件、尝试记录、最终解法、检验方式、错因与规律、类似题迁移。
- Recommended components: `Steps`（保留尝试顺序）、`Callout`（标记关键卡点）、`InsightCard`（沉淀可迁移方法）。
- Example: [解题记录](../template-examples/learning-notes/problem-solving.mdx)

## Family Quality Rules

- 事实、判断、未知项和下一步必须可区分。
- 只有真实存在的来源、负责人、日期和数字才能写成确定信息。
- Markdown 能表达清楚时不要强行使用组件。
