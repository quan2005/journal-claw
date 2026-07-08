# Pasted Long Text Raw Attachment Design

## Goal

When text pasted into the chat input exceeds the existing long-text attachment
threshold, save it immediately in the current month's workspace `raw/`
directory and attach the returned file path.

## Scope

- Replace the long-text paste call from `importTextTemp` to the existing
  `importText` IPC wrapper.
- Keep the existing threshold and attachment UI behavior.
- Keep pasted files, dropped files, and files selected from the picker as
  references to their original paths.
- Do not trigger journal AI processing when the attachment is created.

## Data Flow

1. `ChatPanel` detects pasted text longer than
   `LONG_TEXT_ATTACHMENT_THRESHOLD`.
2. `ChatPanel` calls `importText(rawText)`.
3. Rust `materials::import_text` writes the text into the current month's
   `raw/` directory.
4. `ChatPanel` adds the returned workspace path as an attachment.
5. Sending the message includes that path as an `@path` reference.

## Error Handling

The existing warning toast remains the user-visible failure path when the IPC
call fails.

## Verification

Update the `ChatPanel` regression test to assert that long pasted text calls
`importText` and that the sent attachment references the returned `raw/` path.
