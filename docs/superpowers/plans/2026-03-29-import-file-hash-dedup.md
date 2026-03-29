# import_file Hash Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拖入文件时，在文件名末尾嵌入内容 hash（SHA-256 前 8 位十六进制），重复拖入同一文件时静默跳过，不产生副本也不触发 AI 处理。

**Architecture:** 在 Rust 侧 `materials.rs` 计算文件内容 SHA-256，生成带 hash 后缀的目标文件名；若目标已存在则直接返回 `already_exists: true`；前端收到该标志时跳过 `triggerAiProcessing`。

**Tech Stack:** Rust (`sha2 = "0.10"` crate), Tauri v2, TypeScript/React

---

## File Map

| 文件 | 变更类型 | 职责 |
|------|---------|------|
| `src-tauri/Cargo.toml` | Modify | 添加 `sha2` 依赖 |
| `src-tauri/src/materials.rs` | Modify | `file_hash`、新 `dest_filename`、`copy_to_raw`、`ImportResult` |
| `src/lib/tauri.ts` | Modify | `importFile` 返回类型加 `already_exists` |
| `src/App.tsx` | Modify | `handleFilesSubmit` 跳过重复文件的 AI 处理 |

---

### Task 1: 添加 sha2 依赖并更新 ImportResult

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/materials.rs`

- [ ] **Step 1: 在 Cargo.toml 添加 sha2**

  打开 `src-tauri/Cargo.toml`，在 `[dependencies]` 末尾加一行：

  ```toml
  sha2 = "0.10"
  ```

- [ ] **Step 2: 在 materials.rs 顶部添加 use**

  在 `materials.rs` 顶部（`use std::path::PathBuf;` 之后）加：

  ```rust
  use sha2::{Sha256, Digest};
  ```

- [ ] **Step 3: 为 ImportResult 添加 already_exists 字段**

  将现有：

  ```rust
  #[derive(Debug, Serialize, Deserialize)]
  pub struct ImportResult {
      pub path: String,
      pub filename: String,
      pub year_month: String,
  }
  ```

  改为：

  ```rust
  #[derive(Debug, Serialize, Deserialize)]
  pub struct ImportResult {
      pub path: String,
      pub filename: String,
      pub year_month: String,
      pub already_exists: bool,
  }
  ```

- [ ] **Step 4: 确认编译通过**

  ```bash
  cd src-tauri && cargo check 2>&1 | tail -5
  ```

  预期：`Finished` 或只有无关警告，无 error。

- [ ] **Step 5: Commit**

  ```bash
  git add src-tauri/Cargo.toml src-tauri/src/materials.rs
  git commit -m "feat: 添加 sha2 依赖，ImportResult 加 already_exists 字段"
  ```

---

### Task 2: 实现 file_hash 并更新 dest_filename（TDD）

**Files:**
- Modify: `src-tauri/src/materials.rs`（`file_hash` 函数 + `dest_filename` 改签名）

- [ ] **Step 1: 写失败的测试**

  在 `materials.rs` 底部 `#[cfg(test)]` 块内，**替换现有 `dest_filename_extracts_name` 测试**，加入以下测试：

  ```rust
  #[test]
  fn file_hash_returns_8_hex_chars() {
      let tmp = std::env::temp_dir().join("hash_test_input.txt");
      std::fs::write(&tmp, b"hello world").unwrap();
      let h = file_hash(tmp.to_str().unwrap()).unwrap();
      assert_eq!(h.len(), 8, "hash 应为 8 位十六进制");
      assert!(h.chars().all(|c| c.is_ascii_hexdigit()), "应全为十六进制字符");
      // SHA-256("hello world") 前 8 hex = "b94d27b9"
      assert_eq!(h, "b94d27b9");
      std::fs::remove_file(&tmp).ok();
  }

  #[test]
  fn dest_filename_embeds_hash() {
      assert_eq!(
          dest_filename("/tmp/meeting notes.docx", "a3f9c812"),
          "meeting notes-a3f9c812.docx"
      );
      assert_eq!(
          dest_filename("/Users/x/note.txt", "00112233"),
          "note-00112233.txt"
      );
  }

  #[test]
  fn dest_filename_no_extension() {
      assert_eq!(
          dest_filename("/tmp/README", "deadbeef"),
          "README-deadbeef"
      );
  }
  ```

- [ ] **Step 2: 运行测试确认失败**

  ```bash
  cd src-tauri && cargo test dest_filename_embeds_hash 2>&1 | tail -10
  ```

  预期：编译错误（函数签名不匹配）或测试失败。

