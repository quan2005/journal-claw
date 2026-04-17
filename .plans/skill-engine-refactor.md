# Skill & @ 文件引擎重构

## 设计哲学

把智能交给 LLM，系统只提供工具。不做路径解析、不做内容预注入、不做音频转写内联。

## 改动总览

### Phase 1: Rust 后端 — enable_skill 工具 + 统一逻辑

#### 1.1 新增 `src-tauri/src/llm/enable_skill.rs`

新模块，提供 enable_skill 工具的定义和执行逻辑：

```rust
// tool definition — 注册到 Anthropic API 的 tools 数组
pub fn definition() -> ToolDefinition {
    // name: "enable_skill"
    // description: "读取并激活一个 skill。返回 SKILL.md 的完整路径和主体内容。"
    // input_schema: { name: string (required) }
}

// execute — 接收 { name: "ideate" }，扫描 project → global skill 目录
pub async fn execute(input: &serde_json::Value, workspace: &str) -> ToolResult {
    // 1. 从 input 提取 name
    // 2. 搜索 <workspace>/.claude/skills/<name>/SKILL.md
    // 3. 搜索 ~/.claude/skills/<name>/SKILL.md
    // 4. 找到 → 返回 { path, content }
    // 5. 未找到 → 返回 error + 可用 skill 列表
}
```

#### 1.2 修改 `src-tauri/src/llm/mod.rs`

添加 `pub mod enable_skill;`

#### 1.3 修改 `src-tauri/src/llm/tool_loop.rs`

三处改动：

1. `MAX_TURNS: 30` → `60`
2. `tools` 数组添加 `enable_skill::definition()`
3. tool 执行 match 分支添加 `"enable_skill"` → `enable_skill::execute(input, workspace)`

#### 1.4 修改 `src-tauri/src/llm/prompt.rs`

1. **删除** `resolve_skill_from_prompt()` 函数（整个函数 + 相关测试）
2. **修改** `build_system_prompt()` 签名：移除 `skill_prompt: Option<&str>` 参数
3. **删除** 第 6 部分（"当前激活的 Skill" 注入）
4. **修改** 第 4 部分（skill 清单）的提示文案：
   - 旧：`"使用 /skill-name 激活对应能力。"`
   - 新：`"当用户提到 /skill-name 或你判断需要某个 skill 时，调用 enable_skill 工具读取其内容。"`

#### 1.5 修改 `src-tauri/src/ai_processor.rs`

`process_material_builtin()` 函数中：

1. **删除** `resolve_skill_from_prompt()` 调用（约第 460 行）
2. **修改** `build_system_prompt()` 调用：移除 `skill_content.as_deref()` 参数
3. **修改** `run_agent()` 调用：将原始 `user_prompt`（含 `/skill-name`）直接传入，不再传 `cleaned_prompt`

变更前：
```rust
let (cleaned_prompt, skill_content) =
    llm::prompt::resolve_skill_from_prompt(&workspace, &user_prompt).await;
let system_prompt = llm::prompt::build_system_prompt(
    &workspace, WORKSPACE_CLAUDE_MD, skill_content.as_deref(),
).await;
// ... run_agent(..., &cleaned_prompt, ...)
```

变更后：
```rust
let system_prompt = llm::prompt::build_system_prompt(
    &workspace, WORKSPACE_CLAUDE_MD,
).await;
// ... run_agent(..., &user_prompt, ...)
```

#### 1.6 修改 `src-tauri/src/conversation.rs`

`run_conversation_turn()` 函数中：

1. Agent 模式的 tools 数组添加 `enable_skill::definition()`
2. `max_turns` Agent 模式：`30` → `60`
3. tool 执行 match 分支添加 `"enable_skill"` → `enable_skill::execute(input, workspace)`

### Phase 2: 新增 Tauri IPC — 目录浏览

#### 2.1 新增 `list_workspace_dir` 命令

在 `src-tauri/src/skills.rs`（或新建 `workspace_browse.rs`）中添加：

```rust
#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,  // workspace 相对路径
}

#[tauri::command]
pub fn list_workspace_dir(app: AppHandle, relative_path: String) -> Result<Vec<DirEntry>, String> {
    // 1. 拼接 workspace_path + relative_path
    // 2. 安全检查：确保不逃逸出 workspace
    // 3. 读取目录，返回 name + is_dir + 相对路径
    // 4. 排序：目录在前，文件在后，各自按名称排序
    // 5. 过滤隐藏文件（.开头）和 .claude/ 目录
}
```

#### 2.2 注册到 `main.rs`

`invoke_handler` 添加 `list_workspace_dir`（或 `workspace_browse::list_workspace_dir`）

#### 2.3 前端 IPC 封装 `src/lib/tauri.ts`

添加：
```ts
export async function listWorkspaceDir(relativePath: string): Promise<DirEntry[]>
```

### Phase 3: 前端 — 动态 Skill 菜单 + @ 路径浏览

