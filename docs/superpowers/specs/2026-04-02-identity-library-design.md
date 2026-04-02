# 身份库（Identity Library）设计文档

## 概述

在谨迹 app 中新增"身份库"功能，统一管理人物信息与声纹档案。身份库以 markdown 文件为载体，与日志系统共享相同的 frontmatter 规范。录音识别出新说话人时自动创建身份文档，用户可手动编辑、合并身份。

现有的 `SoulView`（AI 人格视图）升级为 `IdentityView`（身份库视图），AI 人格作为置顶的特殊身份展示，用户自身也置顶，其余为普通身份列表。

---

## 1. 数据层

### 1.1 文件结构

```
workspace/identity/
  AI-谨迹.md              # ← 不存在于文件系统，AI 人格走独立 Soul 存储
  我-Francis.md            # 用户自身，置顶，不可删除
  未知-说话人1.md
  广州-张三.md
  华工-李四.md
  趣丸-王五.md
  raw/
    speaker_profiles.json  # 声纹向量数据
    <speaker_id>_001.m4a   # 声音切片
    <speaker_id>_002.m4a
```

### 1.2 文件命名规则

格式：`地域-姓名.md`

- 地域越精准越好（公司名 > 城市 > 省份）
- 新声纹自动创建时默认 `未知-说话人N.md`
- 用户通过重命名文件来修正地域和姓名
- 示例：`广州-张三.md`、`华工-李四.md`、`趣丸-王五.md`

### 1.3 Frontmatter 规范

```yaml
---
summary: 趣丸科技产品负责人，主要对接 AI 平台项目
tags: [客户, AI平台]
speaker_id: abc-123-uuid
---

# 张三

自由记录区域。
```

字段说明：
- `summary`：一句话描述（与日志 frontmatter 一致）
- `tags`：标签数组（复用日志标签体系）
- `speaker_id`：关联 `speaker_profiles.json` 中的声纹 ID（可选，无声纹的人物此字段为空）

### 1.4 声纹数据

`speaker_profiles.json` 直接创建在 `workspace/identity/raw/` 下（无迁移逻辑，声纹识别与身份库同版本上线）。

结构与现有 `speaker_profiles.rs` 中的 `SpeakerProfile` 一致：

```json
[
  {
    "id": "uuid",
    "name": "",
    "auto_name": "说话人 1",
    "embeddings": [[...], [...]],
    "created_at": 1234567890,
    "last_seen_at": 1234567890,
    "recording_count": 3
  }
]
```

### 1.5 声音切片

录音识别后，每个说话人对应的音频片段存为 `raw/<speaker_id>_NNN.m4a`，NNN 为自增序号。

### 1.6 特殊身份

| 身份 | 存储方式 | 可删除 | 置顶 |
|---|---|---|---|
| AI 人格（Soul） | 独立 Soul 存储（现有逻辑不变） | 否 | 是，第一位 |
| 用户自身 | `workspace/identity/我-XXX.md` | 否 | 是，第二位 |
| 普通身份 | `workspace/identity/地域-姓名.md` | 是 | 否 |

---

## 2. Rust 后端

### 2.1 新增 `identity.rs` 模块

**结构体：**

```rust
pub struct IdentityEntry {
    pub filename: String,        // "广州-张三.md"
    pub path: String,            // absolute path
    pub name: String,            // "张三"
    pub region: String,          // "广州"
    pub summary: String,         // from frontmatter
    pub tags: Vec<String>,       // from frontmatter
    pub speaker_id: String,      // from frontmatter, 可为空
    pub mtime_secs: i64,         // Unix timestamp for sorting
}
```

**核心函数：**

- `parse_identity_filename("广州-张三.md")` → `Some(("广州", "张三"))`
- `list_identities(workspace)` — 扫描 `workspace/identity/*.md`，解析 frontmatter，按 `mtime_secs` 降序排列
- `get_identity_content(path)` → 文件内容
- `save_identity_content(path, content)` → 保存
- `delete_identity(path)` → 删除文件
- `create_identity(workspace, region, name, speaker_id)` → 创建空白身份文档，写入 frontmatter

