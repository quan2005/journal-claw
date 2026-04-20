# 文件系统工具设计

## Context

内置 AI 引擎当前通过 `bash_tool` 执行所有文件操作（cat、tee、sed、ls 等）。这带来几个问题：

1. **安全性**：bash 可以执行任意命令，无法限制在 workspace 内
2. **可预测性**：AI 生成的 shell 命令可能有语法错误或意外副作用
3. **token 效率**：bash 输出格式不可控，容易浪费 token

目标：新增 8 个结构化工具作为首选文件操作方式，保留 bash tool 但在 prompt 中引导 AI 优先使用结构化工具。所有结构化工具严格限制在 workspace 目录内。

## 工具定义

### `read`

读取文件内容。

```
参数:
  path: string        — 相对于 workspace 的路径
  offset?: integer    — token 偏移量（用于翻页）
  limit?: integer     — 最大 token 数

返回: 文件内容（带行号前缀）+ 是否有后续页
```

- 默认读取整个文件
- 超过 10K token（约 30,000 字符）自动截断，返回提示"内容已截断，使用 offset 翻页"
- 翻页单位是 token 而非行号，确保每页 token 消耗可预测

### `write`

创建或写入文件。

```
参数:
  path: string        — 相对于 workspace 的路径
  content: string     — 写入内容
  append?: boolean    — true 时追加到末尾，默认 false（覆盖）

返回: 成功/失败 + 写入字节数
```

- 父目录不存在时自动创建（等同 mkdir -p）
- 无硬性大小限制，但建议单次写入不超过 12K token（约 36,000 字符）
- 超长内容应分批写入（先 write 再 append），避免单次调用耗时过长

### `edit`

精确字符串替换。

```
参数:
  path: string        — 相对于 workspace 的路径
  old_string: string  — 要替换的内容（默认作为正则表达式）
  new_string: string  — 替换为的内容（支持 $1 $2 捕获组引用）
  literal?: boolean   — true 时 old_string 作为字面量匹配，默认 false（正则）
  first_only?: boolean — true 时只替换第一个匹配，默认 false（全部替换）

返回: 替换次数；0 次时报错（未找到匹配）
```

- 默认正则匹配，全部替换
- 正则语法使用 Rust `regex` crate（与 ripgrep 一致）
- `literal: true` 时退化为精确字面量匹配
- 未找到匹配时返回 is_error = true，避免静默失败

### `glob`

按模式查找文件。

```
参数:
  pattern: string     — glob 模式（如 "**/*.md", "2603/*.md"）

返回: 匹配的文件路径列表（相对路径），按修改时间排序
```

### `grep`

搜索文件内容，返回匹配文件及内容预览。

```
参数:
  pattern: string     — 搜索模式（默认正则）
  glob?: string       — 限制搜索范围的 glob（如 "**/*.md"）
  literal?: boolean   — true 时 pattern 作为字面量，默认 false（正则）
  context?: integer   — 上下文行数，默认 1（即匹配行 + 前后各 1 行 = 3 行）

返回: 匹配结果列表，每项包含：文件路径 + 匹配行及上下文预览
```

- 返回格式类似 `rg -C1`：路径 + 行号 + 匹配内容 + 上下文
- 默认前后各 1 行上下文（共 3 行），可调整

### `mkdir`

创建目录。

```
参数:
  path: string        — 相对于 workspace 的路径

返回: 成功/失败
```

- 递归创建（等同 mkdir -p）
- 目录已存在时静默成功

### `move`

移动或重命名文件/目录。

```
参数:
  source: string      — 源路径（相对）
  destination: string — 目标路径（相对）

返回: 成功/失败
```

- 目标父目录不存在时自动创建

### `remove`

删除文件或目录（移到 macOS 回收站）。

```
参数:
  path: string        — 相对于 workspace 的路径

返回: 成功/失败
```

- 通过 macOS `NSFileManager.trashItem` API 实现
- 用户可在 Finder 回收站中还原
- 支持删除文件和目录（含内容）

## 安全约束

1. **Workspace sandbox**：所有路径必须解析后位于 workspace 目录内
   - 拒绝 `..` 逃逸（resolve 后检查 starts_with）
   - 拒绝绝对路径
   - 拒绝符号链接指向 workspace 外的目标
2. **路径规范化**：输入路径先 canonicalize，再验证前缀
3. **Token 保护**：`read` 超过 10K token（~30,000 字符）自动截断并支持翻页；`write` 建议单次 ≤12K token

## 实现要点

### 文件结构

```
src-tauri/src/llm/
  mod.rs              — 注册新工具模块
  fs_tools/
    mod.rs            — 工具定义列表 + sandbox 验证函数
    read.rs           — read 实现
    write.rs          — write 实现
    edit.rs           — edit 实现
    glob.rs           — glob 实现
    grep.rs           — grep 实现
    mkdir.rs          — mkdir 实现
    move_file.rs      — move 实现
    remove.rs         — remove 实现（调用 macOS trash API）
  bash_tool.rs        — 保留，但降低优先级
```

### tool_loop.rs 修改

- `tools` 向量改为 `[fs_tools::definitions(), bash_tool::definition(), ...]`
- 工具分发新增 match 8 个 fs 工具名，bash 保留
- bash_tool 的 description 修改为："Fallback shell execution. Prefer using read/write/edit/glob/grep/mkdir/move/remove for file operations."

### macOS Trash 实现

通过 `objc` crate 调用 `NSFileManager.trashItem:resultingItemURL:error:`，或使用 `trash` crate（纯 Rust 封装）。推荐 `trash` crate，更简洁。

### 依赖

- `glob` crate（或 `globwalk`）— glob 模式匹配
- `grep-regex` + `ignore` crate（或直接用 `grep` crate）— 内容搜索
- `regex` crate — edit 正则模式
- `trash` crate — macOS 回收站

## 验证方式

1. 单元测试：每个工具在临时目录中测试正常路径和边界情况
2. sandbox 测试：验证 `..` 逃逸、绝对路径、符号链接均被拒绝
3. 集成测试：通过 `run_agent` 跑一个使用所有工具的 prompt，验证端到端
4. 手动测试：`npm run tauri dev` 中触发 AI 处理，观察工具调用日志
