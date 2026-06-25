# 学习条目格式

每条学习记录追加到 `.claude/learnings/LEARNINGS.md`，格式如下。

## 条目结构

```markdown
## [LRN-YYYYMMDD-XXX] category

**Status**: active | promoted | resolved
**Area**: meeting | identity | frontmatter | summary | preference | general

### 摘要
一句话描述学到了什么

### 详情
完整上下文：发生了什么、哪里错了、正确做法是什么

### 行动
下次遇到类似情况应该怎么做

### 元数据
- 来源：user_correction | self_check | error
- 相关文件：path/to/file
- 关联条目：LRN-YYYYMMDD-XXX
```

## 字段说明

### ID 格式

`LRN-YYYYMMDD-XXX`
- `YYYYMMDD`：记录日期
- `XXX`：当天序号，从 001 开始

### Category

| 值 | 含义 | 典型触发 |
|---|---|---|
| `correction` | 用户明确纠正了处理结果 | "不对"、"搞错了"、"应该是 X" |
| `preference` | 用户表达了持久性偏好 | "以后都这么做"、"别用那种格式" |
| `pattern` | 从多次处理中归纳出的规律 | 自检发现、跨素材对比 |
| `error` | 处理失败或质量明显不达标 | 命令报错、输出不符预期 |

### Status

| 值 | 含义 |
|---|---|
| `active` | 当前有效，处理素材前应回顾 |
| `promoted` | 已晋升为 CLAUDE.md 规则，不再需要逐条回顾 |
| `resolved` | 问题已不再相关（如工作流变更） |

### Area

| 值 | 对应场景 |
|---|---|
| `meeting` | 会议纪要整理（类型判断、模板选择、引用原则） |
| `identity` | 人物/产品档案（建档判断、维度填充、更新策略） |
| `frontmatter` | YAML frontmatter 格式（tags、summary、sources） |
| `summary` | 摘要质量（信息量、结论先行、长度） |
| `preference` | 用户个人偏好（格式、风格、用词） |
| `general` | 不属于以上任何类别 |

## 示例

### 用户纠正（correction）

```markdown
## [LRN-20260424-001] correction

**Status**: active
**Area**: meeting

### 摘要
分享会不应使用 argumentation-chain 模板

### 详情
用户提交了一段技术分享会录音，我判断为"决策会"并使用了 argumentation-chain 模板。
用户纠正：这是分享会，应该用 knowledge-distillation 模板。
错误原因：分享会中有少量提问互动，被我误判为"多方参与的分歧讨论"。

### 行动
判断会议类型时，区分"提问互动"和"分歧讨论"：
- 提问互动：一人主讲 + 听众提问 → 分享会（knowledge-distillation）
- 分歧讨论：多方各持立场 + 需要达成共识 → 决策会（argumentation-chain）

### 元数据
- 来源：user_correction
- 相关文件：2604/15-技术分享会.md
```

### 用户偏好（preference）

```markdown
## [LRN-20260424-002] preference

**Status**: active
**Area**: summary

### 摘要
用户要求 summary 不超过两句话

### 详情
用户反馈 summary 写得太长（四五句话），要求精简到一两句。
核心结论放第一句，必要的背景约束放第二句，其余删掉。

### 行动
写 frontmatter summary 时严格控制在 1-2 句。如果一句能说清就不写第二句。

### 元数据
- 来源：user_correction
- 相关文件：无
```

### 自检发现（pattern）

```markdown
## [LRN-20260424-003] pattern

**Status**: active
**Area**: identity

### 摘要
录音转写中仅说"嗯""好的"的 speaker_id 不应建档

### 详情
连续三次处理录音素材时，都为只说了附和词的 speaker_id 创建了空档案。
这些档案没有任何有用信息，增加了 identity/ 目录的噪音。

### 行动
声纹 ID 对应的发言如果只有附和词（嗯、好的、对、是的），跳过建档。
等后续素材中该 ID 有实质性发言时再建。

### 元数据
- 来源：self_check
- 关联条目：LRN-20260420-001, LRN-20260422-003
```
