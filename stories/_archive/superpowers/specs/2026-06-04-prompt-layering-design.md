# Prompt Layering Design

## Goal

Separate JournalClaw prompt rules into clear layers so platform contracts, user preferences, runtime context, and skill-specific rules do not drift into one large prompt.

## Layers

### Platform Contract

Source: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`.

This layer defines non-negotiable app behavior: workspace structure, file safety, identity update boundary, journal file format, append/create flow, and skill loading expectations.

It should not include dynamic values such as current time, recent summaries, or `identity/README.md`. Those are assembled at runtime by `build_system_prompt()`.

### User Soul

Source: `src-tauri/resources/workspace-template/CLAUDE.md`, copied to `workspace/CLAUDE.md` only when missing.

This layer captures the default secretary personality and output preferences: clear structure, concise language, uncertainty marking, concrete summaries, and evidence preservation.

It should not duplicate hard path rules or tool protocols already owned by the platform contract.

### Runtime Context

Source: `src-tauri/src/llm/prompt.rs` and `src-tauri/src/conversation.rs`.

This layer is generated per request: environment information, recent summaries, available-skill hint, user profile, and optional conversation context files.

Runtime memory should be explicitly grouped by code as `## 运行时记忆`, with recent summaries and user profile as subsections. This keeps memory separate from platform and user-authored prompt templates.

### Skill Pack

Source: `workspace/.claude/skills/*/SKILL.md` and global `~/.claude/skills`.

Skill content stays out of the base system prompt. The base prompt only tells the model to call `load_skill` when a skill is needed; `load_skill` returns the full `SKILL.md` on demand.

## Decisions

- Add `topics/` to the platform workspace structure as the area for topics, manuals, and long-lived thematic notes.
- Remove speaker-id-specific prohibitions from the platform contract.
- Move the full MDX component index out of the platform prompt. The platform prompt only says complete component details live in `/journal`.
- Keep the current explicit `load_skill` mechanism. Update documentation that still describes `workspace/skills` and automatic `triggers` loading.
- Update `build_system_prompt()` so recent summaries and `identity/README.md` are assembled into one runtime-memory section before the available-skills hint.
- Sync the resource-template `/journal` component catalog with current renderer component names: `HtmlPreview`, `PhonePreview`, `MacPreview`, math components, source components, and semantic components.

## Scope

This design changes prompt templates, prompt assembly code, and documentation. It does not change renderer behavior, LLM tool execution, or skill loading mechanics.