### 2.2 改造 `speaker_profiles.rs`

- `profiles_path()` 改为指向 `workspace/identity/raw/speaker_profiles.json`（需要 workspace 路径参数）
- `identify_or_register_all()` 新增逻辑：
  1. 注册新声纹时，调用 `identity::create_identity(workspace, "未知", "说话人N", speaker_id)` 创建 markdown
  2. 把该说话人的音频切片存为 `raw/<speaker_id>_NNN.m4a`

### 2.3 Tauri commands

新增：
- `list_identities` — 返回 `Vec<IdentityEntry>`
- `get_identity_content(path)` — 返回文件内容
- `save_identity_content(path, content)` — 保存文件
- `delete_identity(path)` — 删除身份（特殊身份拒绝删除）
- `merge_identity(source_path, target_path, mode)` — 合并身份，source_path/target_path 为文件绝对路径，mode 为 `"voice_only"` 或 `"full"`

### 2.4 合并逻辑（`merge_identity`）

**mode = `"voice_only"`（仅声纹合并）：**
1. 声纹 embeddings 从源 profile 合入目标 profile
2. 声音切片文件重命名为目标 speaker_id 前缀
3. 目标 recording_count 累加
4. 删除源 speaker profile
5. 删除源身份文档（`未知-说话人N.md`）

**mode = `"full"`（整合合并）：**
1. 执行上述声纹合并全部步骤（1-4）
2. 读取源文档和目标文档内容
3. 调用 AI 引擎整合两份文档内容
4. 将 AI 整合结果写入目标文档
5. 删除源身份文档

---

## 3. 前端

### 3.1 视图入口

- `Cmd+P` 从 `SoulView` 升级为 `IdentityView`
- `view` 状态值从 `'soul'` 改为 `'identity'`
- `App.tsx` 中对应的路由和状态管理同步更新

### 3.2 IdentityView 布局

复用日志的左列表 + 右详情结构：

**左侧列表：**

每个条目包含：头像 + 姓名 + summary + tags。

头像规则：
- Soul → 固定显示「AI」，绿色底（`rgba(90,154,106,0.15)`，字色 `#5a9a6a`）
- 用户自身 → 固定显示「我」，金色底（`rgba(200,147,58,0.15)`，字色 `#c8933a`）
- 普通身份 → 姓名首字，灰色底（`rgba(255,255,255,0.06)`）
- 未知身份 → 姓名首字，淡灰底（`rgba(255,255,255,0.04)`）

列表分区：
- 置顶区：Soul + 用户自身，中间无分隔，与下方普通区用 6px 深色间隔分开
- 普通区：以地域为分组头（小字灰色，类似日志列表的月份分组），分组内只显示姓名（不重复地域前缀）
- 标签渲染和日志列表一致

**右侧详情：**

- 默认只读：完全复用日志的 `DetailPanel` markdown 渲染（summary + tags 顶部 + markdown 正文）
- 右上角「编辑」按钮：点击进入 textarea 编辑原始 markdown（含 frontmatter），自动保存（debounce 800ms），编辑态显示「保存」按钮退出编辑
- 详情面板不放任何其他操作按钮（无删除、无合并）

**列表右键菜单：**

- 合并到… — 触发合并流程（无 speaker_id 的身份隐藏此选项）
- 删除 — 删除身份文档（Soul 和用户自身隐藏此选项）

### 3.3 合并交互

1. 列表中右键点击身份条目，选择"合并到..."
2. 弹出身份选择列表（排除自身和特殊身份），每个条目显示头像 + 姓名 + summary
3. 选择目标身份后，弹出合并方式选择：
   - **仅声纹合并** — 声纹 + 切片归入目标，源文档删除
   - **整合合并** — 声纹 + 切片归入目标，AI 引擎整合两份文档内容到目标，源文档删除
