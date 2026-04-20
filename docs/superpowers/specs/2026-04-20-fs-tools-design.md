# 文件系统工具设计

## Context

内置 AI 引擎当前通过 `bash_tool` 执行所有文件操作（cat、tee、sed、ls 等）。这带来几个问题：

1. **安全性**：bash 可以执行任意命令，无法限制在 workspace 内
2. **可预测性**：AI 生成的 shell 命令可能有语法错误或意外副作用
3. **token 效率**：bash 输出格式不可控，容易浪费 token

目标：用 8 个结构化工具完全替代 bash tool，所有操作严格限制在 workspace 目录内。

## 工具定义

### `read`

读取文件内容。

```
参数:
  path: string        — 相对于 workspace 的路径
  offset?: integer    — 起始行号（1-based）
  limit?: integer     — 读取行数

返回: 文件内容（带行号前缀）
```

- 默认读取整个文件
- 超过一定大小（如 100KB）自动截断并提示

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

### `edit`

精确字符串替换。

```
参数:
  path: string        — 相对于 workspace 的路径
  old_string: string  — 要替换的内容
  new_string: string  — 替换为的内容
  regex?: boolean     — true 时 old_string 作为正则表达式，默认 false（字面量）
  first_only?: boolean — true 时只替换第一个匹配，默认 false（全部替换）

返回: 替换次数；0 次时报错（未找到匹配）
```

- 默认字面量匹配，全部替换
- 正则模式使用 Rust `regex` crate 语法
- 未找到匹配时返回 is_error = true，避免静默失败

### `glob`

按模式查找文件。

```
参数:
  pattern: string     — glob 模式（如 "**/*.md", "2603/*.md"）

返回: 匹配的文件路径列表（相对路径），按修改时间排序
```

### `grep`

搜索文件内容，返回匹配文件列表。

```
参数:
  pattern: string     — 搜索模式
  glob?: string       — 限制搜索范围的 glob（如 "**/*.md"）
  regex?: boolean     — true 时 pattern 作为正则，默认 false（字面量）

返回: 包含匹配的文件路径列表
```

- 类似 `rg -l`，只返回路径不返回内容
- AI 需要看内容时再用 `read` 读取

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
3. **大文件保护**：`read` 超过 100KB 截断；`write` 无限制（日志文件通常很小）

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
  bash_tool.rs        — 删除
```

### tool_loop.rs 修改

- `tools` 向量从 `[bash_tool::definition(), ...]` 改为 `fs_tools::definitions()`
- 工具分发从 match `"bash"` 改为 match 8 个工具名

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
