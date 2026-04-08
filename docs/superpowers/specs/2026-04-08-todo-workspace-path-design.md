# 想法区工作路径分组

日期：2026-04-08

## 概述

为 TodoSidebar（想法区）新增"工作路径"概念，将 todo 按工作路径折叠分组显示。所有 todo 仍存储在同一个 `todos.md` 文件中，通过 HTML 注释标签 `<!-- path:~/... -->` 做逻辑分组。

## 动机

用户同时关注多个项目（日志系统本身、其他代码项目等），需要在想法区按项目上下文组织 todo。工作路径分组让 todo 有归属感，brainstorm 终端也能在对应项目目录下工作，获得更精准的代码上下文。

## 设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 分组 UI | 折叠分组（Collapsible Sections） | 类似 Things 3，信息密度高，可折叠减少噪音 |
| 新建 todo 归属 | 跟随当前分组 | 每个分组底部有自己的"+"，直觉清晰 |
| 路径管理 | 无专门管理入口 | 右键 todo 条目按需设置/移除，路径从使用中自然涌现 |
| 路径选择交互 | 直接弹出系统文件夹选择器 | 最简单 |
| 分组标题 | basename + 智能去重 | 短小可读，重名时往前多显示一级 |
| 存储格式 | `<!-- path:~/... -->` HTML 注释 | 沿用现有 due/source/done 约定 |
| Brainstorm cwd | 有路径用路径，无路径用 workspace | Claude CLI 获得对应项目上下文 |

## 1. 布局

所有 todo 都属于某个分组。没有 `path:` 标签的 todo 归属默认路径（日志 workspace）。

```
┌─────────────────────────────────┐
│ TODO · 7                        │
├─────────────────────────────────┤
│ ▾ journal [默认] · 4            │
│   □ 整理会议纪要                │
│   □ 写周报                      │
│   □ 补充评审结论                │
│   □ 更新日志模板                │
│   + 添加…                       │
│                                 │
│ ▾ app-x · 2                    │
│   □ 修复登录页 bug              │
│   □ 更新 API 文档               │
│   + 添加…                       │
│                                 │
│ ▸ design-system · 1            │
│                                 │
│ ── 已完成 (3) ▸ ──             │
└─────────────────────────────────┘
```

规则：
- 默认分组始终排第一，其余按在 `todos.md` 中首次出现的顺序排列
- 分组标题显示 basename，hover tooltip 显示完整路径
- basename 重名时往前多显示一级，直到不重名（如 `Projects/app-x` vs `Work/app-x`）
- 默认路径旁边显示淡色"默认"标记
- 每个分组可折叠/展开，折叠时显示未完成计数
- 每个分组底部有自己的"+"按钮
- 已完成区域保持扁平列表，不按路径分组

## 2. 右键菜单

通过右键 todo 条目操作，菜单项按需出现：

- 默认分组里的 todo：出现"设置工作路径"
- 非默认分组里的 todo：同时出现"设置工作路径"和"移除工作路径"
- "设置工作路径"→ 弹出系统文件夹选择器 → 写入/替换 `<!-- path:... -->`
- "移除工作路径"→ 删掉 `<!-- path:... -->` 注释 → 回到默认分组

## 3. 新建 todo

- 在非默认分组内"+"添加的 todo 自动继承该分组的路径
- 在默认分组内"+"添加的 todo 不带路径标签

## 4. 存储格式

沿用现有 HTML 注释约定，新增 `path:` 字段：

```markdown
- [ ] 整理会议纪要
- [ ] 写周报
- [ ] 修复登录页 bug <!-- path:~/Projects/app-x -->
- [ ] 更新 API 文档 <!-- path:~/Projects/app-x --> <!-- due:2026-04-15 -->
```

- 路径用 `~/` 替代 home 目录前缀，更短更可读
- Rust 解析时展开 `~` 为实际 home 目录
- 无 `path:` 标签 = 属于默认路径
- `todos.done.md` 中的已完成 todo 保留 path 标签但不影响显示

## 5. Brainstorm 终端

打开深入探索终端时：

- 有工作路径的 todo → cwd 设为该路径
- 默认分组的 todo → cwd 为日志 workspace（现有行为）

### ideate 技能 symlink

非默认路径下没有 `/ideate` 技能。启动 brainstorm 前，自动处理：

1. 检查目标路径下是否存在 `.claude/skills/ideate`
2. 如果不存在，创建 `.claude/skills/` 目录（如果需要）
3. 创建 symlink：`<target>/.claude/skills/ideate` → `<workspace>/.claude/skills/ideate`
4. 如果已存在且是 symlink 指向正确位置，跳过
5. 如果已存在但不是 symlink（目标项目有自己的 ideate），不覆盖，使用目标项目自己的版本

## 6. 数据流变更

### Rust 层

`TodoItem` struct 新增 `path: Option<String>` 字段：

```rust
pub struct TodoItem {
    pub text: String,
    pub done: bool,
    pub due: Option<String>,
    pub done_date: Option<String>,
    pub source: Option<String>,
    pub path: Option<String>,      // 新增
    pub line_index: usize,
    pub done_file: bool,
}
```

`parse_todo_line` 新增解析 `<!-- path:... -->` 注释。

新增 Tauri commands：
- `set_todo_path(line_index, path, done_file)` — 设置/替换路径
- `remove_todo_path(line_index, done_file)` — 移除路径

`add_todo` 新增可选 `path` 参数。

`open_brainstorm_terminal` 读取 todo 的 path 字段决定 cwd，并在需要时创建 ideate symlink。

### TypeScript 层

`TodoItem` type 新增 `path: string | null`。

`tauri.ts` 新增：
- `setTodoPath(lineIndex, path, doneFile)`
- `removeTodoPath(lineIndex, doneFile)`

`addTodo` 签名扩展：`addTodo(text, due?, source?, path?)`

### 前端组件

`TodoSidebar` 变更：
- 将 todo 列表按 path 分组（null path → 默认分组）
- 渲染折叠分组 UI，每组有标题栏和"+"按钮
- 分组折叠状态存 `localStorage`
- 分组标题 basename 去重逻辑
- 右键菜单新增"设置工作路径"/"移除工作路径"

## 7. 不做的事

- 不做路径管理面板（设置页不新增内容）
- 不做路径别名/重命名
- 不做拖拽排序分组
- 不做路径持久化记忆（从 todos.md 内容动态收集）
- 不做已完成区域的路径分组