4. 确认后执行，完成后自动选中目标身份

### 3.4 设置页变更

- `SectionSpeakers.tsx`：移除，声纹管理功能收归 IdentityView
- `SectionVoice.tsx`：保留语音引擎配置，去掉声纹相关 UI

### 3.5 新增 TypeScript 类型

```typescript
export interface IdentityEntry {
  filename: string       // "广州-张三.md"
  path: string           // absolute path
  name: string           // "张三"
  region: string         // "广州"
  summary: string        // from frontmatter
  tags: string[]         // from frontmatter
  speaker_id: string     // 关联声纹 ID，可为空
  mtime_secs: number     // Unix timestamp for sorting
}

export type MergeMode = 'voice_only' | 'full'
```

### 3.6 Tauri IPC 新增（`src/lib/tauri.ts`）

- `listIdentities()` → `IdentityEntry[]`
- `getIdentityContent(path)` → `string`
- `saveIdentityContent(path, content)` → `void`
- `deleteIdentity(path)` → `void`
- `mergeIdentity(sourcePath, targetPath, mode)` → `void`

---

## 4. 自动创建流程

录音识别完成时的完整流程：

1. 音频录制完成，进入转写流程
2. 声纹识别提取 speaker embeddings
3. `identify_or_register_all()` 对每个说话人：
   - 匹配到已有 profile → 更新 stats + 存声音切片
   - 未匹配 → 创建新 speaker profile + 创建 `未知-说话人N.md` + 存声音切片
4. 转写结果中的说话人标签替换为身份库中的显示名
5. AI 引擎生成日志条目

---

## 5. Workspace 脚本

### 5.1 新增 `identity-create` 脚本

路径：`workspace-template/.claude/scripts/identity-create`

用途：AI 引擎在整理日志时遇到"未知-说话人N"，可调用此脚本创建/更新身份文档。

```bash
# 用法
.claude/scripts/identity-create "地域" "姓名" [--speaker-id UUID]

# 示例
.claude/scripts/identity-create "广州" "张三" --speaker-id abc-123
```

行为：
- 在 `workspace/identity/` 下创建 `地域-姓名.md`
- 写入基础 frontmatter（空 summary、空 tags、speaker_id）
- 如果同名文件已存在，不覆盖，返回已有文件路径
- 输出创建的文件绝对路径（供 AI 引擎后续编辑）

### 5.2 优化 `recent-summaries` 脚本

路径：`workspace-template/.claude/scripts/recent-summaries`

现有行为：扫描 `yyMM/*.md` 获取最近 N 条日志的 summary。

新增行为：在日志 summary 之后，追加输出所有身份文档的 summary。

输出格式变更：

```
=== 最近日志 ===
1. 2604/02-产品评审会议.md
   > 核心结论。背景与约束。
2. 2604/01-周会纪要.md
   > ...

=== 身份档案 ===
1. identity/广州-张三.md
   > 趣丸科技产品负责人
2. identity/华工-李四.md
   > 华工计算机学院研究生
```

无 summary 的身份文档直接过滤不输出（兜底逻辑，正常情况下不会出现，因为 `identity-create` 创建时会生成默认 summary）。

### 5.3 更新 CLAUDE.md

在 workspace 模板的 `CLAUDE.md` 中补充身份库相关指引：

- 说明 `identity/` 目录结构和文件命名规则
- 指导 AI 遇到未知说话人时调用 `identity-create` 脚本
- 指导 AI 从素材中提取人物信息补充身份文档

---

## 6. 不做的事情

- 不做 `speaker_profiles.json` 迁移（同版本上线）
- 不做拖拽合并（后续迭代）
- AI 人格不存为 markdown 文件（保持独立 Soul 存储）
- 不做跨 workspace 的身份共享
- 不做人物搜索（后续迭代）