- [ ] **Step 3: 实现 file_hash**

  在 `materials.rs` 中，将现有的 `pub fn dest_filename` **之前**插入新函数：

  ```rust
  pub fn file_hash(path: &str) -> Result<String, String> {
      let bytes = std::fs::read(path)
          .map_err(|e| format!("读取文件失败: {}", e))?;
      let mut hasher = Sha256::new();
      hasher.update(&bytes);
      let result = hasher.finalize();
      Ok(format!("{:x}", result)[..8].to_string())
  }
  ```

- [ ] **Step 4: 更新 dest_filename 签名**

  将现有：

  ```rust
  pub fn dest_filename(src_path: &str) -> String {
      PathBuf::from(src_path)
          .file_name()
          .unwrap_or_default()
          .to_string_lossy()
          .to_string()
  }
  ```

  改为：

  ```rust
  pub fn dest_filename(src_path: &str, hash: &str) -> String {
      let p = PathBuf::from(src_path);
      let stem = p.file_stem().unwrap_or_default().to_string_lossy();
      let ext = p.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
      format!("{}-{}{}", stem, hash, ext)
  }
  ```

- [ ] **Step 5: 运行测试确认通过**

  ```bash
  cd src-tauri && cargo test dest_filename file_hash 2>&1 | tail -15
  ```

  预期：`test file_hash_returns_8_hex_chars ... ok`、`test dest_filename_embeds_hash ... ok`、`test dest_filename_no_extension ... ok`。

- [ ] **Step 6: Commit**

  ```bash
  git add src-tauri/src/materials.rs
  git commit -m "feat: 实现 file_hash 和带 hash 后缀的 dest_filename"
  ```

---

### Task 3: 更新 copy_to_raw 实现防重逻辑（TDD）

**Files:**
- Modify: `src-tauri/src/materials.rs`（`copy_to_raw` + `import_file` + 新测试）

- [ ] **Step 1: 写失败的测试**

  在 `#[cfg(test)]` 块内，**替换现有 `copy_to_raw_creates_file` 测试**，加入：

  ```rust
  #[test]
  fn copy_to_raw_creates_file_with_hash() {
      let tmp = std::env::temp_dir().join("mat_test_hash");
      let src = tmp.join("source.txt");
      std::fs::create_dir_all(&tmp).unwrap();
      std::fs::write(&src, b"hello").unwrap();

      let (dest, exists) = copy_to_raw(src.to_str().unwrap(), tmp.to_str().unwrap(), "2603").unwrap();
      assert!(dest.exists(), "目标文件应存在");
      assert!(!exists, "第一次导入 already_exists 应为 false");
      // 文件名应包含 hash
      let name = dest.file_name().unwrap().to_string_lossy().to_string();
      assert!(name.contains('-'), "文件名应含 hash 后缀");

      std::fs::remove_dir_all(&tmp).ok();
  }

  #[test]
  fn copy_to_raw_deduplicates_same_content() {
      let tmp = std::env::temp_dir().join("mat_test_dedup");
      let src = tmp.join("source.txt");
      std::fs::create_dir_all(&tmp).unwrap();
      std::fs::write(&src, b"hello dedup").unwrap();

      let (dest1, exists1) = copy_to_raw(src.to_str().unwrap(), tmp.to_str().unwrap(), "2603").unwrap();
      let (dest2, exists2) = copy_to_raw(src.to_str().unwrap(), tmp.to_str().unwrap(), "2603").unwrap();

      assert!(!exists1, "第一次应为 false");
      assert!(exists2, "第二次应为 true（内容相同）");
      assert_eq!(dest1, dest2, "两次应返回相同路径");

      // raw/ 目录里只有一个文件（不计 raw/ 本身）
      let raw = tmp.join("2603").join("raw");
      let count = std::fs::read_dir(&raw).unwrap().count();
      assert_eq!(count, 1, "不应产生第二份副本");

      std::fs::remove_dir_all(&tmp).ok();
  }
  ```

- [ ] **Step 2: 运行测试确认失败**

  ```bash
  cd src-tauri && cargo test copy_to_raw 2>&1 | tail -10
  ```

  预期：编译错误（copy_to_raw 返回类型不匹配）。

