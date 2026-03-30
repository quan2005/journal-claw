# 设置页重设计 — Design Spec

**日期：** 2026-03-30
**状态：** 待实现

---

## 背景

现有设置页（`src/settings/App.tsx`）存在以下问题：
- 所有样式用 inline style 硬编码，未使用 `globals.css` 的 CSS 变量体系
- 深色模式无支持（背景、输入框、字色均为硬编码浅色值）
- 无主题切换入口
- 缺乏扩展性，新增分组需要大幅重构
- 视觉粗陋，与主窗口风格不一致

---

## 整体布局

**左侧目录导航 + 右侧单栏滚动**

- 左栏固定宽度（140px），列出所有分组作为目录锚点
- 右侧为单一连续滚动区，所有分组内容按顺序垂直排列
- 点击左侧导航项 → 右侧平滑滚动（`scrollIntoView`）到对应分组
- 右侧滚动时，左侧当前可见分组自动高亮（IntersectionObserver，threshold: 0.4）
- 窗口尺寸：600×500px（比现有 400×250 更宽高，为工作引导编辑器留出空间）

---

## 分组结构

分组按以下顺序排列，「关于」固定在左侧导航底部（`margin-top: auto`）：

| 顺序 | 分组名 | 图标 | 内容 |
|------|--------|------|------|
| 1 | 通用 | ⚙ | Workspace 路径、主题选择 |
| 2 | AI 引擎 | ◈ | 引擎选择卡片（Claude Code / Qwen Code）+ 对应配置字段 |
| 3 | 语音转写 | ◎ | 转写引擎（只读，当前仅 DashScope）、DashScope API Key |
| 4 | 工作引导 | ✦ | CLAUDE.md 编辑器 |
| 5 | 技能插件 | ⬡ | 插件预告列表 |
| — | 关于 | ◌ | 版本号 |

---

## 各分组详细设计

### 1. 通用

**Workspace 路径**
- 文本输入框 + 右侧「选择…」按钮（并排布局）
- 点击「选择…」调用系统 Folder Picker（Tauri `dialog::open({ directory: true })`），选中后更新输入框
- 提示文字：「日志和素材的存储根目录」

**主题**
- 三选一按钮组：浅色 / 深色 / 跟随系统
- 选中态：accent 色边框 + 背景（与现有 `useTheme` hook 对接）

---

### 2. AI 引擎

**引擎选择卡片**
- 2×1 方形大按钮网格，与主题选择器交互一致
- 选中态：accent 色边框 + 背景；未选中态：半透明降低
- 每张卡片右上角显示安装状态角标：
  - **检测中**（窗口打开时）：旋转圆环动画
  - **已安装**：绿色实心圆 ✓
  - **未安装**：卡片右下角「安装」按钮

**安装流程**
- 点击「安装」按钮后，卡片下方展开安装进度区域（不跳转页面）
- 进度区域包含：动态进度条 + 终端日志滚动输出
- 安装成功后角标切换为绿色 ✓，进度区域收起
- 安装命令（Rust 端 `tokio::process::Command` 执行）：
  - Claude Code：`npm install -g @anthropic-ai/claude-code`
  - Qwen Code：`bash -c "$(curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh)" -s --source qwenchat`
- 检测是否已安装：`which claude` / `which qwen`

**选中引擎后的配置字段**

Claude Code（已安装时显示）：
- API Key（password 输入框）：Anthropic API Key，留空使用 CLI 默认配置
- Base URL（文本输入框）：自定义 API 端点，留空使用默认值，适用于代理场景
- Model（文本输入框）：指定模型名称，留空使用 CLI 默认模型

Qwen Code（已安装时显示）：
- API Key（password 输入框）：DashScope API Key（**独立于语音转写分组的 Key**）
- Base URL（文本输入框）：自定义 API 端点
- Model（文本输入框）：指定模型名称

**Config 存储字段（新增）**
```
claude_code_api_key: String
claude_code_base_url: String
claude_code_model: String
qwen_code_api_key: String
qwen_code_base_url: String
qwen_code_model: String
active_ai_engine: "claude" | "qwen"
```

---

### 3. 语音转写

**转写引擎**
- 只读显示框，当前值：`阿里云 DashScope`
- 提示文字：「当前仅支持 DashScope，更多引擎即将支持」

**DashScope API Key**
- password 类型输入框
- 提示文字：「配置后，超过 30 秒的录音将自动转写为文字」

