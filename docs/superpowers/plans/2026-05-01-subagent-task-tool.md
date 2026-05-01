# Subagent Task Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `task` tool to the Agent mode conversation system that spawns a subagent with fresh context, executes it independently, and returns only the summary text to the parent — keeping the parent's context clean.

**Architecture:** The `task` tool follows the subagent pattern from s04: the parent agent calls `task` with a prompt, a new LLM session runs with `messages=[]` and all tools except `task` itself (preventing recursion), and only the final text summary is returned as the tool result. The subagent reuses the existing `run_agent` function from `tool_loop.rs` with a dedicated system prompt. Streaming events from the subagent are forwarded to the frontend via a new `subtask_*` event family so the user can observe progress.

**Tech Stack:** Rust (Tauri backend), TypeScript/React (frontend), Anthropic Messages API

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/src/llm/task_tool.rs` | Create | Tool definition, execution (spawn subagent via `run_agent`), log_label |
| `src-tauri/src/llm/mod.rs` | Modify | Add `pub mod task_tool;` |
| `src-tauri/src/llm/tool_loop.rs` | Modify | Add `task` dispatch in tool execution match, accept tool exclusion param |
| `src-tauri/src/conversation.rs` | Modify | Add `task` to Agent tool list, wire dispatch + streaming |
| `src/hooks/useConversation.ts` | Modify | Handle `subtask_start` / `subtask_delta` / `subtask_end` events |
| `src/types.ts` | Modify | Add subtask block type to ConversationMessage |
| `src/components/ConversationDialog.tsx` | Modify | Render subtask blocks (collapsible) |

---

### Task 1: Create `task_tool.rs` — Tool Definition and Execution

**Files:**
- Create: `src-tauri/src/llm/task_tool.rs`

- [ ] **Step 1: Write the test for tool definition**

```rust
// At bottom of task_tool.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn definition_has_required_fields() {
        let def = definition();
        assert_eq!(def.name, "task");
        let props = def.input_schema.get("properties").unwrap();
        assert!(props.get("prompt").is_some());
        let required = def.input_schema.get("required").unwrap().as_array().unwrap();
        assert!(required.iter().any(|v| v.as_str() == Some("prompt")));
    }

    #[test]
    fn log_label_truncates_long_prompt() {
        let long = "a".repeat(200);
        let input = serde_json::json!({"prompt": long});
        let label = log_label(&input);
        assert!(label.len() < 200);
        assert!(label.ends_with('…'));
    }

    #[test]
    fn log_label_short_prompt() {
        let input = serde_json::json!({"prompt": "find test framework"});
        let label = log_label(&input);
        assert_eq!(label, "task: find test framework");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test task_tool --lib -- --nocapture`
Expected: FAIL — module doesn't exist yet

- [ ] **Step 3: Write the full `task_tool.rs` implementation**

```rust
use crate::config;
use serde_json::{json, Value};
use tokio_util::sync::CancellationToken;

use super::tool_loop;
use super::types::{ToolDefinition, ToolResult};
use super::LlmEngine;

const MAX_SUMMARY_CHARS: usize = 50_000;

const SUBAGENT_SYSTEM: &str = r#"你是一个子任务执行器。你被分配了一个具体任务，请高效完成并给出简洁的结果摘要。

规则：
- 专注于分配给你的任务，不要偏离
- 完成后给出清晰、简洁的摘要
- 如果任务无法完成，说明原因
- 你拥有 bash、文件读写等工具，但不能再派生子任务"#;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "task".to_string(),
        description: "派生一个独立子任务（subagent），在全新上下文中执行。子任务拥有 bash、文件读写等工具，完成后只返回摘要文本。适用于：需要大量文件读取/搜索的调研任务、独立的代码修改、不需要保留中间过程的操作。".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "子任务的详细指令。应包含足够的上下文，因为子任务无法看到当前对话历史。"
                }
            },
            "required": ["prompt"]
        }),
    }
}

pub async fn execute(
    input: &Value,
    workspace_path: &str,
    engine: &dyn LlmEngine,
    cancel: CancellationToken,
    on_event: impl Fn(tool_loop::AgentEvent) + Send + Sync + 'static,
    global_skills_enabled: bool,
) -> ToolResult {
    let prompt = match input.get("prompt").and_then(|v| v.as_str()) {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            return ToolResult {
                output: "error: missing or empty 'prompt' field".to_string(),
                is_error: true,
            };
        }
    };

    match tool_loop::run_agent(
        engine,
        workspace_path,
        SUBAGENT_SYSTEM,
        prompt,
        on_event,
        cancel,
        global_skills_enabled,
    )
    .await
    {
        Ok(summary) => {
            let mut text = summary;
            if text.chars().count() > MAX_SUMMARY_CHARS {
                text = text.chars().take(MAX_SUMMARY_CHARS).collect();
                text.push_str("\n\n[摘要已截断]");
            }
            ToolResult {
                output: text,
                is_error: false,
            }
        }
        Err(e) => ToolResult {
            output: format!("subtask failed: {}", e),
            is_error: true,
        },
    }
}

