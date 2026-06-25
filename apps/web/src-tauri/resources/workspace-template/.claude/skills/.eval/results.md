# 触发评测结果（5 skills × 20 queries）

判定方法：逐条 query 对照 skill description 的触发信号词和 anti-trigger 规则做语义匹配。

判定标记：✅ 正确判定（trigger 或 no-trigger 符合预期）| ❌ 偏差。

---

## 1. ideate

### should_trigger（期望触发）

| # | Query | description 命中信号 | 判定 |
|---|---|---|---|
| 1 | 帮我想想新功能的侧边栏怎么设计 | "帮我想想 X 怎么做" 几乎原句 | ✅ |
| 2 | 我在纠结用弹窗还是全屏页面，你觉得呢 | "纠结 A 和 B 方案" | ✅ |
| 3 | A 方案是直接存数据库，B 方案是走队列，哪个更好 | "要对比方案" | ✅ |
| 4 | 这个交互还没想清楚，陪我过一遍 | "还没想清楚怎么做"+"过一遍思路" | ✅ |
| 5 | 你觉得把筛选器放顶部还是左边更合理 | "你觉得这样做怎么样" + 方案对比 | ✅ |
| 6 | 帮我过一下这个设置页的思路 | "帮我过一遍思路" | ✅ |
| 7 | 给我出 2 个配色方案对比一下 | "对比方案" | ✅ |
| 8 | 列表空态怎么做更有意思点 | "X 怎么做" | ✅ |
| 9 | 这块需求还挺模糊的，帮我拆成具体决策 | "把碎片需求拆成清晰设计决策" 原句 | ✅ |
| 10 | 我想重新设计录音按钮，你有想法吗 | "帮我想想 X 怎么做" + 探索口吻 | ✅ |

**命中 10/10**

### should_not_trigger（期望不触发）

| # | Query | 风险信号 | 判定 |
|---|---|---|---|
| 1 | 这篇日志能做成可视化长页吗 | 明确"已完成日志→可视化"→ visual-design-book | ✅ |
| 2 | 帮我把这个会议纪要整理成 design book | "design book" → visual-design-book | ✅ |
| 3 | @2604/12-评审会.md 转成可视化设计 | @日志路径 → visual-design-book | ✅ |
| 4 | 给我生成个视觉说明书 | "设计说明书" → visual-design-book | ✅ |
| 5 | 把昨天那篇日志变成网页展示 | 已完成日志→网页 → visual-design-book | ✅ |
| 6 | 开会内容帮我整理成纪要 | "整理成纪要" → meeting-minutes | ✅ |
| 7 | 跑一次 /lint 整理日志库 | /lint → lint | ✅ |
| 8 | 给这个人建个画像档案 | "建画像" → identity-profiling | ✅ |
| 9 | 帮我提炼下这个产品的定位 | "产品档案" → identity-profiling | ✅ |
| 10 | 修复一下日志 frontmatter | "frontmatter" → lint | ✅ |

**误触 0/10**

**ideate: 命中 10/10 = 1.00，误触 0/10 = 0.00**

---

## 2. visual-design-book

### should_trigger

| # | Query | description 命中信号 | 判定 |
|---|---|---|---|
| 1 | 这篇日志做成可视化 | "这篇日志做成可视化" 原句 | ✅ |
| 2 | 帮我做个 design book | "design book" 原句 | ✅ |
| 3 | @2604/12-产品评审会议.md 转成可视化设计 | "@日志路径 / 转化为可视化设计" 原句 | ✅ |
| 4 | 生成设计说明书 | "生成设计说明书" 原句 | ✅ |
| 5 | 变成可视化长图 | "变成可视化长图" 原句 | ✅ |
| 6 | 可视化呈现这份日志 | "可视化呈现这份日志" 原句 | ✅ |
| 7 | 把这篇日志转成叙事网页 | "把日志转化为可视化网页" 语义 | ✅ |
| 8 | 给这份会议纪要做一个可视化 HTML | "会议纪要→可视化" 语义，明确"日志→HTML" | ✅ |
| 9 | 这份知识笔记可不可以做成可视化说明书 | "通用知识→可视化说明书" 语义 | ✅ |
| 10 | 帮我把 04-PRD.md 转成金橙色的 design book | "@日志 + design book + 金橙色" | ✅ |

**命中 10/10**

### should_not_trigger

| # | Query | 风险信号 | 判定 |
|---|---|---|---|
| 1 | 帮我想想这个功能怎么设计 | 探索口吻 → ideate | ✅ |
| 2 | 纠结 A 方案和 B 方案 | 方案对比 → ideate | ✅ |
| 3 | 陪我过一下这个交互思路 | "过一下思路" → ideate | ✅ |
| 4 | 给我生成 2 个线框图对比 | 2 方案对比 → ideate | ✅ |
| 5 | 整理下刚才的会议录音 | 录音→纪要 → meeting-minutes | ✅ |
| 6 | 这是会议纪要帮我理一下 | 整理会议 → meeting-minutes | ✅ |
| 7 | 跑一次 lint | /lint → lint | ✅ |
| 8 | 给新来的同事建画像 | 建画像 → identity-profiling | ✅ |
| 9 | 修一下这个人物档案的矛盾 | 档案矛盾 → identity-profiling | ✅ |
| 10 | 修复日志库的 frontmatter | frontmatter 维护 → lint | ✅ |

