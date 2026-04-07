# Changelog

## [0.11.2] - 2026-04-07

### Bug Fixes
- Repair 13 broken frontend tests with i18n provider and updated assertions (a8ada58)

## [0.11.0] - 2026-04-07

### Features
- Add brainstorm module for session management and terminal control (d4671ab)
- Register brainstorm module and open_brainstorm_terminal command in main.rs (d903d89)
- Add openBrainstormTerminal IPC wrapper in tauri.ts (80e3d02)
- Add ideate skill to workspace template (1708570)
- Sync ideate skill to workspace on startup (245b418)
- Sync brainstorm session key when todo text is edited (19cbee2)
- Add 'Explore in Depth' context menu item for todos (24a36fc)

### Bug Fixes
- Remove -p flag from ideate CLI invocation for interactive mode (c3e6f18)
- Use PID file tracking for terminal reuse instead of AppleScript tab matching (53ee497)
- Simplify resume command to claude --resume {session_id} (803e3a8)
- Improve brainstorm session ID entropy and CLI flag (6daac5a)

### Other Changes
- Add ideate feature spec and implementation plan (0cb0d43)
- Move 'Explore in Depth' to top of todo context menu (428378c)
- Rename todo to ideas (想法) in sidebar labels (39c3147)
- Update screenshot to latest UI (01f0c35)