- [ ] **Step 3: 更新 copy_to_raw**

  将现有 `copy_to_raw` 函数整体替换为：

  ```rust
  pub fn copy_to_raw(src_path: &str, workspace: &str, year_month: &str) -> Result<(PathBuf, bool), String> {
      workspace::ensure_dirs(workspace, year_month)?;
      let raw = workspace::raw_dir(workspace, year_month);
      let hash = file_hash(src_path)?;
      let filename = dest_filename(src_path, &hash);
      let dest = raw.join(&filename);
      if dest.exists() {
          return Ok((dest, true));
      }
      std::fs::copy(src_path, &dest)
          .map_err(|e| format!("复制文件失败: {}", e))?;
      Ok((dest, false))
  }
  ```

- [ ] **Step 4: 更新 import_file 命令以适配新返回值**

  将现有 `import_file` 函数替换为：

  ```rust
  #[tauri::command]
  pub fn import_file(app: AppHandle, src_path: String) -> Result<ImportResult, String> {
      let cfg = config::load_config(&app)?;
      if cfg.workspace_path.is_empty() {
          return Err("请先在设置中配置 Workspace 路径".to_string());
      }
      let ym = ws::current_year_month();
      let (dest, already_exists) = copy_to_raw(&src_path, &cfg.workspace_path, &ym)?;
      Ok(ImportResult {
          filename: dest.file_name().unwrap_or_default().to_string_lossy().to_string(),
          path: dest.to_string_lossy().to_string(),
          year_month: ym,
          already_exists,
      })
  }
  ```

- [ ] **Step 5: 运行所有 materials 测试**

  ```bash
  cd src-tauri && cargo test 2>&1 | tail -15
  ```

  预期：所有测试 `ok`，无 error。

- [ ] **Step 6: Commit**

  ```bash
  git add src-tauri/src/materials.rs
  git commit -m "feat: copy_to_raw 支持 hash 防重，重复文件返回 already_exists"
  ```

---

### Task 4: 更新前端类型和 handleFilesSubmit

**Files:**
- Modify: `src/lib/tauri.ts`（`importFile` 返回类型）
- Modify: `src/App.tsx`（`handleFilesSubmit` 跳过重复）

- [ ] **Step 1: 更新 tauri.ts 返回类型**

  将 `src/lib/tauri.ts` 中的：

  ```typescript
  export const importFile = (srcPath: string) =>
    invoke<{ path: string; filename: string; year_month: string }>('import_file', { srcPath })
  ```

  改为：

  ```typescript
  export const importFile = (srcPath: string) =>
    invoke<{ path: string; filename: string; year_month: string; already_exists: boolean }>('import_file', { srcPath })
  ```

- [ ] **Step 2: 更新 handleFilesSubmit 跳过重复文件**

  将 `src/App.tsx` 中的：

  ```typescript
  const handleFilesSubmit = async (paths: string[]) => {
    setPendingFiles([])
    for (const path of paths) {
      try {
        const result = await importFile(path)
        await triggerAiProcessing(result.path, result.year_month)
      } catch (err) {
        console.error('[file-submit] error:', String(err), 'path:', path)
      }
    }
    refresh()
  }
  ```

  改为：

  ```typescript
  const handleFilesSubmit = async (paths: string[]) => {
    setPendingFiles([])
    for (const path of paths) {
      try {
        const result = await importFile(path)
        if (!result.already_exists) {
          await triggerAiProcessing(result.path, result.year_month)
        }
      } catch (err) {
        console.error('[file-submit] error:', String(err), 'path:', path)
      }
    }
    refresh()
  }
  ```

- [ ] **Step 3: 前端类型检查**

  ```bash
  npm run build 2>&1 | tail -10
  ```

  预期：`built in` 无 TypeScript error。

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/tauri.ts src/App.tsx
  git commit -m "feat: 前端跳过 already_exists 文件的 AI 处理"
  ```

---

### Task 5: 冒烟测试

- [ ] **Step 1: 运行完整 Rust 测试套件**

  ```bash
  cd src-tauri && cargo test 2>&1 | grep -E "^test |FAILED|ok$|error"
  ```

  预期：所有测试 `ok`，无 `FAILED`。

- [ ] **Step 2: 启动 dev 验证流程**

  ```bash
  npm run dev
  ```

  在浏览器 `localhost:1420` 里：
  1. 拖入一个文件 → raw/ 下应生成 `filename-{8hex}.ext`
  2. 再次拖入**同一文件** → 不应产生第二份副本，不触发 AI
  3. 拖入**不同文件** → 正常 copy 并触发 AI

- [ ] **Step 3: 最终 Commit（如有遗漏）**

  ```bash
  git status
  # 确认 working tree clean
  ```
