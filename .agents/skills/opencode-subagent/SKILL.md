---
name: opencode-subagent
description: Use when dispatching independent subagents via opencode CLI in the Journal repository, especially for verification-gate, requirements-gate, or docs-maintenance tasks where context isolation and standardized report output are required.
---

# opencode-subagent

## Overview

Use `opencode run` as a headless subagent backend. It spawns a clean session, reads files, runs shell commands, writes a report, and returns a summary. This skill standardizes the call pattern so you don't reinvent it per task.

## When to Use

- A task explicitly asks for an **independent subagent** (e.g. verification-gate, docs-maintenance, requirements-gate follow-ups).
- The host `Agent`/`Task` tool is unavailable, expensive, or you want a fully external, auditable subagent run.
- The subagent output must be a **file on disk** (report) that the main conversation can read and act on.

**Do not use when:**

- The task is a simple inline read/grep that doesn't need an independent agent.
- The task requires real-time back-and-forth collaboration with the subagent (opencode run is one-shot).
- You are not sure `opencode` is installed; check first with `which opencode`.

## Core Pattern

```bash
# From repository root
./.agents/skills/opencode-subagent/opencode-subagent.sh \
  <story.md> \
  [design.md] \
  "<space-separated file paths or scope>" \
  <output-report.md>
```

The helper script is also available via the legacy-compatible symlink at `.opencode/opencode-subagent.sh`.

The script:

1. Renders a self-contained prompt from the inputs.
2. Calls `opencode run --agent build -f prompt.md "..."`.
3. Verifies the report file exists and prints the last `SUMMARY:` line.

The subagent report must end with exactly one line in this form:

```
SUMMARY: result=pass | fail=N | pending=N
```

## Quick Reference

| Item                   | Rule                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary agent          | Always `--agent build`. Do not use `general` or other subagents as primary.                                                                                              |
| Message order          | `opencode run "<short message>" --format default --agent build -f <prompt.md>`                                                                                           |
| Output path            | Write reports **inside the repository** (e.g. `stories/.../verify-report-opencode.md`), never to `/tmp`.                                                                 |
| Format                 | Use `--format default` for human-readable streamed output; use `--format json` only if the caller will parse the event stream.                                           |
| Permissions            | Do **not** use `--dangerously-skip-permissions`. If a write fails, change the output path to a repo directory or adjust `build` agent permissions in opencode config.    |
| `--dir`                | Do not use `--dir` for local cwd. Run from the repository root or `cd` before the command.                                                                               |
| Temporary prompt files | The helper script writes its internal prompt to `/tmp` automatically (read by opencode, not the final report). The **report output path** must still be inside the repo. |

## Failure & Fallback

If the opencode subagent run fails:

1. **Inspect the error.** Use the Troubleshooting table to identify the root cause (wrong argument order, `/tmp` output, missing file, etc.).
2. **Fix the invocation.** Correct one mistake and re-run **once**. Do not loop indefinitely.
3. **If it still fails**, choose one of:
   - **Escalate to the user** with the error and ask whether to proceed.
   - **Fall back to the host `Agent`/`Task` tool** if the task still requires an independent subagent and the failure is environmental (e.g. opencode CLI unavailable).
   - **Abandon the subagent approach** if the task can be done inline without independence.

Do not hide the failure, do not fabricate a report, and do not use `--dangerously-skip-permissions` to force success.

## Common Mistakes

| Mistake                                             | Why it fails                                                                                 | Fix                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `opencode run -f prompt.md "message"`               | opencode parses the message as another file argument.                                        | Put message first, then `-f prompt.md`.                                                             |
| `--agent general`                                   | `general` is a subagent, not a primary agent; opencode falls back to `build`.                | Always use `--agent build`.                                                                         |
| Writing report to `/tmp`                            | `external_directory (/tmp/*)` is `ask` by default and auto-rejected in non-interactive mode. | Write to a repo directory.                                                                          |
| `--dangerously-skip-permissions`                    | Bypasses all permissions; unsafe and unnecessary if output path is in the repo.              | Remove it; fix the path or permissions instead.                                                     |
| Pasting a long prompt directly into the message arg | Hard to read, easy to mis-escape, and may exceed argument limits.                            | Write the prompt to a file and use `-f`.                                                            |
| Letting the subagent choose its own scope           | Causes drift (e.g. falling back to `MarkdownRenderer` when `MdxRenderer` is missing).        | Scope is fixed by the caller; the subagent reports "file not found" rather than substituting files. |

## Red Flags — STOP and Re-read This Skill

- You typed `--dangerously-skip-permissions`.
- The **report output** path starts with `/tmp/` or `/var/tmp/`.
- The scope is the same as the story.md path.
- The command has more than one bare string after flags.
- You are using `--agent general` or any agent other than `build`.
- The prompt is inline in the shell command instead of in a file.
- You are about to report success without verifying the report file exists.
- You are about to fabricate a summary because the run "mostly worked".

## Troubleshooting

| Symptom                                                             | Cause                                          | Action                                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `File not found: <your message>`                                    | `-f` flag consumed the message as a file path. | Reorder: message first, `-f` second.                                             |
| `permission requested: external_directory (/tmp/*); auto-rejecting` | Report path outside repo.                      | Change output path to a directory inside the repo.                               |
| `agent "general" is a subagent, not a primary agent`                | Wrong `--agent` value.                         | Use `--agent build`.                                                             |
| Report file missing after run                                       | Subagent failed silently or wrote elsewhere.   | Re-run with `--format json` and inspect the event stream, or check the path.     |
| Subagent drifts from specified scope                                | Prompt allowed substitution.                   | Pass an exact file list and instruct "only read these files; do not substitute." |

## Rationalizations — Don't Fall For These

| Excuse                                                    | Reality                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| "`--dangerously-skip-permissions` is fine just this once" | It disables all permission checks. One mistake and the subagent can write anywhere.           |
| "`/tmp` is easier for a quick test"                       | opencode auto-rejects `/tmp` writes in headless mode; the test fails or you bypass unsafely.  |
| "I'll put the whole prompt in the command"                | Shell escaping breaks; use a prompt file.                                                     |
| "`general` agent is more independent"                     | `general` is a subagent role, not a primary agent for `opencode run`.                         |
| "The subagent can figure out the right files"             | That defeats independence; scope must come from the caller.                                   |
| "The story path is a fine scope"                          | Scope must be the actual files to verify, not the story.md itself.                            |
| "I'll just tell the user it passed"                       | If the report file is missing or the run failed, success is a lie. Verify before summarizing. |
