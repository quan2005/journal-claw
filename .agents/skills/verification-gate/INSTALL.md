# 安装说明

> 本文件面向人类读者，不属于技能上下文。

## 设计原则

与 requirements-gate 同一套哲学：hook 零判断、提醒不阻断、逻辑全在 prompt。但 PreToolUse 的机制与 UserPromptSubmit 有两处不同，导致 hook 命令形态有差异，特此说明：

- **为什么 echo 的是 JSON 而不是纯文本**：官方文档明确，纯 stdout 进入模型上下文仅限 UserPromptSubmit / SessionStart 等少数事件；PreToolUse 的纯 stdout 只进 debug log。要让模型看到提醒，必须输出 `hookSpecificOutput.additionalContext` 的 JSON。
- **为什么多了一行 `grep -q 'git commit'`**：hooks 的 matcher 只能按工具名匹配（这里是 `Bash`），不能按命令内容过滤。不加 grep 会对每一条 shell 命令注入提醒，上下文污染不可接受。这行 grep 是**路由**不是判断——"有没有未验收的 story、要不要 spawn subAgent、是否放行"仍然 100% 由模型在技能内判断。
- **不阻断**：命令以 `|| true` 收尾，永远 exit 0。验收与否的最终决定权在用户（`[skip-gate]`）。

## 安装步骤

1. 技能目录放到 `~/.claude/skills/verification-gate/`（个人级）或项目内 `.claude/skills/verification-gate/`。
2. 将 `hooks/settings.example.json` 中的 `hooks.PreToolUse` 段合并进 settings.json。与 requirements-gate 并存时，两个事件互不冲突，合并后形如：

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "echo '[需求门禁] …'" } ] } ],
       "PreToolUse":      [ { "matcher": "Bash", "hooks": [ { "type": "command", "command": "grep -q 'git commit' && echo '{…}' || true" } ] } ]
     }
   }
   ```

3. 验证：让 Claude 执行一次 `git commit`，应可见其先做放行判断；执行 `ls` 等普通命令，无任何注入。

## 已知问题与兜底

- 个别版本曾报告过 Bash matcher 的 PreToolUse 注入通道失效（如 GitHub issue #55889，v2.1.123 / macOS）。若提醒不生效：技能 description 中的触发条件（"准备 git commit / 宣称做完了"）仍可独立触发本技能；亦可在 CLAUDE.md 写入同一行约定兜底。
- grep 模式 `git commit` 匹配不到 `git -C <dir> commit` 等变体，可按需把模式放宽为 `git .*commit`。

## 升级路径（按需）

软门禁跑顺后若仍有"未验收先 commit"，可升级为硬门禁：hook 输出 `permissionDecision: "ask"`（弹确认）或 `"deny"`（阻断）。代价是 hook 需要真正的判断逻辑（检查是否存在未验收 story），与"零逻辑"原则冲突，建议确有需要再做。

## 上下文成本

仅在命令含 `git commit` 时注入约 100 字，普通命令零注入。
