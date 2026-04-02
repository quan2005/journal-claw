# 声纹-身份自动关联设计

## 问题

当前声纹识别和人物身份是两条独立链路：

1. **录音链路**：声纹匹配 → 自动创建 speaker_profile + 空白 identity 文件（"说话人 N"）
2. **AI 链路**：Claude 从内容识别人物 → 调用 `identity-create` 创建身份文件（无声纹）

两条路各走各的，唯一的连接方式是用户手动合并。结果是大量"说话人 N"垃圾文件，以及有名有姓但没声纹的身份档案。

## 设计

### 核心变更

**声纹注册不再创建 identity 文件。** speaker_profiles.json 是纯技术层，只存 embedding 和匹配逻辑。身份文件的创建权完全交给 AI。

**AI 拿到完整信息后一步到位。** 转录稿附带 speaker_id，AI 识别出真实人名后，创建身份时直接关联声纹。

### speaker_id 格式

- 五位零填充自增整数：`00001`、`00002`、`00003`...
- 新建 profile 时取当前最大值 +1
- 替代现有 UUID 格式（未上线，无需迁移）

### 改动后的完整流程

```
录音
  → 声纹提取 d-vector
  → speaker_profiles 匹配/新建（只维护 embedding，不创建 identity 文件）
  → 转录稿生成，说话人标签使用 speaker_id：
      "00003: 我觉得这个方案可以..."
      "00007: 嗯，同意..."
  → 转录稿 + 素材交给 AI 处理

AI 处理
  → 从内容识别出 "00003 是张三"
  → 检查 identity/ 下是否已有张三
    → 没有：调用 identity-create "广州" "张三" --speaker-id 00003
    → 已有但无声纹：调用 identity-link 00003 广州-张三.md
    → 已有且声纹不同：调用 identity-link 00003 广州-张三.md（合并声纹）
  → 无法识别的说话人（只说了"嗯""好的"）：不处理，声纹 profile 留着等下次
```

### 边界情况：已知人物声纹没匹配上

场景：张三换了麦克风/嗓子状态不同，声纹匹配失败，分配了新的 speaker_id `00012`。

处理：AI 从内容识别出这是张三 → 调用 `identity-link 00012 广州-张三.md` → Rust 侧将 `00012` 的 embedding 合并到张三已有的 speaker_profile → 张三的声纹库更新，下次匹配更准。

合并后 `00012` 这个 profile 被吸收，后续不再独立存在。

### 边界情况：完全无法识别的说话人

场景：录音中有人只说了"嗯"、"好的"，AI 无法判断身份。

处理：不创建 identity 文件。speaker_profile 保留 embedding 数据，等下次此人再出现且有更多信息时再关联。

## 具体改动

### 1. speaker_profiles.rs

- `SpeakerProfile.id`：从 UUID 改为五位自增整数字符串
- `identify_or_register_all()`：删除调用 `create_identity_file()` 的逻辑
- 新增 `next_speaker_id()`：扫描现有 profiles 取 max + 1，零填充到五位
- `merge_speaker_profiles()`：合并后删除被吸收的 source profile

### 2. 转录稿格式

转录稿中说话人标签从显示名改为 speaker_id：

```
00003: 我觉得这个方案可以推进了
00007: 嗯，我同意，但时间线要再确认一下
00003: 好，我来跟进
```

### 3. AI 脚本

**更新 `identity-create`**：
- 新增 `--speaker-id` 参数
- 创建 identity 文件时将 speaker_id 写入 frontmatter
- 如果文件已存在，返回已有路径（幂等，不覆盖）

**新增 `identity-link`**：
```bash
.claude/scripts/identity-link <speaker_id> <identity_path>
```
- 读取目标 identity 文件的现有 speaker_id
- 调用 Rust 侧合并声纹逻辑（将新 speaker_id 的 embedding 合并到已有 profile）
- 更新 identity 文件的 speaker_id 字段（如果之前为空则写入，如果不同则合并后写入主 profile 的 id）

### 4. CLAUDE.md 指令更新

告诉 AI 新的工作流程：
- 转录稿中的数字编号是 speaker_id，代表不同说话人
- 从内容推断说话人身份后，用 `identity-create --speaker-id` 创建新身份
- 如果说话人是已有人物，用 `identity-link` 关联声纹
- 无法识别的说话人不要创建身份文件

### 5. 前端

无需改动。identity 文件的创建和声纹关联都在后端完成，前端通过现有事件机制刷新。
