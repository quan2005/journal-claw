---
id: STORY-20260625-coding-agent-adapters
title: "Coding Agent Registry + claude -p adapter (Runs execution engine)"
status: approved
source: orchestrator
level: L2
hypothesis_basis: reference
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - docs/verification-standard.md
---

# Coding Agent Registry + claude -p adapter

> Goal: let journal daemon spawn `claude -p`, parse its stream into unified AgentRunEvent, feed into AgentRunService. This is the Runs object's execution engine, and the user's explicit "use claude -p" ask.

## 服务对象 / Object served

**Runs**. G4 made a Run a creatable/subscribable object but it has no "executor". This task wires real Coding Agent CLI so the core loop "user states goal -> agent executes -> emits event stream" runs for the first time.

## 背景

- G1-G4 verified: monorepo + daemon + contracts(AgentRun/AgentRunEvent) + AgentRunService(POST /runs + SSE + JSONL + cancel).
- open-design has a mature form: RuntimeAgentDef + dedup registry + 25+ defs. This task replicates claude first, leaves registry extension points.
- Real `claude -p --output-format stream-json --verbose` schema captured on this machine.

### claude stream schema (measured)
- `{"type":"system","subtype":"init", cwd, session_id, tools[], model, permissionMode}`
- `{"type":"system","subtype":"hook_started"/"hook_response", hook_id, exit_code, outcome}`
- `{"type":"system","subtype":"api_retry", attempt, max_retries, retry_delay_ms, error}`
- `{"type":"assistant", message:{content:[{type:"text",text}|{type:"tool_use",id,name,input}|{type:"thinking",thinking}]}}`
- `{"type":"result", subtype:"result", result, costUSD, usage, session_id}`
- auth: `claude auth status` -> `{loggedIn, authMethod, apiProvider}`
- version: `claude --version` -> "2.1.191 (Claude Code)"

## 范围

### 实现
1. `packages/contracts/src/runtime.ts` — RuntimeAgentDef + AgentAuthStatus
2. `apps/daemon/src/runtimes/registry.ts` — dedup registry
3. `apps/daemon/src/runtimes/defs/claude.ts` — claude adapter def
4. `apps/daemon/src/runtimes/stream/claudeStream.ts` — claude stream -> AgentRunEvent parser
5. `apps/daemon/src/runtimes/runner.ts` — spawn bridge
6. `POST /runs` upgrade — agentId (default 'claude') + prompt; async executeRun after create
7. `GET /agents` — list registered adapters

### 独占文件
- `packages/contracts/src/runtime.ts` + `index.ts` re-export (additive) + `runtime.test.ts`
- `apps/daemon/src/runtimes/registry.ts` + `.test.ts`
- `apps/daemon/src/runtimes/defs/claude.ts`
- `apps/daemon/src/runtimes/stream/claudeStream.ts` + `.test.ts`
- `apps/daemon/src/runtimes/runner.ts` + `.test.ts`
- `apps/daemon/src/server.ts` (change: POST /runs agentId + GET /agents)

## 验收标准 (AC)

AC-1 contracts export RuntimeAgentDef/AgentAuthStatus; typecheck+test exit 0
AC-2 registry dedups (dup id throws); getAgentDef('claude') non-null; listAgentDefs>=1
AC-3 claude buildArgs has -p/--output-format stream-json/--verbose; promptViaStdin=true
AC-4 claudeStream on real-schema fixture -> run_started/text_delta/tool_call/run_finished; isAgentRunEvent true
AC-5 runner with mock spawn -> service.readEvents(runId) full sequence; run terminal succeeded
AC-6 POST /runs with agentId -> 201; GET /agents contains claude; default claude
AC-7 diff only allowed files; daemon typecheck+test exit 0; existing 38 tests no regression

## 不做项

- no codex/opencode real run (claude only; registry extensible)
- no ChangeSet/AuthorizationMode (G8/G9)
- no frontend Workbench (G12)
- no run summary/sedimentation (G14)
- no node-pty (stream-json is line protocol; spawn enough)

## 验收方式

docs/verification-standard.md: Codex workspace-write + git diff boundary check + mock fixtures for behavior (real claude run degraded to fixture since CI can't guarantee auth).

## 参考

- open-design apps/daemon/src/runtimes/defs/claude.ts + registry.ts + stream/claude-stream.ts
