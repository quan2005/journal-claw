# Design — 未识别类型的纯文本渲染选项

Story: `stories/20260708-unknown-type-plaintext/story.md`（approved；记忆范围用户拍板：按文件、会话内）

## 方案

全部改动收在 `apps/web/src/components/DetailView.tsx`（复用既有 text 渲染链，不新增组件/依赖）：

1. **会话内按文件记忆**：组件内 `useState<Set<string>>`（key = topic-file 的 workspace 相对路径）。DetailView 在选择切换间保持挂载，天然满足"切走再切回不重复问"（AC-3）。
2. **内容加载**（`DetailView.tsx:1160` 附近）：加载条件从 `kind ∈ {markdown,text,html,code,csv}` 扩为 `…或 (kind === 'other' 且该文件已选纯文本)`。未选择前不加载（AC-1"不自动加载内容"）。
3. **提示面板**（`DetailView.tsx:1830` other/audio/docx 分支）：仅当 `fileKind === 'other'` 时在既有"用系统应用打开"按钮旁增加"以纯文本查看"按钮 + 一行说明文案。audio/docx 分支不变（Won't）。
4. **纯文本渲染**：text 分支条件扩为 `kind === 'text' || (kind === 'other' && 已选纯文本)`，完全复用 .txt 的样式与 Cmd+F 查找（AC-2）。
5. **超大文件**：沿用现状（get_journal_entry_content 无截断），不在本 story 加上限——记录为已知债，与 .txt 同一行为水位。

## 验收映射

AC-1/AC-2/AC-3/AC-4 → DetailView 组件测试（提示面板出现、点击后内容渲染与调用断言、切换选择不重复问、md 文件无提示）。
