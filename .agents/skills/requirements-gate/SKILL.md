---
name: requirements-gate
description: "需求门禁（Requirements Gate）——只要用户提出开发需求或变更请求（实现 / 新增 / 开发 / 加一个 / 修改 / 重构 / 优化 / 接入 / 修复 / add / implement / build / feature / fix），哪怕措辞很随意，且该任务还没有 status: approved 的 story.md，就必须在写任何代码之前使用本技能。不要因为需求看起来很简单而跳过。"
---

# 需求门禁 Requirements Gate

把模糊的开发需求逼成一份无歧义、**纯用户视角**的 story.md：只回答"谁、在做什么事、现状为何失败、做完后什么变了、不做什么"，不碰"怎么实现"。实现方案（技术选型、接口、NFR、依赖、架构）交给下游 brainstorming 产出 design.md。

**核心原则——用户视角校准**：任何描述方案的输入（"做一个 X 功能""加 Y 按钮"）必须先反推到用户问题。脊柱不通过，不进解决方案讨论。这是本技能与"PRD 润色 prompt"的根本区别。

## 两层分工

| 文件 | 视角 | 谁产出 | 内容 |
|---|---|---|---|
| **story.md** | 用户视角（"要什么"） | 本技能 + 用户确认 | 用户故事、背景与失败模式、成功标准、GWT 验收、三类边界 |
| **design.md** | 实现视角（"怎么做"） | brainstorming / 开发阶段 | 方案选型与 tradeoff、接口/数据契约、NFR、技术异常分支、架构决策 |

归属铁律：**"不做什么"是 story（用户意图），"怎么实现这个不做"是 design**。例：「不为大客户启用」写 story 非目标；「has_dedicated_cs=true 跳过」的实现写 design。需实现知识才能回答的问题（用什么存储、如何回滚、接口长什么样），不在本技能职责内——记入交棒清单，转 design.md。

## 整体流程

```
入口路由 ──→ (BRIDGE) ──→ 脊柱五问 ──→ 输出闸 ──→ story.md
   │                      forcing gate    hard gate
   │                      (拦方案/拦泛指)  (拦越界/拦模糊)
   └─ KPI/数字目标走 BRIDGE，其余直入脊柱
```

三道关卡缺一不可，强度由分级调节，但**没有任何一级可以跳过脊柱 Q1 与 Q5、跳过输出闸**。

## 五种翻车 → 五道防线

PM 输入的五种典型翻车，本技能逐一设防（完整识别信号与处理见 `references/failure-modes.md`）：

| 翻车原型 | 信号 | 防线 |
|---|---|---|
| A 解决方案当需求 | "做一个 X 功能""加 Y 按钮""老板说" | 脊柱 Q1 拒绝方案 → 反推 JTBD |
| B 用户=所有人 | "用户希望""很多用户反馈"，无定语 | 脊柱 Q1 连环追问到具体角色+场景 |
| C 业务目标硬转译 | KPI/OKR/"提升 X% 留存"直接接需求 | 入口 BRIDGE：强制 ≥2 行为变化假设 |
| D AI 自由发挥 | 没写"不做的事"，AI coding 越界生成 | 输出闸：Won't 是模板必填字段 |
| E 看起来全但模糊 | 8 页 PRD，"更方便""性能良好""体验流畅" | 输出闸：INVEST 6/6 + GWT 硬门 |

## 分级（强度调节，与脊柱正交）

分级决定**问多深**，脊柱决定**问什么**。两者正交：

| 级别 | 适用 | 脊柱与输出闸 |
|---|---|---|
| **L0 跳过** | 非开发请求；已有 approved story 的延续；用户标注 `[skip-gate]` | 忽略门禁 |
| **L1 轻量** | 琐碎修复：typo、改文案、单行 bug、配置 | 脊柱快速走（Q1/Q4/Q5 必答，Q2/Q3 可一句话带过）；输出闸照跑 |
| **L2 标准** | 常规新功能 / 功能变更 | 完整脊柱五问 + 输出闸 |
| **L3 深度** | 触碰数据契约 / 权限 / 计费 / 对外 API / 不可逆迁移 / 跨团队指标 | 完整脊柱 + 多角色分派（`references/review-dimensions.md`）+ 输出闸。这些高风险维度属实现层，门禁只**识别并标记**到交棒清单 |