pub fn log_label(input: &Value) -> String {
    let prompt = input
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty)");
    let clean: String = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.chars().count() > 80 {
        format!("task: {}…", clean.chars().take(80).collect::<String>())
    } else {
        format!("task: {}", clean)
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test task_tool --lib -- --nocapture`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/llm/task_tool.rs
git commit -m "feat: add task_tool.rs — subagent tool definition and execution"
```

---

### Task 2: Register `task_tool` Module in LLM

**Files:**
- Modify: `src-tauri/src/llm/mod.rs:1-13`

- [ ] **Step 1: Add module declaration**

In `src-tauri/src/llm/mod.rs`, add `pub mod task_tool;` after the existing module declarations:

```rust
pub mod anthropic;
pub mod bash_tool;
pub mod enable_skill;
pub mod fs_tools;
pub mod loop_detector;
pub mod model_quirks;
pub mod openai_compat;
pub mod output_compress;
pub mod prompt;
pub mod retry;
pub mod sse_parser;
pub mod task_tool;
pub mod tool_loop;
pub mod types;
```

- [ ] **Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/llm/mod.rs
git commit -m "feat: register task_tool module in llm"
```

---

### Task 3: Wire `task` Tool into `conversation.rs` Agent Mode

**Files:**
- Modify: `src-tauri/src/conversation.rs`

This is the most complex task. We need to:
1. Add `task` to the Agent tool list
2. Add dispatch logic in the tool execution match
3. Forward subagent events as `subtask_*` streaming events

- [ ] **Step 1: Add `task` tool to the Agent tool list**

In `run_conversation_turn`, find the tool list construction (around line 1467-1478):

```rust
let tools = match mode {
    SessionMode::Agent => {
        let skills = llm::prompt::scan_skills(workspace, global_skills).await;
        let mut t = vec![
            llm::bash_tool::definition(),
            llm::enable_skill::definition(&skills),
            llm::task_tool::definition(),
        ];
        t.extend(llm::fs_tools::definitions());
        t
    }
    _ => vec![],
};
```

- [ ] **Step 2: Add `task` dispatch in the tool execution match**

In `run_conversation_turn`, find the tool dispatch match (around line 1736-1756). Add the `"task"` arm before the `fs_name` fallback:

```rust
let (result, image_data) = match name.as_str() {
    "bash" => (llm::bash_tool::execute(input, workspace).await, None),
    "load_skill" => {
        (llm::enable_skill::execute(input, workspace).await, None)
    }
    "task" => {
        let sub_cancel = cancel.child_token();
        let app_for_sub = app.clone();
        let sid_for_sub = sid.clone();
        let tool_id_for_sub = id.clone();
        // Emit subtask_start
        let _ = app.emit(
            "conversation-stream",
            ConversationStreamPayload {
                session_id: sid.clone(),
                event: "subtask_start".to_string(),
                data: serde_json::json!({
                    "tool_use_id": id,
                    "prompt": input.get("prompt").and_then(|v| v.as_str()).unwrap_or(""),
                }).to_string(),
            },
        );
        let result = llm::task_tool::execute(
            input,
            workspace,
            engine,
            sub_cancel,
            move |evt| {
                match &evt {
                    llm::tool_loop::AgentEvent::TextDelta(text) => {
                        let _ = app_for_sub.emit(
                            "conversation-stream",
                            ConversationStreamPayload {
                                session_id: sid_for_sub.clone(),
                                event: "subtask_delta".to_string(),
                                data: serde_json::json!({
                                    "tool_use_id": tool_id_for_sub,
                                    "text": text,
                                }).to_string(),
                            },
                        );
                    }
                    llm::tool_loop::AgentEvent::ToolStart { name, .. } => {
                        let _ = app_for_sub.emit(
                            "conversation-stream",
                            ConversationStreamPayload {
                                session_id: sid_for_sub.clone(),
                                event: "subtask_delta".to_string(),
                                data: serde_json::json!({
                                    "tool_use_id": tool_id_for_sub,
                                    "tool": name,
                                }).to_string(),
                            },
                        );
                    }
                    _ => {}
                }
            },
            global_skills,
        ).await;
        // Emit subtask_end
        let _ = app.emit(
            "conversation-stream",
            ConversationStreamPayload {
                session_id: sid.clone(),
                event: "subtask_end".to_string(),
                data: serde_json::json!({
                    "tool_use_id": id,
                    "is_error": result.is_error,
                }).to_string(),
            },
        );
        (result, None)
    }
    fs_name => {
        // ... existing fs_tools dispatch
    }
};
```

- [ ] **Step 3: Add `task` to the log_label match**

Find the label generation match (around line 1722-1726) and add the `"task"` arm:

```rust
let label = match name.as_str() {
    "bash" => llm::bash_tool::log_label(input),
    "load_skill" => llm::enable_skill::log_label(input),
    "task" => llm::task_tool::log_label(input),
    n => llm::fs_tools::log_label(n, input),
};
```

Also add the same in `messages_to_display` (around line 396-399):

```rust
let label = match *tool_name {
    "bash" => llm::bash_tool::log_label(tool_input),
    "load_skill" => llm::enable_skill::log_label(tool_input),
    "task" => llm::task_tool::log_label(tool_input),
    name => llm::fs_tools::log_label(name, tool_input),
};
```

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/conversation.rs
git commit -m "feat: wire task tool into Agent mode conversation loop"
```

---

### Task 4: Wire `task` Tool into `tool_loop.rs` (Background AI Processor)

**Files:**
- Modify: `src-tauri/src/llm/tool_loop.rs`

The standalone `run_agent` in `tool_loop.rs` is used by `ai_processor.rs` for background processing. It also needs the `task` tool — but we must prevent recursion (subagent spawning another subagent).

- [ ] **Step 1: Add `exclude_task_tool` parameter to `run_agent`**

Change the `run_agent` signature to accept an optional flag:

```rust
pub async fn run_agent(
    engine: &dyn LlmEngine,
    workspace_path: &str,
    system_prompt: &str,
    user_prompt: &str,
    on_event: impl Fn(AgentEvent) + Send + Sync + 'static,
    cancel: CancellationToken,
    global_skills_enabled: bool,
) -> Result<String, LlmError> {
```

No signature change needed — the subagent system prompt in `task_tool.rs` already uses `SUBAGENT_SYSTEM` which says "你拥有 bash、文件读写等工具，但不能再派生子任务". The `task` tool is simply not included in the tool list when `task_tool::execute` calls `run_agent`, because `run_agent` builds its own tool list from `bash_tool::definition()` + `enable_skill::definition()` + `fs_tools::definitions()` — it never includes `task_tool::definition()`.

This means no code change is needed in `tool_loop.rs` for recursion prevention — it's already safe by construction.

- [ ] **Step 2: Verify the tool list in `run_agent` does NOT include `task`**

Read `src-tauri/src/llm/tool_loop.rs` lines 47-49 and confirm:

```rust
let mut tools = vec![bash_tool::definition(), enable_skill::definition(&skills)];
tools.extend(fs_tools::definitions());
```

No `task_tool::definition()` — subagents cannot spawn sub-subagents. Confirmed safe.

- [ ] **Step 3: Run existing tests**

Run: `cd src-tauri && cargo test tool_loop --lib -- --nocapture`
Expected: All existing tests PASS (no regression)

- [ ] **Step 4: Commit (no-op — document the design decision)**

No code changes needed. The recursion prevention is architectural: `run_agent` builds its own tool list without `task`, so subagents can never call `task`.

---

### Task 5: Add Subtask Block Types to Frontend Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Find the ConversationMessage block type definition**

Read `src/types.ts` and locate the block type union. Add `subtask` block type.

In the `ConversationMessage` interface's `blocks` array type, add:

```typescript
| {
    type: 'subtask'
    toolUseId: string
    prompt: string
    summary?: string
    isError?: boolean
    isRunning?: boolean
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add subtask block type to ConversationMessage"
```

---

### Task 6: Handle Subtask Streaming Events in `useConversation.ts`

**Files:**
- Modify: `src/hooks/useConversation.ts`

- [ ] **Step 1: Add `subtask_start` event handler**

In the `switch (evt)` block inside the `listen` callback, add after the `loop_warning` case:

```typescript
case 'subtask_start': {
  const info = JSON.parse(data)
  updateSessionMessages(sid, (prev) => {
    const last = prev[prev.length - 1]
    if (last?.role === 'assistant') {
      const blocks = [
        ...(last.blocks ?? []),
        {
          type: 'subtask' as const,
          toolUseId: info.tool_use_id,
          prompt: info.prompt,
          isRunning: true,
        },
      ]
      return [...prev.slice(0, -1), { ...last, blocks }]
    }
    return prev
  })
  break
}
```

- [ ] **Step 2: Add `subtask_delta` event handler**

```typescript
case 'subtask_delta': {
  const info = JSON.parse(data)
  updateSessionMessages(sid, (prev) => {
    const last = prev[prev.length - 1]
    if (last?.role === 'assistant') {
      const blocks = [...(last.blocks ?? [])]
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i]
        if (b.type === 'subtask' && b.toolUseId === info.tool_use_id) {
          if (info.text) {
            blocks[i] = { ...b, summary: (b.summary ?? '') + info.text }
          }
          break
        }
      }
      return [...prev.slice(0, -1), { ...last, blocks }]
    }
    return prev
  })
  break
}
```

- [ ] **Step 3: Add `subtask_end` event handler**

```typescript
case 'subtask_end': {
  const info = JSON.parse(data)
  updateSessionMessages(sid, (prev) => {
    const last = prev[prev.length - 1]
    if (last?.role === 'assistant') {
      const blocks = [...(last.blocks ?? [])]
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i]
        if (b.type === 'subtask' && b.toolUseId === info.tool_use_id) {
          blocks[i] = { ...b, isRunning: false, isError: info.is_error }
          break
        }
      }
      return [...prev.slice(0, -1), { ...last, blocks }]
    }
    return prev
  })
  break
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useConversation.ts
git commit -m "feat: handle subtask streaming events in useConversation"
```

---

### Task 7: Render Subtask Blocks in ConversationDialog

**Files:**
- Modify: `src/components/ConversationDialog.tsx`

- [ ] **Step 1: Find the block rendering section**

Read `src/components/ConversationDialog.tsx` and locate where blocks are rendered (the `blocks.map()` or similar pattern). Add a case for `type === 'subtask'`.

- [ ] **Step 2: Add subtask block rendering**

The subtask block should render as a collapsible section, similar to tool blocks but with a distinct visual treatment:

```tsx
{block.type === 'subtask' && (
  <div className="subtask-block">
    <div
      className="subtask-header"
      onClick={() => toggleSubtask(block.toolUseId)}
    >
      <span className="subtask-icon">
        {block.isRunning ? '⟳' : block.isError ? '✗' : '✓'}
      </span>
      <span className="subtask-label">
        {block.prompt.length > 60
          ? block.prompt.slice(0, 60) + '…'
          : block.prompt}
      </span>
    </div>
    {expandedSubtasks.has(block.toolUseId) && block.summary && (
      <div className="subtask-summary">
        <MarkdownRenderer content={block.summary} />
      </div>
    )}
  </div>
)}
```

Style the subtask block to match the existing tool block aesthetic — muted background, small text, collapsible. Use the project's existing CSS patterns (check how tool blocks are styled).

- [ ] **Step 3: Add `expandedSubtasks` state**

```tsx
const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set())

const toggleSubtask = (id: string) => {
  setExpandedSubtasks((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev` (or `npm run tauri dev`)
Test: Start an Agent conversation, ask it to use a subtask. Verify the subtask block appears, shows running state, then completes with summary.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConversationDialog.tsx
git commit -m "feat: render subtask blocks in ConversationDialog"
```

---

### Task 8: Integration Test — End-to-End Subtask Flow

**Files:**
- No new files — manual verification

- [ ] **Step 1: Build and run**

Run: `npm run tauri dev`

- [ ] **Step 2: Test basic subtask flow**

1. Open a conversation in Agent mode
2. Send: "用子任务帮我查一下这个项目用了什么测试框架"
3. Verify: The agent calls the `task` tool
4. Verify: A subtask block appears with running indicator
5. Verify: The subtask block shows streaming text as the subagent works
6. Verify: The subtask completes and shows a summary
7. Verify: The parent agent receives the summary and continues

- [ ] **Step 3: Test cancellation**

1. Start a subtask
2. Click cancel on the conversation
3. Verify: Both parent and subtask stop cleanly

- [ ] **Step 4: Test error handling**

1. Send a prompt that would cause the subtask to fail (e.g., reference a nonexistent file)
2. Verify: The subtask block shows error state
3. Verify: The parent agent receives the error and can recover

- [ ] **Step 5: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 6: Run frontend build check**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Commit any fixes from integration testing**

```bash
git add -A
git commit -m "fix: integration test fixes for task tool"
```
