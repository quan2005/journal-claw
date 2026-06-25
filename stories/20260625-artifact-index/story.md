---
id: STORY-20260625-artifact-index
title: "Artifact index — promote Agent output to first-class asset (G7)"
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

# Artifact index (G7)

> Goal: promote Agent-produced Artifacts (articles/outlines/reports/summaries/plans/todos) from ephemeral chat-stream `<artifact>` tags into independent, indexed, traceable assets — the "Artifacts" first-class object. Each artifact carries the run that produced it so the evidence chain (Sources → Run → Artifact) is traceable.

## 服务对象 / Object served

**Artifacts**. Outputs are core results (first principle: "output is the core result"). Today artifacts are only stream tags; G7 makes them queryable assets.

## 范围

### 实现
1. `packages/contracts/src/artifact.ts` — Artifact type + isArtifact guard
2. `apps/daemon/src/artifacts/index.ts` — ArtifactIndexService: recordArtifact / getArtifact / listByRun / listByType / listAll / captureFromRun (scans <artifact> tags)
3. `GET /runs/:id/artifacts` + `GET /artifacts?type=` routes

### 独占文件
- packages/contracts/src/artifact.ts + index.ts re-export
- apps/daemon/src/artifacts/index.ts + .test.ts
- apps/daemon/src/server.ts (2 routes)

## 验收标准 (AC)
AC-1 Artifact contract exported; typecheck+test exit 0
AC-2 recordArtifact/getArtifact/listByRun/listByType/listAll behave; tests green
AC-3 captureFromRun indexes <artifact type title>content</artifact> tags (multiple, missing-close tolerant); tests green
AC-4 GET /runs/:id/artifacts + GET /artifacts return indexed artifacts
AC-5 diff boundary clean; daemon typecheck+test exit 0; 116 existing tests no regression

## 不做项
- no persistence to disk beyond in-memory (JSONL run log already captures artifact_created)
- no frontend artifact browser (separate task)
- no source-binding auto-population (G6)

## 验收方式
docs/verification-standard.md: unit tests + behavior contracts.