拿不准取高不取低。

## 交互模式

- **默认（详细模式）**：脊柱每问追问到位，适合新手 PM 或重要需求
- **快模式**：PM 一次给完整输入 → 直接生成 story 草稿 + 标注疑点 → PM 补全。用户说"快模式""我赶时间"触发。**输出闸仍跑——快模式可省追问，不能省质量底线**

## 流程详解

### Step 0 — 入口路由

判断 PM 输入是哪类，决定从哪进（完整规则 `references/entry-routing.md`）：

| 入口 | 信号 | 路由 |
|---|---|---|
| 业务目标 | 含 KPI / 数字目标 | 先走 **BRIDGE**（`references/bridge-step.md`），再进脊柱 |
| 草稿体检 | 已有 PRD 草稿 | 对照脊柱扫描，缺哪问追哪问 |
| 模糊想法 / 用户反馈 | 短句、转述、零散反馈 | 直入脊柱 Q1 |

### Step 1 — 上下文收集（检索先于评审）

优先用 `rga` 检索：仓库内相关模块/接口/配置；`stories/` 及 brainstorming 输出目录下的历史 story.md / design.md；AGENTS.md / docs 既有约定。证据（文件路径+一句话结论）写入 story 背景节。检索为空也是信息——全新领域，假设风险更高。

### Step 2 — 脊柱五问（forcing gate）

任何路径最终都要走完五问，缺一不可（完整 prompt、追问规则、PM 答非所问的拦截见 `references/spine-prompts.md`）：

| # | 问题 | 通过标准 | 锚定 |
|---|---|---|---|
| Q1 | 谁 + 在做什么事 | 具体角色（不是"用户"）+ 具体场景（不是"使用产品时"） | JTBD |
| Q2 | 现在怎么解决 | ≥1 条现有路径（"放弃"也算） | — |
| Q3 | 为什么失败 | 具体失败模式，不接受"体验差""不方便" | 5 Whys |
| Q4 | 做完后什么变了 | 可观察的用户行为指标 + 数字目标 | Outcomes |
| Q5 | 不为谁、不做哪些场景、不解决哪些相关问题 | 三类边界都要答 | MoSCoW |

**Iron Law：Q1 不通过不进 Q2。** 任何 Q 答得抽象，必须重述、追问、不放行。Q1 拦截不是 block 一次，而是 block + JTBD 重述 + 展开方案空间——让 PM 看到"原来不止那一种解法"，这是本技能的核心价值瞬间。

### Step 3 — 归类实现层缺口

脊柱过程中冒出的实现层问题（用什么存储、如何回滚降级、性能上限、依赖哪些系统），**不在 story 里拍板**——按 `references/handoff-checklist.md` 归类，记入 story 交棒清单转 design.md。门禁的价值是不让实现层缺口被忽略，而非替用户和 AI 做实现决策。

### Step 4 — 输出闸（hard gate）

生成 story 前必须通过（完整审计逻辑 + 修复建议库 `references/invest-audit.md`）：

1. **INVEST 审计**：每条用户故事 + 每条验收标准跑 INVEST 6 项 + GWT 可测试性。任一 fail 不放行
2. **Won't 必填**：story 三类边界段落不能空。空 = fail
3. **失败处理**：哪项 fail 回对应步骤改，不接受"先这样吧"

### Step 5 — 产出 story.md

用 `assets/story-template.md`。存放位置跟随 brainstorming 输出约定，皆无约定时默认 `stories/<YYYYMMDD>-<slug>/story.md`，design.md 同目录。初始 `status: clarifying`。

story 写作双重职责：**背景讲故事（人读友好）+ AC 用 GWT（机读可测）**。验收标准规则：
- 用 Given-When-Then 写，且是**用户可观察行为**，不含实现手段（技术状态的 GWT——如 LLM 超时 fallback——交棒 design）
- 编号 AC-1、AC-2… 一旦发出不复用不重排，废弃标 `[已废弃]`
- AC + 三类边界共同界定范围：AC 给下游验收判"不漏/不少"，边界判"不多"