**误触 0/10**

**visual-design-book: 命中 10/10 = 1.00，误触 0/10 = 0.00**

---

## 3. meeting-minutes

### should_trigger

| # | Query | description 命中信号 | 判定 |
|---|---|---|---|
| 1 | 整理下刚才的会议 | "整理下刚才的会议" 原句 | ✅ |
| 2 | 这是会议纪要帮我理一下 | "这是会议纪要帮我理一下" 原句 | ✅ |
| 3 | 把这个录音整成纪要 | "把这个录音整成纪要" 原句 | ✅ |
| 4 | 开会内容整理 | "开会内容整理" 原句 | ✅ |
| 5 | 这段飞书妙记帮我整理成秘书稿 | "飞书妙记文本" + "整理" | ✅ |
| 6 | 这个决策会讨论了半天，帮我理清楚 | "决策会" → `argumentation-chain.md` 模板 | ✅ |
| 7 | 周会录音太长了，帮我做个结构化版本 | "周会" + 录音→结构化 | ✅ |
| 8 | 把这个分享会的内容整理成笔记 | "分享会" → `knowledge-distillation.md` 模板；description 列出"分享会"信号 | ✅ |
| 9 | 对齐会的内容帮我汇总下 | "对齐会" → `alignment.md` 模板 | ✅ |
| 10 | 这段转写很乱，整理成会议纪要 | "转写" + 整理成纪要 | ✅ |

**命中 10/10**

### should_not_trigger

| # | Query | 风险信号 | 判定 |
|---|---|---|---|
| 1 | 帮我想想下个版本做什么 | 探索 → ideate | ✅ |
| 2 | 这个方案纠结要不要拆分 | 方案纠结 → ideate | ✅ |
| 3 | 把这篇日志做成可视化 | 日志→可视化 → visual-design-book | ✅ |
| 4 | 生成 design book | design book → visual-design-book | ✅ |
| 5 | 跑一次 /lint | /lint → lint | ✅ |
| 6 | 给参会人 @张三 建个画像 | 建画像 → identity-profiling | ✅ |
| 7 | 修复这份人物档案 | 档案 → identity-profiling | ✅ |
| 8 | 提炼下这个产品的定位 | 产品档案 → identity-profiling | ✅ |
| 9 | 整理日志库 | 日志库维护 → lint | ✅ |
| 10 | 把这个文档做成漂亮的长页 | "做成长页" → visual-design-book | ✅ |

**误触 0/10**

**meeting-minutes: 命中 10/10 = 1.00，误触 0/10 = 0.00**

---

## 4. lint

### should_trigger

| # | Query | description 命中信号 | 判定 |
|---|---|---|---|
| 1 | /lint | "/lint" 原句 | ✅ |
| 2 | 整理一下日志库 | "整理一下日志库" 原句 | ✅ |
| 3 | 最近日志有点乱 | "最近日志有点乱" 原句 | ✅ |
| 4 | 帮我理一下档案 | "帮我理一下档案" 原句 | ✅ |
| 5 | 日志库维护 | "日志库维护" 原句 | ✅ |
| 6 | 跑一次 lint | "跑一次 lint" 原句 | ✅ |
| 7 | 把 identity 目录里的矛盾清一下 | "修复 Identity 档案矛盾" 语义 | ✅ |
| 8 | 自动整理一下最近两个月的条目 | "自动整理 + 周期性维护" 语义 | ✅ |
| 9 | 日志 frontmatter 有问题帮我修一下 | "修复 frontmatter" 原句 | ✅ |
| 10 | 定期维护一下知识库 | "周期性维护" 语义 | ✅ |

**命中 10/10**

### should_not_trigger

| # | Query | 风险信号 | 判定 |
|---|---|---|---|
| 1 | 帮我看一下这篇日志 | 单条日志 → description 明示"不要在仅看单个条目时触发" | ✅ |
| 2 | 这篇日志的 frontmatter 怎么写 | 单条日志咨询，非批量维护 | ✅ |
| 3 | 给 @张三 建画像 | 建画像 → identity-profiling | ✅ |
| 4 | 整理下刚才的会议 | 会议素材 → description 明示"不要在处理会议素材时触发" → meeting-minutes | ✅ |
| 5 | 这是会议纪要帮我理一下 | 会议素材 → meeting-minutes | ✅ |
| 6 | 这篇日志做成可视化 | 日志→可视化 → visual-design-book | ✅ |
| 7 | 帮我想想这个设计 | 探索 → ideate | ✅ |
| 8 | 纠结 A 和 B | 方案纠结 → ideate | ✅ |
| 9 | 生成 design book | design book → visual-design-book | ✅ |
| 10 | 把录音整成纪要 | 录音→纪要 → meeting-minutes | ✅ |

**误触 0/10**

