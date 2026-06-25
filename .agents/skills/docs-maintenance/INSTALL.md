# 安装说明

> 面向人类读者，不属于技能上下文。

## hook 形态说明

- echo 的是 JSON：PreToolUse 的纯 stdout 不进模型上下文，提醒必须经 `hookSpecificOutput.additionalContext` 注入
- 带一行 `grep -q 'git commit'`：matcher 只能按工具名（Bash）匹配，grep 仅做路由、避免对所有 shell 命令注入；五问判断全在 SKILL.md，hook 零逻辑
- `|| true` 永远 exit 0，提醒不阻断

## 安装步骤

1. 技能目录放到 `~/.claude/skills/docs-maintenance/`（个人级）或项目 `.claude/skills/docs-maintenance/`
2. 将 `hooks/settings.example.json` 的 `PreToolUse` 段合并进 settings.json。与其他 PreToolUse hook 并存互不影响：多个 hook 的 additionalContext 会合并注入，本技能放行判定第 3 问保证它在验收类提醒之后才生效
3. 软链初始化（仓库根目录执行）：

   ```bash
   ln -sf AGENTS.md CLAUDE.md
   ```

   已有实体 CLAUDE.md 的仓库：先把内容并入 AGENTS.md，再删实体文件、建软链——人工执行，技能不删文件
4. 验证：带 verified story 的 `git commit` 应触发五问判断；普通命令零注入

## 已知问题

个别版本曾报告 Bash matcher 的 PreToolUse 注入通道失效（GitHub issue #55889）。若提醒不生效：技能 description 的触发条件（准备 git commit）仍可独立触发；亦可在 AGENTS.md 写入同一行约定兜底。

## 上下文成本

仅命令含 `git commit` 时注入约 100 字，普通命令零注入。
