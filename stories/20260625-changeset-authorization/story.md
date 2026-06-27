---
id: STORY-20260625-changeset-authorization
title: "ChangeSet + AuthorizationMode — trackable/reversible file ops (Sources safe operation)"
status: verified
source: orchestrator
level: L2
hypothesis_basis: reference
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - docs/verification-standard.md
---

# ChangeSet + AuthorizationMode

> Goal: every file operation an Agent performs is recorded as a ChangeSet (before/after hash, diff preview, risk, status), reversible via an in-workspace trash, and gated by a three-mode AuthorizationMode mapped to `claude --permission-mode`. Serves the user's "what's about to be modified" + safe local-asset operation requirements.

## 服务对象 / Object served

**Sources** (safe operation). The Agent operating local assets must be trackable and reversible. A ChangeSet is the unit of "what the Agent changed"; AuthorizationMode is the gate deciding what it may change.

## 背景

- ChangeSet + AuthorizationMode types already defined in packages/contracts/src/index.ts.
- AgentRunService currently hardcodes authorizationMode='workspace_write'.
- Real claude `--permission-mode` choices (measured): acceptEdits, auto, bypassPermissions, default, dontAsk, plan.

## 范围

### 实现
1. `apps/daemon/src/changeset/service.ts` — ChangeSetService: recordChangeSet, revertChangeSet, listChangeSets; remove ops move file to `<workspace>/.journal-trash/<id>/` (recoverable)
2. `apps/daemon/src/changeset/authorization.ts` — isPathAllowed(mode, root, path) decision engine + toClaudePermissionMode(mode) mapping (read_only->plan, workspace_write->acceptEdits, full_access->bypassPermissions)
3. `POST /runs` — accept authorizationMode; default workspace_write; pass to claude via --permission-mode
4. `GET /runs/:id/changesets` — list a run's change sets
5. sha256 hashing + diff preview for create/edit

### 独占文件
- `apps/daemon/src/changeset/service.ts` + `.test.ts`
- `apps/daemon/src/changeset/authorization.ts` + `.test.ts`
- `apps/daemon/src/server.ts` (POST /runs authorizationMode + GET /runs/:id/changesets)
- `apps/daemon/src/runtimes/defs/claude.ts` (buildArgs honors options.authorizationMode -> --permission-mode)

## 验收标准 (AC)

AC-1 recordChangeSet create/edit/move/remove with before/after hash + diffPreview; tests green
AC-2 remove moves file to .journal-trash/<id>/ and reversible via revertChangeSet; tests green
AC-3 isPathAllowed: read_only denies all writes ({allowed:false,reason}); workspace_write allows only inside root; full_access allows all
AC-4 toClaudePermissionMode: read_only->plan, workspace_write->acceptEdits, full_access/wide_with_audit->bypassPermissions
AC-5 POST /runs accepts authorizationMode (default workspace_write); claude buildArgs includes --permission-mode matching mode
AC-6 GET /runs/:id/changesets returns recorded change sets
AC-7 diff boundary: changeset/ + server.ts + claude.ts; daemon typecheck+test exit 0; 84 existing tests no regression

## 不做项

- no real claude tool-call interception (ChangeSet recorded by explicit daemon tool calls, not parsing claude edits yet)
- no UI (G13)
- no artifact index (G7)
- no multi-file atomic transactions

## 验收方式

docs/verification-standard.md: workspace-write tests + behavior contracts via direct service calls + authorization boundary tests.
