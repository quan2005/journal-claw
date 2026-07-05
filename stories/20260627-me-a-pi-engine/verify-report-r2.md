---
result: pass
round: 2
story: stories/20260627-me-a-pi-engine/story.md
design: none
verified_at: 2026-06-27
---

# Verification Report · Round 2

## Scope

Authoritative implementation scope for this round:

- `apps/daemon/src/engine/service.ts`
- `apps/daemon/src/engine/service.test.ts`
- Existing referenced code needed to judge the contract, especially `apps/daemon/src/config/service.ts` and installed pi package docs/types.

Per round instruction, `@earendil-works/pi-ai` and `@earendil-works/pi-agent-core` are treated as already installed. `apps/daemon/package.json` and `pnpm-lock.yaml` are not treated as implementation scope for this round.

## Criteria

### 1. pi Agent service skeleton

Conclusion: pass.

Evidence:

- `PiEngineService` is introduced as a daemon engine entry point and wraps pi `Agent`: `apps/daemon/src/engine/service.ts:49`.
- `createAgent()` builds a pi `Agent` with system prompt, resolved model, empty tools, empty messages, `streamFn`, and dynamic `getApiKey`: `apps/daemon/src/engine/service.ts:86` to `apps/daemon/src/engine/service.ts:97`.
- `prompt()` subscribes to pi events, runs `agent.prompt(input)`, and returns collected events/event types: `apps/daemon/src/engine/service.ts:100` to `apps/daemon/src/engine/service.ts:113`.
- pi Agent docs show `agent_start` / `agent_end` lifecycle event types and `getApiKey` as an Agent option: `apps/daemon/node_modules/@earendil-works/pi-agent-core/README.md:142` to `apps/daemon/node_modules/@earendil-works/pi-agent-core/README.md:191`.

### 2. ConfigService vendor/model/baseURL/api key resolution

Conclusion: pass.

Evidence:

- `ConfigService` defines `ProviderEntry` fields required by the engine: `protocol`, `id`, `label`, `api_key`, `base_url`, and `model`: `apps/daemon/src/config/service.ts:6` to `apps/daemon/src/config/service.ts:13`.
- `ConfigService` persists and returns normalized `EngineConfig`: `apps/daemon/src/config/service.ts:107` to `apps/daemon/src/config/service.ts:114`, with normalization for provider fields at `apps/daemon/src/config/service.ts:260` to `apps/daemon/src/config/service.ts:304`.
- `PiEngineService.resolveActiveProvider()` reads `getEngineConfig()`, selects `active_provider`, and rejects missing provider/model: `apps/daemon/src/engine/service.ts:115` to `apps/daemon/src/engine/service.ts:125`.
- Model resolution uses pi `createModels()` plus built-in Anthropic/OpenAI providers, extra injected providers, and optional OpenAI-compatible provider registration before `models.getModel(provider.id, provider.model)`: `apps/daemon/src/engine/service.ts:55` to `apps/daemon/src/engine/service.ts:73`.
- API key resolution supports provider-level key first and falls back to encrypted global key from `ConfigService.getApiKey()`: `apps/daemon/src/engine/service.ts:79` to `apps/daemon/src/engine/service.ts:82` and `apps/daemon/src/engine/service.ts:127` to `apps/daemon/src/engine/service.ts:130`.
- `ConfigService.setApiKey()` encrypts keys and `getApiKey()` decrypts them: `apps/daemon/src/config/service.ts:90` to `apps/daemon/src/config/service.ts:105`, `apps/daemon/src/config/service.ts:197` to `apps/daemon/src/config/service.ts:224`.

### 3. Domestic vendors through openai-completions with custom baseURL

Conclusion: pass.

Evidence:

- Domestic vendors are explicitly enumerated as OpenAI-compatible: `volcengine`, `zhipu`, and `dashscope`: `apps/daemon/src/engine/service.ts:35`.
- Default base URLs are present for those vendors: `apps/daemon/src/engine/service.ts:36` to `apps/daemon/src/engine/service.ts:40`.
- `shouldRegisterOpenAICompatibleProvider()` registers a custom provider when the configured model is not already known and the provider is domestic, or when protocol is `openai` with a `base_url`: `apps/daemon/src/engine/service.ts:133` to `apps/daemon/src/engine/service.ts:140`.
- `createOpenAICompatibleProvider()` uses pi `createProvider()` with `openAICompletionsApi()` and the resolved base URL: `apps/daemon/src/engine/service.ts:142` to `apps/daemon/src/engine/service.ts:160`.
- The custom model has `api: 'openai-completions'`, configured provider/model, model-level `baseUrl`, and compatibility flags: `apps/daemon/src/engine/service.ts:163` to `apps/daemon/src/engine/service.ts:183`.
- pi-ai docs confirm custom providers use `createProvider()` with `openAICompletionsApi()` and model/provider `baseUrl`: `apps/daemon/node_modules/@earendil-works/pi-ai/README.md:916` to `apps/daemon/node_modules/@earendil-works/pi-ai/README.md:947`.
- Tests cover zhipu with encrypted global key and custom baseURL: `apps/daemon/src/engine/service.test.ts:47` to `apps/daemon/src/engine/service.test.ts:66`.
- Tests cover volcengine and dashscope with configured OpenAI-compatible base URLs and assert model registration: `apps/daemon/src/engine/service.test.ts:68` to `apps/daemon/src/engine/service.test.ts:82`.

### 4. faux provider test event lifecycle

Conclusion: pass.

Evidence:

- The test imports pi faux helpers and creates a faux provider/model: `apps/daemon/src/engine/service.test.ts:5`, `apps/daemon/src/engine/service.test.ts:21` to `apps/daemon/src/engine/service.test.ts:30`.
- The test calls `service.prompt('ping')` and asserts lifecycle starts with `agent_start`, includes turn/message events and `message_update`, ends with `turn_end` then `agent_end`, and makes exactly one faux provider call: `apps/daemon/src/engine/service.test.ts:32` to `apps/daemon/src/engine/service.test.ts:44`.
- pi-ai docs document the faux provider API used by the test: `apps/daemon/node_modules/@earendil-works/pi-ai/README.md:1101` to `apps/daemon/node_modules/@earendil-works/pi-ai/README.md:1128`.

### 5. No AgentRunService/bash/fs/frontend integration

Conclusion: pass.

Evidence:

- `apps/daemon/src/engine/service.ts` imports only pi packages and `ConfigService`: `apps/daemon/src/engine/service.ts:1` to `apps/daemon/src/engine/service.ts:14`.
- The service configures `tools: []`, so no bash/fs tool integration is introduced: `apps/daemon/src/engine/service.ts:89` to `apps/daemon/src/engine/service.ts:94`.
- Search command:

```text
rg -n "AgentRunService|runs/service|child_process|exec\(|spawn\(|node:fs|@tauri|invoke\(|frontend|bash|shell" apps/daemon/src/engine
```

Output:

```text
apps/daemon/src/engine/service.test.ts:1:import { mkdirSync, rmSync } from 'node:fs'
```

This `node:fs` usage is limited to test temp directory setup/cleanup and is not engine service integration.

### 6. No package install or package/lockfile edits in scoped implementation files

Conclusion: pass for this round's authoritative implementation scope, with note.

Evidence:

- The scoped implementation files are only `apps/daemon/src/engine/service.ts` and `apps/daemon/src/engine/service.test.ts`; neither file edits package metadata or lockfiles.
- Current worktree does contain `apps/daemon/package.json` and `pnpm-lock.yaml` modifications:

```text
git status --short
 M apps/daemon/package.json
 M docs/adr/rust-removal-roadmap.md
 M pnpm-lock.yaml
?? apps/daemon/src/engine/
?? stories/20260627-me-a-pi-engine/
```

- Per this round's explicit instruction, those dependency files are pre-existing/out-of-scope for judging this implementation round and were not treated as implementation evidence.

### 7. Acceptance commands

Conclusion: pass.

Evidence:

Command:

```text
pnpm --filter @journal/daemon typecheck
```

Result:

```text
> @journal/daemon@0.16.0 typecheck /Users/yanwu/Projects/github/journal/apps/daemon
> tsc --noEmit
```

Exit code: 0.

Command:

```text
pnpm --filter @journal/daemon test -- src/engine/service.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

Exit code: 0.

Command:

```text
pnpm --filter @journal/daemon test
```

Result:

```text
Test Files  66 passed (66)
Tests       396 passed (396)
```

Exit code: 0.

## Final Decision

Pass. The round 2 scoped implementation satisfies the approved story for ME-a: it provides a minimal pi Agent engine service, resolves engine configuration and encrypted API key fallback through `ConfigService`, registers domestic vendors through pi OpenAI-compatible providers with custom base URLs, verifies faux provider event lifecycle, and does not integrate AgentRunService, tools, bash/fs runtime behavior, or frontend code.
