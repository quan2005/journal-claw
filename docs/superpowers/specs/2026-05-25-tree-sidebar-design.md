# 左栏树形结构重构方案

## 概述

去除 `SidebarTabs` 的三标签切换模式，替换为统一树形层级结构。四个可折叠分区：置顶、画像、流水、专题。所有条目使用一致的视觉语言，通过侧栏即可浏览全部内容，中栏负责详情展示。

## 树形结构

```
📌 置顶（可折叠，浅金橙底）
  ├─ 日志条目 或 画像条目（用户手动钉选）
  └─ 支持拖拽排序

👤 画像（可折叠）
  ├─ [色块头像] 名称 + 行内标签
  └─ 两行描述（左侧与头像对齐）

📝 流水（可折叠）
  ├─ 2026年5月（左对齐月份分割线，不可折叠）
  │   ├─ [日期块] 标题 + 行内标签
  │   └─ 两行描述（左侧与日期块对齐）
  ├─ 2026年4月
  └─ 加载更多（已显示 X / 50 条）

📂 专题（可折叠，嵌套文件夹树）
  └─ topics/ 目录结构
```

## 组件变更

### 新增

| 组件 | 职责 |
|---|---|
| `TreeSidebar.tsx` | 树形容器，管理四分区折叠状态、选中项、滚动 |
| `TreeItem.tsx` | 统一树节点：头像/日期块 + 名称行 + 描述 + @/… 操作 |
| `MonthDivider.tsx` | 流水月份分割线（纯文本左对齐） |
| `PinnedSection.tsx` | 置顶分区，管理钉选列表与拖拽排序 |
| `TopicTree.tsx` | 专题文件夹树，递归渲染 topics/ 目录 |

### 移除

| 组件 | 原因 |
|---|---|
| `SidebarTabs.tsx` | 标签切换被树形分区替代 |
| `FileTree.tsx` | 功能合并到 TopicTree |
| `IdentityList.tsx` | 功能合并到 TreeSidebar 画像分区 |
| `JournalList.tsx` | 功能合并到 TreeSidebar 流水分区 |

### 修改

| 文件 | 变更 |
|---|---|
| `App.tsx` | 移除 `sidebarTab` 状态；中栏内容由树选中项类型决定；移除 IdentityList/FileTree import |
| `src/lib/tauri.ts` | 新增 topics 目录管理、置顶持久化、日志分页加载命令 |
| `src/types.ts` | 新增 `TreeItemType`、`PinnedItem` 等类型 |

## 数据层

### 置顶数据

存储在 workspace `settings.json`：

```json
{
  "pinned": [
    { "type": "journal", "path": "2605/25-AI平台产品评审会议纪要.md", "order": 0 },
    { "type": "identity", "path": "identities/张三.md", "order": 1 }
  ]
}
```

### 专题目录

workspace 根目录新增 `topics/`，支持嵌套：

```
topics/
  AI 平台 v2.3/
    技术方案/
      xxx.md
    需求文档.md
    架构图.png
  前端重构/
    迁移计划.md
```

### 流水分页

- 默认加载最近 50 条日志
- 点击"加载更多"追加下一批 50 条
- 流水区标题显示 `已显示 X / 总数`

## 交互行为

| 操作 | 行为 |
|---|---|
| 单击分区标题 | 折叠/展开该分区 |
| 单击条目 | 中栏显示对应详情（日志→DetailPanel，画像→IdentityDetail，文件→FilePreviewPanel） |
| 再次单击已选中条目 | 取消选中 |
| Hover 条目 | 标题缩进，露出 @ 和 … 操作按钮 |
| 点击 @ | 在探讨输入框中追加 `@path` 引用 |
| 点击 … | 弹出上下文菜单（钉选/取消钉选/删除/在 Finder 中显示等） |
| 右键条目 | 同上，弹出上下文菜单 |
| 拖拽置顶条目 | 调整钉选排序 |
| 拖入文件到专题文件夹 | 导入到对应 topics/ 子目录 |

## 视觉规范

- 暖向灰基调（非墨水青冷调），金橙色 accent ≤10%
- 条目统一单行格式：前置色块 + 名称 + 行内标签，描述在下一行左侧对齐
- 当天日期块：金橙色文字 + 浅金橙底；其他日期：灰色
- 画像头像：20×20 圆角色块，取名称首字
- 所有图标使用 SVG，禁止 emoji
- Hover 时标题文本自动让位给操作按钮（48px 宽度过渡）
- 置顶区：浅金橙底色（`rgba(200,147,59,0.03)`），与其余分区区分

## Rust 后端新增

- `list_journal_entries_paginated(offset, limit)` — 分页日志查询
- `list_topics_dir(path)` — 专题目录浏览
- `create_topic(name)` — 新建专题文件夹
- `delete_topic(path)` — 删除专题
- `import_file_to_topic(source, topic_path)` — 导入文件到专题
- `get_pinned_items()` / `set_pinned_items(items)` — 置顶读写
- `reorder_pinned(from_index, to_index)` — 置顶排序

## 实现顺序

1. 后端：topics 目录管理 + 置顶持久化 + 流水分页
2. 前端：TreeSidebar + TreeItem 组件
3. 前端：App.tsx 集成，移除旧组件
4. 联调测试