---

### 4. 工作引导

**编辑器说明**
- 分组顶部一行说明文字：「告诉 AI 你的工作习惯和偏好，它会在处理日志时参考这些引导。」

**编辑器主体**
- `<textarea>`，等宽字体（IBM Plex Mono / ui-monospace）
- Markdown 语法色（无行号）：
  - `# 标题`：`--item-text`（明亮）
  - `## 二级标题`：`--item-meta`（次要）
  - `- 列表项` 的 `-` 符号：accent 色 `--record-btn`
  - 正文：`--md-text`
- 实现方式：`<textarea>` 覆盖在语法高亮的 `<div>` 上（透明文字），或使用 CodeMirror 轻量集成（待评估）
- 高度：撑满可用空间，最小 200px

**持久化**
- 读写文件路径：`{workspace_path}/CLAUDE.md`（注意：是 workspace 目录下，不是 app data dir）
- 加载：设置窗口打开时读取文件内容（单栏滚动，不存在「进入分组」的时机）
- 自动保存：输入停止后 800ms debounce 写入文件
- 手动保存按钮：底部右侧，点击立即写入
- 状态提示：底部左侧显示「已自动保存」/ 「保存中…」

**Tauri 命令（需新增）**
- `read_workspace_guide() -> Result<String, String>`：读取 `CLAUDE.md`
- `save_workspace_guide(content: String) -> Result<(), String>`：写入 `CLAUDE.md`

---

### 5. 技能插件

展示两个功能预告卡片 + 一个「更多插件」占位：

| 插件 | 图标 | 描述 | 徽章 |
|------|------|------|------|
| 定时文件整理 | 🗂（橙色背景） | 按规则自动归档 Workspace 中的素材和日志，保持目录整洁 | 即将推出 |
| 图文可视化美化 | ✦（紫色背景） | 将日志内容转换为图文并茂的可视化卡片，便于分享 | 即将推出 |

底部虚线边框的「更多插件 / 插件市场即将开放」占位行。

无任何可交互元素，纯展示。

---

### 关于

- 居中卡片：App 名称「谨迹」+ 版本号（从 Tauri `app.version()` 读取）

---

## 主题支持

- 设置窗口复用 `globals.css`，所有颜色使用 CSS 变量
- 设置窗口的 `<body>` 需要在加载时读取当前主题并设置 `data-theme` 属性
- 主题切换后，设置窗口的 `data-theme` 同步更新

---

## 保存机制

所有字段（除工作引导外）沿用现有「保存」按钮模式：窗口底部统一保存，或各分组内独立保存。

**推荐：各分组独立保存**
- 避免用户跨分组修改时的状态管理复杂度
- 通用 / AI 引擎 / 语音转写：分组内有「保存」按钮
- 工作引导：自动保存 + 手动保存按钮（已说明）
- 技能插件 / 关于：无需保存

---

## Rust 后端变更

| 命令 | 变更 | 说明 |
|------|------|------|
| `read_workspace_guide` | 新增 | 读取 `{workspace}/CLAUDE.md` |
| `save_workspace_guide` | 新增 | 写入 `{workspace}/CLAUDE.md` |
| `get_app_version` | 新增 | 返回 `app.package_info().version` |
| `check_engine_installed` | 新增 | 执行 `which claude` / `which qwen`，返回是否已安装 |
| `install_engine` | 新增 | 执行对应安装命令，通过事件流推送进度日志到前端 |
| 现有 config 命令 | 保持不变 | get/set workspace_path、dashscope_api_key、claude_cli_path |
| config 新增字段 | 扩展 | claude_code_api_key、claude_code_base_url、claude_code_model、qwen_code_api_key、qwen_code_base_url、qwen_code_model、active_ai_engine |

---

## 文件变更范围

| 文件 | 变更 |
|------|------|
| `src/settings/App.tsx` | 完全重写 |
| `src-tauri/src/config.rs` | 新增 `get_app_version` 命令 |
| `src-tauri/src/workspace_settings.rs` | 新增 `read_workspace_guide` / `save_workspace_guide` |
| `src-tauri/src/main.rs` | 注册新 Tauri 命令 |
| `src/lib/tauri.ts` | 新增对应前端 wrapper |
| `src-tauri/tauri.conf.json` | 调整设置窗口尺寸为 600×500；启用 `dialog` plugin |