#### 3.1 重写 `src/lib/slashCommands.ts`

删除硬编码的 5 个命令。改为：

```ts
export interface SkillItem {
  name: string
  description: string
  scope: string
}

// 从后端获取 skill 列表（缓存 30s）
export async function fetchSkills(): Promise<SkillItem[]>

// 模糊过滤
export function filterSkills(skills: SkillItem[], query: string): SkillItem[]
```

#### 3.2 重写 `src/components/SlashCommandMenu.tsx`

改为动态数据源：

1. mount 时调用 `fetchSkills()` 获取 skill 列表
2. 根据 query 模糊过滤
3. 选中后：在输入框插入 `/skill-name ` 文本（注意尾部空格），**不立即发送**
4. 保持现有键盘导航（↑↓ Enter Esc）

#### 3.3 新增 `src/components/AtMentionMenu.tsx`

可钻入的目录浏览菜单：

```
状态：currentPath (string, 初始 "")
显示：list_workspace_dir(currentPath) 的结果

- 点击目录 → currentPath = entry.path，刷新列表
- 点击文件 → 在输入框插入 @entry.path 文本，关闭菜单
- 显示面包屑导航（可点击返回上级）
- 支持键盘导航（↑↓ Enter Esc Backspace返回上级）
```

视觉风格与 SlashCommandMenu 一致：
- 目录图标 📁，文件图标根据扩展名区分（🎙 音频、📄 文本、📎 其他）
- 面包屑在顶部，灰色小字

#### 3.4 修改 `src/components/ConversationInput.tsx`

1. **导入** AtMentionMenu
2. **新增状态**：`atOpen`, `atQuery`
3. **修改** `handleInputChange`：
   - 检测 `@` 触发：光标前最近的 `@` 后无空格时打开 AtMentionMenu
   - 保持现有 `/` 触发逻辑，但改为插入文本而非立即发送
4. **修改** `handleSlashSelect`：
   - 旧：`onSend(cmd.promptTemplate)` — 立即发送
   - 新：`setInput('/skill-name ' + remainingInput)` — 插入文本
5. **新增** `handleAtSelect`：
   - 在光标位置插入 `@path`，关闭菜单
6. **删除** 音频转写内联逻辑（`[音频转写: ...]` 包装）
   - 附件统一为 `[附件: filename]` 文本标记
   - 不再区分音频/非音频附件的处理方式

#### 3.5 i18n 更新 `src/locales/en.ts` + `zh.ts`

添加 AtMentionMenu 相关文案（面包屑"根目录"、空目录提示等）

### Phase 4: 测试

#### 4.1 Rust 测试

- `enable_skill.rs`: 测试 skill 查找（存在/不存在/优先级）
- `prompt.rs`: 更新现有测试，移除 resolve_skill 相关用例
- `tool_loop.rs`: 确认 MAX_TURNS = 60

#### 4.2 前端测试

- 更新 `src/tests/ipc-contract.test.ts`：添加 `listWorkspaceDir` 
- 更新 `src/tests/tauri.test.ts`：添加新 IPC mock
- SlashCommandMenu 测试：验证动态加载 + 插入文本行为

## 文件改动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src-tauri/src/llm/enable_skill.rs` | 新增 | enable_skill 工具定义 + 执行 |
| `src-tauri/src/llm/mod.rs` | 改 | 添加 `pub mod enable_skill` |
| `src-tauri/src/llm/tool_loop.rs` | 改 | MAX_TURNS=60, 注册 enable_skill |
| `src-tauri/src/llm/prompt.rs` | 改 | 删除 resolve_skill_from_prompt, 简化 build_system_prompt |
| `src-tauri/src/ai_processor.rs` | 改 | 删除 skill 解析调用，直传原始 prompt |
| `src-tauri/src/conversation.rs` | 改 | 注册 enable_skill, max_turns=60 |
| `src-tauri/src/skills.rs` 或新文件 | 改/新增 | 添加 list_workspace_dir 命令 |
| `src-tauri/src/main.rs` | 改 | 注册 list_workspace_dir |
| `src/lib/tauri.ts` | 改 | 添加 listWorkspaceDir IPC |
| `src/lib/slashCommands.ts` | 重写 | 删除硬编码，改为动态获取 |
| `src/components/SlashCommandMenu.tsx` | 重写 | 动态 skill 列表，插入文本 |
| `src/components/AtMentionMenu.tsx` | 新 | 可钻入目录浏览菜单 |
| `src/components/ConversationInput.tsx` | 改 | @ 触发、slash 行为改为插入、删除转写内联 |
| `src/locales/en.ts` + `zh.ts` | 改 | 新增 AtMention 相关文案 |
| 测试文件 | 改 | 同步更新 |

## 实施顺序

Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1 是核心，改完后 skill 系统即可通过 LLM 自主调用工作。Phase 2-3 是 UX 增强。Phase 4 贯穿始终。