### Step 6 — 门禁判定与交棒

向用户输出（一屏内）：readiness 等级（`草稿`/`待澄清`/`可开发`，定义见 `references/review-dimensions.md`）；最优先 3–5 个意图层缺口；需用户拍板的问题；交棒清单（移交 design.md 的实现层问题）。

用户确认后 `status` 改为 `approved`。**approved 之前不写实现代码。** 随后：

- 方案细化与开发：交 brainstorming 产出 design.md，再接 writing-plans（或 spec-kit `/plan`），把 story.md 与 design.md 路径写进计划首行
- 开发完成后：commit 前由 **verification-gate** spawn 独立 subAgent，以 story 的 AC 与边界核对"做的是不是用户要的"、design 范围核对"有没有做多/偏"，产出 verify-report.md；通过后翻 `verified`

## 端到端走查

三条主路径的完整对话样例见 `references/walkthroughs.md`，演示脊柱如何连环拦截、BRIDGE 如何强制、输出闸如何修复——拿不准某一步的手感时去读对应走查：

| 走查 | 入口 | 演示 |
|---|---|---|
| A | 模糊想法 | 老板说"做个 AI 助手" → Q1 拦方案 + 拦泛指 → 重述真实问题展开解空间 → story |
| C | KPI 目标 | "次留 +5%" → BRIDGE 强制 ≥2 假设 → 对比解空间锁定 → 转译进脊柱 |
| E | 草稿体检 | 8 段模糊 PRD → 脊柱扫描戳破篇幅假象 → 输出闸逼出 GWT 与边界 |

## Rationalizations — 想抄近道时读这里

| 借口 | 纠正 |
|---|---|
| "做一个 X 功能"就是需求 | X 是方案不是需求。脊柱 Q1 拒绝方案输入，反推到"谁+在做什么事+为何失败" |
| "用户希望……"够具体了 | "用户"不是角色。追到"哪类用户+在做什么事"，否则落入 B 翻车 |
| "提升 X% 指标"直接做 | KPI 是结果不是需求。进 BRIDGE 强制 ≥2 假设，看见"选错假设=做错产品" |
| 跳过 Q3 直接谈方案 | 不回答"为什么现状失败"，方案就是无的放矢 |
| 把"体验更好"写进验收 | 改成 GWT，给可测条件和数字阈值，否则输出闸 fail |
| 顺手把实现方案写进 story | story 只写"要什么"。实现进交棒清单 → design.md，混进来就是越层 |
| Won't 段落先空着 | Won't 是给 AI coding 的护栏，必填，空 = 输出闸 fail |
| 快模式跳过 INVEST | INVEST 永远是 hard gate。快模式省追问，不省质量底线 |
| PM 给一个假设就走完 BRIDGE | 强制 ≥2，对比解空间——一个假设看不见机会成本 |
| "我理解用户的意思了" | 理解 ≠ 共识。写下来被用户确认过的才是共识 |

## Verification — status 改为 approved 前自检

- [ ] 脊柱五问全部通过：Q1 具体角色+场景，Q3 具体失败模式，Q4 有数字目标，Q5 三类边界齐
- [ ] story.md 全文无实现细节：GWT 是用户可观察行为，未混入技术手段
- [ ] 实现层缺口已归入交棒清单，未在 story 里擅自拍板
- [ ] 输出闸通过：每条 AC 跑过 INVEST 6/6 + GWT 可测；Won't 非空
- [ ] 行为变化假设标注了依据（data / 直觉），直觉假设注明验证方式
- [ ] 所有判断带 `[证据]`/`[推测]` 标注
- [ ] 用户明确说了"确认/通过/可以开发"——沉默不等于确认

## 方法论锚点

脊柱 Q1=JTBD（Christensen）；Q2-3=5 Whys（Toyota）；BRIDGE=Opportunity Solution Tree（Teresa Torres）；用户故事=Connextra+INVEST（Bill Wake）；验收=GWT/BDD（Dan North）；边界=MoSCoW（DSDM）。

---

> 安装与 hook 注册说明见同目录 `INSTALL.md`（面向人类读者，不属于技能上下文）。
