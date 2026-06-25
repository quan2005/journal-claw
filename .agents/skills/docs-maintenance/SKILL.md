---
name: docs-maintenance
description: "文档自动维护（Docs Maintenance）——git commit 前，凡本次改动对应的 story 已 verified 且其 design.md 影响面涉及架构 / 设计 / 约定变更，必须使用本技能。文档已覆盖变更则跳过——本技能的产出是文档与代码一致，不是每次都改文档。"
---

# 文档自动维护 Docs Maintenance

把"更新文档"从靠自觉，变成 commit 链路上的固定一环。本技能独立运作：上游技能是否安装、是否被 skip，不影响本技能的判断。

## 放行判定

收到「文档维护」提醒或准备 commit 时，按序回答，命中即放行：

1. 用户标注 `[skip-gate]` / `[跳过门禁]` → 放行
2. 本次 commit 找不到对应的 story → 放行
3. story 未 verified → 放行（文档只记录验收过的事实）
4. 变更不涉及架构 / 设计 / 约定 / 项目定位 / 文档结构 / 用户可感知行为 / 开发工作流 → 放行（依据：design.md 的方案与影响面 + story.md 的 AC/非目标）
5. 对应文档已覆盖这些变更 → 放行（正常出口：目标是一致，不是改动量）

五问全部不命中 → 更新文档。

## 七类文档分治

前三类是仓库内工作上下文（供在本仓库开发的 Agent）；后四类面向项目的使用者与贡献者——读者可能是人，也可能是 Agent，llms.txt 即 Agent 侧的导航入口：

| 文档 | 更新方式 | 细则 |
|---|---|---|
| AGENTS.md | 识别变更 → 增量修订 → 版本号语义化递增 → 一致性传播检查 | `references/agents-md-protocol.md` |
| ARCH.md | 按固定八章节定位修改；不存在时用模板初始化 | `references/arch-md-structure.md`、`assets/arch-template.md` |
| DESIGN.md | 仅初始化时调 impeccable 技能生成；已存在时把 design.md 影响面传给 impeccable，由其增量更新 | impeccable 技能 |
| README.md | 按需更新：触发判据命中才更新；不存在则直接初始化 | `references/outward-docs.md` |
| llms.txt | 按需更新：与 README 导航同触发，按 llmstxt.org 规范维护；不存在则直接初始化 | `references/outward-docs.md` |
| 用户使用说明 | 按需更新：触发判据命中才更新；不存在则直接初始化 | `references/outward-docs.md` |
| 技术开发说明 | 按需更新：触发判据命中才更新；不存在则直接初始化 | `references/outward-docs.md` |

七类文档按影响面各自独立判断，一次 commit 可能只动一个或都不动。

## 写入策略

- 直接写入，不需用户确认
- 唯一例外：重大架构调整先提示后写。判据（任一命中即重大）：系统分层变化、核心设计决策被推翻、技术栈替换

## 文件关系

- AGENTS.md 是唯一主源，本技能只写 AGENTS.md
- 根目录 CLAUDE.md 是指向 AGENTS.md 的软链，改主源自动生效
- 检测到 CLAUDE.md 为实体文件而非软链：不擅自转换，提示用户人工处理

## Rationalizations

| 借口 | 纠正 |
|---|---|
| "改动很小，文档下次一起更新" | 下次永远不来。增量机制就是为了让每次都小到没有借口 |
| "整个重写一遍更干净" | 增量修订，定位到章节。重写破坏版本史与引用锚点 |
| "顺手优化其他章节" | 本次变更不涉及的章节一个字不动 |
| "CLAUDE.md 也改一遍保险" | 只改 AGENTS.md。改两处必出分叉 |
| "影响面我记得，不用读契约" | 以 verified story 的 AC/非目标 + design.md 影响面 + 实际 diff 为准 |
| "story 没 verified，文档先写上" | 未验收的实现不进文档 |
| "用户文档里讲讲实现原理更清楚" | 读者视角铁律：用户文档零实现细节；开发文档链接 ARCH.md，不复制 |
| "使用/开发文档不存在，先跳过吧" | 触发命中而文档不存在 = 直接初始化，不等待用户发起 |
| "README 里把使用说明全写一遍" | README 是门面：定位 + 快速开始 + 导航链接，详情归 docs |
| "Agent 看 README 就行，llms.txt 多余" | llms.txt 是机读规范：固定节序可解析，Optional 节支持上下文裁剪 |
| "约定写成'尽量遵守'比较灵活" | 不可检验的约定约束不了任何 Agent。必须 / 应当（附例外条件）/ 可以，三级措辞 |

## Verification — commit 前自检

- [ ] 更新依据 = verified story（AC/非目标）+ design.md 影响面 + 实际 diff
- [ ] AGENTS.md 已过写入前校验：版本语义定级、条目可检验无模糊词、同步影响报告与传播检查完成
- [ ] ARCH.md 八章节结构未变，本次变更不涉及的章节未触碰
- [ ] 使用 / 开发说明未混入对方视角：用户文档零实现细节，开发文档未复制 ARCH / AGENTS 内容
- [ ] README 未膨胀为手册：超出快速开始深度的内容已链接 docs
- [ ] llms.txt 节序符合规范且与 docs 实际结构一致，README 导航同次更新
- [ ] CLAUDE.md 未被直接修改
- [ ] 重大架构调整已先经用户确认
- [ ] 文档与代码同一次 commit 提交

---

> 安装说明见 `INSTALL.md`（面向人类，不属于技能上下文）。
