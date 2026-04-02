# 初始化引导设计文档

**日期：** 2026-04-01
**状态：** 待实现

---

## 背景

用户首次安装后面对空白界面，不清楚如何上手。主要痛点：右侧大区域是水印 + 一行提示文字，引导力极弱；底部 CommandDock 视觉权重不足；没有任何示例能让用户"先看看结果长什么样"。

---

## 三个改动

### A · 空状态引导卡片（DetailPanel）

**触发条件：** `entries.length === 0`（无日志条目时）。

**现状：** `DetailPanel.tsx` 在 `entry === null` 时渲染水印 + 底部一行提示文字。

**改动：** 在水印层之上叠加三张引导卡片，覆盖右侧空状态区域。

**三张卡片：**

| 卡片 | 图标 | 标题 | 副标题 | 点击行为 |
|------|------|------|--------|----------|
| 录音记录 | 🎙️ | 录音记录 | 说出你的想法，AI 自动整理成日志 | 触发录音按钮（调用 `onRecord` 回调） |
| 粘贴/拖文件 | 📄 | 粘贴 / 拖文件 | 会议记录、日记，AI 自动提炼关键信息 | 打开 CommandDock 输入框 |
| 看示例 | ✨ | 看示例条目 | 先了解 AI 整理结果长什么样 | 选中示例条目（`onSelectSample` 回调） |

**实现方式：**
- 卡片渲染在 `DetailPanel` 内，`entry === null` 且 `entries.length === 0` 时显示。
- 水印（`谨迹`）保留，透明度维持现有 `0.035`，卡片叠加在水印之上（`z-index: 1`）。
- `DetailPanel` 需新增两个 prop：`entries: JournalEntry[]`（判断是否为空）、`onRecord: () => void`、`onOpenDock: () => void`、`onSelectSample: () => void`。
- `App.tsx` 向下传递这三个回调。

---

### B · 首次启动示例条目

**目标：** 让用户开箱即看到一条 AI 整理好的真实样例，了解产品核心价值。

**行为：**
- 首次启动时（`sample_entry_created` flag 为 false），在当前月份目录写入一条示例 `.md` 文件。
- 写入后将 `sample_entry_created: true` 写入 `app_data_dir/config.json`。
- 示例条目和普通条目无任何区别：可删除、可编辑、不会自动消失。
- 再次启动时 flag 已为 true，不再写入。

**示例文件路径：** `workspace/YYMM/DD-产品评审示例.md`（DD 为当天日期，YYMM 为当前年月）

**示例文件内容（固定 Markdown）：**

```markdown
---
summary: 这是 AI 帮你整理的示例——试着录一段音或粘贴一段会议记录
tags: [示例, 产品, 会议]
---

# 产品评审会议纪要

## 会议结论

- 下一版本功能优先级已确定，重点投入 AI 摘要功能
- UI 改版方案通过评审，进入设计执行阶段
- 技术债处理排期至 Q2 下半段

## 待办事项

- @设计：输出首页改版高保真稿，截止下周五
- @后端：排期 API 优化，评估工作量

## 参会人员

产品、设计、前后端各一名

---

> 这条记录是示例，展示 AI 整理后的效果。你可以删除它，或直接录音 / 粘贴文件开始使用。
```

**Rust 实现：**
- 在 `config.rs` 的 `Config` 结构体中增加字段 `sample_entry_created: bool`（`#[serde(default)]`，默认 `false`）。
- 新增 Tauri command `create_sample_entry_if_needed(app: AppHandle) -> Result<bool, String>`：
  - 读取 config，若 `sample_entry_created == true`，直接返回 `false`（无需创建）。
  - 否则调用现有 `workspace::ensure_dirs` 确保目录存在，写入 `.md` 文件，将 config 的 `sample_entry_created` 置为 `true` 并保存，返回 `true`。
- 在 `main.rs` 的 `invoke_handler` 注册该 command。
- 在 `src/lib/tauri.ts` 增加对应前端包装函数。

**前端调用时机：**
- `App.tsx` 在 `useEffect` 挂载时调用 `createSampleEntryIfNeeded()`，若返回 `true` 则调用 `refresh()` 刷新列表，并自动选中新写入的示例条目。

---

### C · CommandDock 底部工具栏强化

**现状：** 上传图标 14×14、主文案颜色 `var(--dock-dropzone-text)`（偏暗）、副文案颜色 `var(--dock-dropzone-hint)`（极暗）。

**改动（仅修改 `CommandDock.tsx` idle 状态渲染）：**

| 元素 | 改前 | 改后 |
|------|------|------|
| 图标盒尺寸 | 30×30 | 32×32 |
| 图标尺寸 | 14×14 | 16×16 |
| 主文案 | `粘贴文本或拖入文件` | `粘贴会议记录、文章、随手笔记` |
| 主文案字号 | 11px | 12px |
| 副文案 | `支持 txt · md · pdf · docx · 图片` | `AI 帮你归档 · 支持 txt · md · pdf · docx · 图片` |
| 图标盒背景透明度 | 低 | 略高（`rgba(255,255,255,0.06)`） |

不改变任何交互逻辑，仅修改视觉呈现。

---

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src-tauri/src/config.rs` | 修改 | `Config` 增加 `sample_entry_created: bool` 字段 |
| `src-tauri/src/main.rs` | 修改 | 注册 `create_sample_entry_if_needed` command |
| `src-tauri/src/journal.rs` | 新增函数 | `write_sample_entry(workspace, year_month, day)` |
| `src/lib/tauri.ts` | 修改 | 增加 `createSampleEntryIfNeeded` 函数 |
| `src/App.tsx` | 修改 | 挂载时调用 `createSampleEntryIfNeeded`；向 `DetailPanel` 传递新 props |
| `src/components/DetailPanel.tsx` | 修改 | 增加引导卡片渲染逻辑；新增 props |
| `src/components/CommandDock.tsx` | 修改 | idle 状态视觉调整 |

---

## 不在本次范围内

- 多语言 / i18n
- 示例条目内容的可配置化
- 引导卡片动画（保持项目现有无动画风格）
- onboarding 步骤指引（step-by-step tour）
