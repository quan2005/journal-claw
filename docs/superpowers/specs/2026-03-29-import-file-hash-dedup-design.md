# import_file Hash Deduplication Design

**Date:** 2026-03-29
**Scope:** `src-tauri/src/materials.rs` + `src/App.tsx`

---

## Problem

`import_file` 每次都 copy 文件到 `raw/`，同名时加时间戳后缀。内容相同的文件反复拖入会产生多份副本并多次触发 AI 处理，造成浪费。

## Goal

同一文件内容只存一份，重复拖入时静默跳过。

---

## Approach: Hash-in-Filename

文件内容的 SHA-256 前 8 位十六进制嵌入文件名末尾：

```
meeting-notes.docx  →  meeting-notes-a3f9c812.docx
```

- 无需额外状态文件
- 文件名自描述，Finder 里可读
- 重复检测：目标文件已存在 ↔ 内容相同

---

## Data Flow

```
import_file(src_path)
  → file_hash(src_path) → hash8 (first 8 hex chars of SHA-256)
  → dest = raw/{stem}-{hash8}.{ext}
  → dest exists?
      yes → return ImportResult { already_exists: true, path: dest, ... }
      no  → fs::copy(src, dest)
           → return ImportResult { already_exists: false, path: dest, ... }
```

---

## Changes

### `src-tauri/src/materials.rs`

1. **`file_hash(path: &str) -> Result<String, String>`** — 新函数，读文件、SHA-256、取前 8 位十六进制。使用标准库 + `sha2` crate。
2. **`dest_filename(src_path: &str, hash: &str) -> String`** — 改签名，生成 `{stem}-{hash}.{ext}`；移除旧的时间戳逻辑。
3. **`copy_to_raw`** — 计算 hash，生成带 hash 文件名，目标存在则直接返回（不 copy）。
4. **`ImportResult`** — 新增 `already_exists: bool` 字段。

### `src/lib/tauri.ts`

- `importFile` 返回类型加 `already_exists: boolean`。

### `src/App.tsx`

- `handleFilesSubmit`：`result.already_exists` 为 `true` 时跳过 `triggerAiProcessing`。

---

## Dependencies

`Cargo.toml` 加：

```toml
sha2 = "0.10"
```

---

## Not Changed

- `import_text`（粘贴文本）
- 录音流程
- 所有其他 Tauri 命令

---

## Tests

`materials.rs` 现有测试需更新以适配新签名；补充：
- `file_hash` 对固定内容返回固定 hash
- `copy_to_raw` 重复导入返回 `already_exists: true` 且不产生第二份文件