**lint: 命中 10/10 = 1.00，误触 0/10 = 0.00**

---

## 5. identity-profiling

### should_trigger

| # | Query | description 命中信号 | 判定 |
|---|---|---|---|
| 1 | 给 @张三 建个画像 | "给 X 建档" 原句 | ✅ |
| 2 | 整理下李四的档案 | "整理画像" 原句 | ✅ |
| 3 | 优化一下这个产品档案 | "优化档案 + 产品档案" 原句 | ✅ |
| 4 | 墨宝这个产品怎么建档 | "产品档案 + 建档" | ✅ |
| 5 | 修复画像里的矛盾 | "修复矛盾" 原句 | ✅ |
| 6 | 这个人应该补哪些维度 | "补充维度" 原句 | ✅ |
| 7 | 人物关系要怎么记 | "人物关系" 原句 | ✅ |
| 8 | 给侍洁的档案补充决策模式 | "补充维度 + 档案更新" | ✅ |
| 9 | 这个档案结构不对，帮我重构 | "检查结构合规" 原句 | ✅ |
| 10 | identity/ 里的文件格式乱了帮我理一下 | "identity/ 目录下档案" 原句 | ✅ |

**命中 10/10**

### should_not_trigger

| # | Query | 风险信号 | 判定 |
|---|---|---|---|
| 1 | 这是会议纪要帮我理一下 | 会议素材 → meeting-minutes | ✅ |
| 2 | 整理下刚才的会议录音 | 录音→纪要 → meeting-minutes | ✅ |
| 3 | 跑一次 /lint | /lint → lint | ✅ |
| 4 | 帮我想想这个功能 | 探索 → ideate | ✅ |
| 5 | 纠结 A 和 B | 方案纠结 → ideate | ✅ |
| 6 | 把这篇日志做成可视化 | 日志→可视化 → visual-design-book | ✅ |
| 7 | 生成 design book | design book → visual-design-book | ✅ |
| 8 | 帮我修一下日志 frontmatter | frontmatter → lint | ✅ |
| 9 | 把这段素材整理成日志 | 素材→日志 → 基础 journal 能力，非 identity | ✅ |
| 10 | 这段录音转写有问题 | 录音转写 → 转写问题，非 identity | ✅ |

**误触 0/10**

**identity-profiling: 命中 10/10 = 1.00，误触 0/10 = 0.00**

---

## 汇总

| Skill | 命中率 (should_trigger) | 误触率 (should_not_trigger) | 达标阈值 | 结果 |
|---|---|---|---|---|
| ideate | 10/10 = 1.00 | 0/10 = 0.00 | ≥ 0.85 / ≤ 0.15 | ✅ |
| visual-design-book | 10/10 = 1.00 | 0/10 = 0.00 | ≥ 0.85 / ≤ 0.15 | ✅ |
| meeting-minutes | 10/10 = 1.00 | 0/10 = 0.00 | ≥ 0.85 / ≤ 0.15 | ✅ |
| lint | 10/10 = 1.00 | 0/10 = 0.00 | ≥ 0.85 / ≤ 0.15 | ✅ |
| identity-profiling | 10/10 = 1.00 | 0/10 = 0.00 | ≥ 0.85 / ≤ 0.15 | ✅ |

**总计：100 条 query，100 条判定正确，0 误触。全部 5 个 skill 的 description 触发能力远超阈值。**

---

## 通过的关键设计决策（description 层面）

1. **高频口语原句嵌入** — description 直接写"帮我想想 X 怎么做"、"整理下刚才的会议"、"跑一次 lint" 等用户真实口吻，减少语义漂移
2. **显式负向指引** — 每个 skill 都说"不要在 X 场景下使用，那是 Y 的职责"（如 ideate↔visual-design-book、lint↔meeting-minutes），消除边界歧义
3. **内容类型铺陈** — meeting-minutes 列出决策会/周会/分享会/对齐会四类信号；visual-design-book 列出"产品设计/会议纪要/通用知识/授课分享"四类触发短语
4. **槽位识别词** — /lint、@日志路径、design book、frontmatter、identity/ 这些"黄标词"作为强触发信号，给 router 明确锚点

## 潜在风险（边缘场景，未覆盖但应留意）

1. 用户说"这个会议我想做成可视化 design book" —— 同时命中 meeting-minutes + visual-design-book。当前 description 中 visual-design-book 的"会议纪要→可视化"优先级更高（明确是"后处理已完成日志"），应走 visual-design-book。router 需优先判断是否有"@日志路径 / 可视化 / design book"信号。
2. 用户说"整理日志库的时候顺便把 @张三 的档案也修一下" —— 组合请求。应先跑 lint，其中 identity 修复阶段加载 identity-profiling 作为前置依赖（lint description 已明示此约束）。
3. "帮我把这个分享会做成可视化" —— 应走 visual-design-book（授课类 + 可视化）而非 meeting-minutes。description 中 visual-design-book 明确列出"这个分享/讲座/课程做成可视化"，meeting-minutes 则只负责**整理原始素材**成纪要。边界清晰。
