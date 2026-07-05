#!/usr/bin/env bash
set -euo pipefail

# opencode subagent 封装脚本
# 用法：
#   ./opencode-subagent.sh <story.md> [design.md] <scope> <output-report.md>
# 示例：
#   ./opencode-subagent.sh stories/xxx/story.md stories/xxx/design.md \
#     "src/lib/foo.ts src/hooks/useBar.ts" stories/xxx/verify-report-r2.md

STORY_FILE="$1"
DESIGN_FILE="${2:-}"
SCOPE="${3:-}"
OUTPUT_FILE="${4:-}"

if [[ -z "$STORY_FILE" || -z "$OUTPUT_FILE" ]]; then
  echo "Usage: $0 <story.md> [design.md] <scope> <output-report.md>" >&2
  exit 1
fi

if [[ -z "$SCOPE" ]]; then
  echo "Error: scope must not be empty. Provide files to verify, not the story path." >&2
  exit 1
fi

STORY_ABS="$(cd "$(dirname "$STORY_FILE")" && pwd)/$(basename "$STORY_FILE")"

if [[ "$SCOPE" == "$STORY_ABS" || "$SCOPE" == "$STORY_FILE" ]]; then
  echo "Error: scope must be the files to verify, not the story.md path." >&2
  exit 1
fi

OUTPUT_ABS="$(cd "$(dirname "$OUTPUT_FILE")" && pwd)/$(basename "$OUTPUT_FILE")"

if [[ "$OUTPUT_ABS" == /tmp/* || "$OUTPUT_ABS" == /var/tmp/* ]]; then
  echo "Error: report output must be inside the repository, not /tmp or /var/tmp." >&2
  exit 1
fi

OUTPUT_DIR="$(dirname "$OUTPUT_ABS")"
mkdir -p "$OUTPUT_DIR"

if [[ -n "$DESIGN_FILE" && -f "$DESIGN_FILE" ]]; then
  DESIGN_ABS="$(cd "$(dirname "$DESIGN_FILE")" && pwd)/$(basename "$DESIGN_FILE")"
  DESIGN_REF="$DESIGN_ABS"
else
  DESIGN_REF="本任务无 design.md"
fi

PROMPT_FILE="$(mktemp /tmp/opencode-subagent-prompt-XXXXXX.md)"
trap 'rm -f "$PROMPT_FILE"' EXIT

printf '%s\n' "# 独立 subAgent 提示词" "" \
  "你是独立 subAgent，与主对话实现者无关。你的全部结论只能来自输入契约与指定范围，不接受实现者的说明或自述。" "" \
  "## 输入" "" \
  "- 意图契约 story.md：${STORY_ABS}" \
  "- 方案契约 design.md：${DESIGN_REF}" \
  "- 核对范围：${SCOPE}" \
  "- 报告输出：${OUTPUT_ABS}" \
  "- 轮次：1" "" \
  "## 任务" "" \
  "1. 读取 story.md，提取验收标准（GWT 形式的 AC 列表）和 Won't 边界。" \
  "2. 读取 design.md（若有），提取方案范围和 NFR/依赖落实要求。" \
  "3. 按\"不漏/不重/不偏/不倚/不多/不少\"逐项核对指定范围内的文件。" \
  "4. 用 grep/rga/bash 等工具取证，必要时运行测试或命令。" \
  "5. 将报告写入 ${OUTPUT_ABS}，报告必须包含：" \
  "   - result: pass / fail" \
  "   - 每条 AC 的结论 + 证据（文件:行 或命令输出）" \
  "   - 越界/偏差清单" \
  "   - 待用户裁决项" \
  "   - 最后一行必须是 SUMMARY: result=pass/fail | fail=N | pending=N" "" \
  "## 铁律" "" \
  "- 不修改任何代码或契约。" \
  "- 不替用户裁决；拿不准的项写入「待用户裁决」。" \
  "- 找不到证据 = fail，不写\"应该实现了\"。" \
  "- 若核对范围中的文件不存在，如实记录并结论按保守原则计。" > "$PROMPT_FILE"

opencode run \
  "请按附件提示词执行独立 subAgent 任务。只读取指定文件，将报告写入 ${OUTPUT_ABS}，不修改任何代码。" \
  --format default \
  --agent build \
  -f "$PROMPT_FILE"

echo "---"
if [[ -f "$OUTPUT_FILE" ]]; then
  echo "报告已生成：$OUTPUT_FILE"
  tail -n 1 "$OUTPUT_FILE" | grep -E '^SUMMARY:' || true
else
  echo "警告：未找到报告文件 $OUTPUT_FILE" >&2
  exit 2
fi
