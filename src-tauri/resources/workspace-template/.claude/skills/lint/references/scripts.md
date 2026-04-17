# Lint 过程中用到的 shell 片段

这些片段被 SKILL.md 的各个阶段引用。集中在这里是为了让 SKILL.md 讲"做什么 / 为什么"，而这里讲"怎么做"。

## Phase 1：统计各月日志条目数量

```bash
for dir in /path/to/workspace/26*/; do
  echo "$(basename $dir): $(find "$dir" -maxdepth 1 -name "*.md" | wc -l) entries"
done
```

## Phase 3.4：修复 frontmatter 格式

```bash
.claude/scripts/fix-frontmatter
```

脚本自动处理：

- `## tags:` → `tags:`（markdown 标题误写成 YAML 字段）
- 缺失的闭合 `---`

脚本修复后再人工补充 summary / tags 的内容缺失。

## Phase 4.2：更新触发状态

```bash
WORKSPACE="$(cd "$(dirname "$0")/../.." && pwd)"
TOTAL=$(find "$WORKSPACE" -maxdepth 2 -mindepth 2 -name "*.md" \
  -not -path "$WORKSPACE/.claude/*" \
  -regex ".*/[0-9][0-9][0-9][0-9]/.*" | wc -l | tr -d ' ')
cat > "$WORKSPACE/.claude/last-lint.json" <<EOF
{
  "last_run": "$(date -u +%Y-%m-%dT%H:%M:%S%z)",
  "entries_at_last_run": $TOTAL
}
EOF
```

## Phase 4.1：创建整合摘要条目

```bash
.claude/scripts/journal-create "自动整理摘要"
```

## Phase 3.2：创建新人物档案

```bash
.claude/scripts/identity-create "region" "name" --speaker-id 00003 \
  --summary "此人身份与和用户的关系"
```

创建后按 `/identity-profiling` 的人物档案结构范式填充，按渐进深挖规则决定写到哪一层。
