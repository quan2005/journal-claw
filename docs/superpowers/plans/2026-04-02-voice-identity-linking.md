# 声纹-身份自动关联 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AI 引擎在处理录音转录稿时能一步到位地将声纹 ID 与真实人物身份关联，消除手动合并的断裂。

**Architecture:** speaker_profiles 改用五位自增 ID（替代 UUID），录音时只维护 embedding 不创建 identity 文件。转录稿中使用 speaker_id 标注说话人，AI 通过 `identity-create --speaker-id` 和新增的 `identity-link` 脚本完成声纹-身份绑定。

**Tech Stack:** Rust (Tauri backend), Bash (workspace scripts), Markdown (CLAUDE.md AI instructions)

---

### Task 1: speaker_id 改为五位自增整数

**Files:**
- Modify: `src-tauri/src/speaker_profiles.rs:16-30` (SpeakerProfile struct)
- Modify: `src-tauri/src/speaker_profiles.rs:140-153` (next_auto_number → next_speaker_id)
- Modify: `src-tauri/src/speaker_profiles.rs:200-232` (identify_or_register_all — ID generation)
- Modify: `src-tauri/src/speaker_profiles.rs:357-430` (tests)

- [ ] **Step 1: Write test for next_speaker_id**

In `src-tauri/src/speaker_profiles.rs`, replace the existing `next_auto_number` tests with:

```rust
#[test]
fn next_speaker_id_empty() {
    assert_eq!(next_speaker_id(&[]), "00001".to_string());
}

#[test]
fn next_speaker_id_increments_max() {
    let profiles = vec![
        SpeakerProfile {
            id: "00001".into(), name: String::new(), auto_name: "说话人 1".into(),
            embeddings: vec![], created_at: 0, last_seen_at: 0, recording_count: 1,
        },
        SpeakerProfile {
            id: "00005".into(), name: String::new(), auto_name: "说话人 5".into(),
            embeddings: vec![], created_at: 0, last_seen_at: 0, recording_count: 1,
        },
    ];
    assert_eq!(next_speaker_id(&profiles), "00006".to_string());
}

#[test]
fn next_speaker_id_ignores_non_numeric() {
    // Legacy UUID-style IDs should be ignored when computing next ID
    let profiles = vec![
        SpeakerProfile {
            id: "some-uuid-string".into(), name: String::new(), auto_name: "说话人 1".into(),
            embeddings: vec![], created_at: 0, last_seen_at: 0, recording_count: 1,
        },
    ];
    assert_eq!(next_speaker_id(&profiles), "00001".to_string());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test next_speaker_id -- --nocapture`
Expected: FAIL — `next_speaker_id` function does not exist yet.

- [ ] **Step 3: Implement next_speaker_id and update identify_or_register_all**

In `src-tauri/src/speaker_profiles.rs`:

Replace the `next_auto_number` function with:

```rust
/// Compute the next speaker_id: scan existing profile IDs, find max numeric value, return max+1
/// zero-padded to 5 digits. Non-numeric IDs (legacy UUIDs) are ignored.
fn next_speaker_id(profiles: &[SpeakerProfile]) -> String {
    let max_num = profiles
        .iter()
        .filter_map(|p| p.id.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{:05}", max_num + 1)
}
```

In `identify_or_register_all`, replace the UUID generation line:

```rust
// Old:
let new_id = Uuid::new_v4().to_string();

// New:
let new_id = next_speaker_id(&profiles);
```

Remove the `use uuid::Uuid;` import at the top of the file if it's no longer used elsewhere.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test next_speaker_id -- --nocapture`
Expected: All 3 tests PASS.

- [ ] **Step 5: Verify existing tests still pass**

Run: `cd src-tauri && cargo test speaker_profiles -- --nocapture`
Expected: All tests PASS (cosine tests, add_embedding test, next_auto_number tests replaced).

- [ ] **Step 6: Remove uuid dependency if unused**

Check if `uuid` is used elsewhere:
```bash
cd src-tauri && grep -r "Uuid\|uuid::" src/ --include="*.rs" | grep -v target
```

If only used in speaker_profiles.rs, remove `uuid` from `src-tauri/Cargo.toml` dependencies.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/speaker_profiles.rs src-tauri/Cargo.toml
git commit -m "refactor: replace UUID with 5-digit auto-increment speaker_id"
```

---

### Task 2: 声纹注册不再自动创建 identity 文件

**Files:**
- Modify: `src-tauri/src/speaker_profiles.rs:218-230` (identify_or_register_all — remove create_identity_file call)

- [ ] **Step 1: Remove auto-creation of identity file**

In `src-tauri/src/speaker_profiles.rs`, in the `identify_or_register_all` function, delete the block that auto-creates identity files (lines 219-229):

```rust
// DELETE THIS ENTIRE BLOCK:
// Auto-create identity file for new speaker
if let Ok(cfg) = crate::config::load_config(app) {
    if !cfg.workspace_path.is_empty() {
        let _ = crate::identity::create_identity_file(
            &cfg.workspace_path,
            "未知",
            &auto_name,
            "",
            &[],
            &new_id,
        );
    }
}
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/speaker_profiles.rs
git commit -m "fix: stop auto-creating identity files on speaker registration

Voice profiles now only store embeddings. Identity file creation
is delegated to the AI engine which can associate real names."
```

---

### Task 3: 转录稿中使用 speaker_id 替代显示名

**Files:**
- Modify: `src-tauri/src/speaker_profiles.rs:159-237` (identify_or_register_all — return speaker_id instead of display_name)
- Modify: `src-tauri/src/transcription.rs:427-450` (format_ai_speaker_label — handle numeric IDs)
- Modify: `src-tauri/src/transcription.rs:772-793` (render_audio_ai_markdown — add speaker_id mapping header)
- Modify: `src-tauri/src/transcription.rs:931-944` (transcribe_audio_to_ai_markdown — pass IDs through)

- [ ] **Step 1: Change identify_or_register_all to return speaker_id in mapping**

In `src-tauri/src/speaker_profiles.rs`, the `identify_or_register_all` function currently returns `HashMap<String, String>` mapping `SPEAKER_XX → display_name`. Change it to return `SPEAKER_XX → speaker_id`:

For matched profiles (around line 199):
```rust
// Old:
mapping.insert(label.clone(), profile.display_name().to_string());

// New:
mapping.insert(label.clone(), profile.id.clone());
```

For new profiles (around line 217):
```rust
// Old:
mapping.insert(label.clone(), new_profile.auto_name.clone());

// New:
mapping.insert(label.clone(), new_profile.id.clone());
```

Update the doc comment on the function:
```rust
/// Returns a mapping: SPEAKER_XX label → speaker_id (5-digit string, for use in transcript).
```

- [ ] **Step 2: Update format_ai_speaker_label to pass through numeric speaker_ids**

In `src-tauri/src/transcription.rs`, replace the `format_ai_speaker_label` function:

```rust
fn format_ai_speaker_label(
    speaker_map: &mut std::collections::HashMap<String, char>,
    speaker: &Option<String>,
    next_label: &mut u8,
) -> String {
    match speaker {
        Some(sp) => {
            // 5-digit numeric speaker_ids (e.g. "00003") are passed through as-is.
            // Machine-generated SpeakerKit IDs (SPEAKER_00, SPEAKER_01, …) get canonicalised.
            // Profile names ("张三") are passed through as-is.
            if sp.chars().all(|c| c.is_ascii_digit()) && sp.len() == 5 {
                sp.clone()
            } else if sp.starts_with("SPEAKER_") {
                let label = speaker_map.entry(sp.clone()).or_insert_with(|| {
                    let current = *next_label as char;
                    *next_label += 1;
                    current
                });
                format!("发言人 {}", label)
            } else {
                sp.clone()
            }
        }
        None => "发言内容".to_string(),
    }
}
```

- [ ] **Step 3: Verify Rust compiles and tests pass**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS. Some existing transcription tests may need updating if they assert on speaker label format — check output and fix as needed.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/speaker_profiles.rs src-tauri/src/transcription.rs
git commit -m "feat: use speaker_id in transcripts instead of display names

Transcripts now show 5-digit speaker_ids (e.g. '00003: 大家好')
so the AI engine can link speakers to identity files."
```

---

### Task 4: 新增 identity-link 脚本

**Files:**
- Create: `src-tauri/resources/workspace-template/.claude/scripts/identity-link`

This script allows the AI to link a new speaker_id to an existing identity file, merging the voice profile embeddings.

- [ ] **Step 1: Create the identity-link script**

Create `src-tauri/resources/workspace-template/.claude/scripts/identity-link`:

```bash
#!/usr/bin/env bash
# Link a speaker_id to an existing identity file.
# If the identity already has a different speaker_id, the two voice profiles
# will be merged (new embeddings absorbed into existing profile).
set -euo pipefail

usage() {
  echo "Usage: .claude/scripts/identity-link <speaker_id> <identity_path>" >&2
  echo "  speaker_id:    5-digit ID from transcript (e.g. 00003)" >&2
  echo "  identity_path: path to identity .md file (e.g. identity/广州-张三.md)" >&2
  exit 1
}

[[ $# -lt 2 ]] && usage

speaker_id="$1"
identity_file="$2"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
workspace="$(cd "${script_dir}/../.." && pwd)"

# Resolve relative path
if [[ ! "$identity_file" = /* ]]; then
  identity_file="${workspace}/${identity_file}"
fi

if [[ ! -f "$identity_file" ]]; then
  echo "Identity file not found: ${identity_file}" >&2
  exit 1
fi

# Read current speaker_id from frontmatter
current_id=$(awk '
  /^---$/ { count++; next }
  count == 1 && /^speaker_id:/ {
    sub(/^speaker_id:[[:space:]]*/, "")
    gsub(/^["'"'"']|["'"'"']$/, "")
    print
    exit
  }
' "$identity_file")

if [[ "$current_id" == "$speaker_id" ]]; then
  echo "Already linked: ${identity_file}" >&2
  echo "${identity_file}"
  exit 0
fi

profiles_file="${workspace}/identity/raw/speaker_profiles.json"

if [[ -n "$current_id" && "$current_id" != "$speaker_id" && -f "$profiles_file" ]]; then
  # Merge: absorb new speaker_id's embeddings into existing profile
  # Use python3 (available on macOS) for JSON manipulation
  python3 -c "
import json, sys

with open('${profiles_file}', 'r') as f:
    profiles = json.load(f)

source = next((p for p in profiles if p['id'] == '${speaker_id}'), None)
target = next((p for p in profiles if p['id'] == '${current_id}'), None)

if source and target:
    # Merge embeddings (rolling window of 5)
    for emb in source.get('embeddings', []):
        target['embeddings'].append(emb)
    target['embeddings'] = target['embeddings'][-5:]
    target['recording_count'] = target.get('recording_count', 0) + source.get('recording_count', 0)
    target['last_seen_at'] = max(target.get('last_seen_at', 0), source.get('last_seen_at', 0))
    # Remove source profile
    profiles = [p for p in profiles if p['id'] != '${speaker_id}']

    with open('${profiles_file}', 'w') as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)
    print('Merged voice profile ${speaker_id} into ${current_id}', file=sys.stderr)
elif source and not target:
    # No existing profile for current_id — just rename source's id
    source['id'] = '${current_id}'
    with open('${profiles_file}', 'w') as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)
    print('Reassigned voice profile ${speaker_id} -> ${current_id}', file=sys.stderr)
else:
    print('Source profile ${speaker_id} not found, skipping merge', file=sys.stderr)
"
  echo "${identity_file}"
  exit 0
fi

# No existing speaker_id — just write the new one into frontmatter
if [[ -z "$current_id" ]]; then
  # Replace empty speaker_id in frontmatter
  if grep -q '^speaker_id:' "$identity_file"; then
    sed -i '' "s/^speaker_id:.*/speaker_id: \"${speaker_id}\"/" "$identity_file"
  else
    # Insert speaker_id after tags line
    sed -i '' "/^tags:/a\\
speaker_id: \"${speaker_id}\"
" "$identity_file"
  fi
  echo "${identity_file}"
  exit 0
fi

echo "${identity_file}"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x src-tauri/resources/workspace-template/.claude/scripts/identity-link
```

- [ ] **Step 3: Test the script manually**

Create a temporary test identity file and verify the script works:
```bash
mkdir -p /tmp/test-identity/identity/raw
echo '---
summary: "测试"
tags: []
speaker_id: ""
---

# 测试' > /tmp/test-identity/identity/测试-张三.md

# Test linking to empty speaker_id
cd /tmp/test-identity && bash -x src-tauri/resources/workspace-template/.claude/scripts/identity-link 00003 identity/测试-张三.md
grep speaker_id /tmp/test-identity/identity/测试-张三.md
# Expected: speaker_id: "00003"
```

Clean up: `rm -rf /tmp/test-identity`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/scripts/identity-link
git commit -m "feat: add identity-link script for AI to associate speaker_id with existing identity"
```

---

### Task 5: 更新 identity-create 脚本确保 speaker_id 传递

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/scripts/identity-create`

The script already supports `--speaker-id`. Just verify it works correctly — no code changes needed unless testing reveals issues.

- [ ] **Step 1: Verify identity-create already handles --speaker-id**

Read the script and confirm `--speaker-id` is parsed and written to frontmatter. Current code already does this correctly.

- [ ] **Step 2: Test the script**

```bash
mkdir -p /tmp/test-ws/identity
cd /tmp/test-ws
bash src-tauri/resources/workspace-template/.claude/scripts/identity-create "广州" "李四" --speaker-id 00007 --summary "测试人物"
cat /tmp/test-ws/identity/广州-李四.md
# Expected: speaker_id: "00007" in frontmatter
```

Clean up: `rm -rf /tmp/test-ws`

- [ ] **Step 3: Test idempotency**

```bash
mkdir -p /tmp/test-ws/identity
cd /tmp/test-ws
bash src-tauri/resources/workspace-template/.claude/scripts/identity-create "广州" "李四" --speaker-id 00007
bash src-tauri/resources/workspace-template/.claude/scripts/identity-create "广州" "李四" --speaker-id 00007
# Expected: second call prints path to stderr "Identity already exists" and exits 0
```

Clean up: `rm -rf /tmp/test-ws`

- [ ] **Step 4: Commit (only if changes were needed)**

If no changes needed, skip this step.

---

### Task 6: 更新 CLAUDE.md AI 指令

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`

- [ ] **Step 1: Update the 身份系统 section**

Replace the `### 处理素材时的身份行为` section and `### 注意事项` section with updated instructions:

```markdown
### 处理素材时的身份行为

1. **识别人物**：阅读素材时，留意出现的人名、职位、组织
2. **识别声纹 ID**：如果素材是录音转写，说话人会以五位数字 ID 标注（如 `00003: 大家好`）。这些 ID 是声纹识别系统分配的，代表不同的说话人
3. **比对已有档案**：检查 `identity/` 目录，看此人是否已有档案
4. **新人物 → 建档并关联声纹**：如果是首次出现的人物，使用脚本创建档案：
   ```bash
   .claude/scripts/identity-create "地域" "姓名" --speaker-id 00003 --summary "简要描述此人的角色和与用户的关系"
   ```
   - `地域`：此人所属的组织/公司/城市（如 `趣丸`、`广州`），不确定时用 `未知`
   - `姓名`：真实姓名
   - `--speaker-id`：从转写稿中对应的五位数字 ID（如果素材不是录音，省略此参数）
5. **已有人物 + 新声纹 → 关联**：如果素材中的说话人是已有人物，但使用了新的 speaker_id，用脚本关联：
   ```bash
   .claude/scripts/identity-link 00003 identity/广州-张三.md
   ```
   这会将新声纹合并到已有档案，让系统下次更准确地识别此人
6. **已有人物 → 补充信息**：如果素材中出现了已有人物的新信息（新职位、新职责），直接编辑其档案文件补充
7. **无法识别的说话人 → 不处理**：如果某个 speaker_id 对应的人只说了"嗯""好的"等无法判断身份的内容，不要为其创建档案。声纹系统会保留其声纹数据，等下次有更多信息时再关联
8. **日志中引用**：在日志正文中提到人物时，自然地写出姓名即可，不需要特殊标记

### 注意事项

- 只为**有实际交互意义的人物**建档——会议参与者、协作方、汇报对象等。不要为素材中一笔带过的无关人名建档
- `speaker_id` 字段由系统声纹识别自动分配，你通过 `identity-create --speaker-id` 和 `identity-link` 来关联，不要直接手动编辑 frontmatter 中的 speaker_id
- 阅读 `identity/README.md` 了解用户本人的背景，帮助你理解素材中的上下文和人际关系。如果素材中透露了用户本人的新信息（如新职位、新职责），也应更新 README.md
```

- [ ] **Step 2: Verify the file is well-formed**

Read the full file and check for formatting issues.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/CLAUDE.md
git commit -m "docs: update AI instructions for voice-identity linking workflow

AI now receives speaker_ids in transcripts and uses identity-create
and identity-link scripts to associate voices with real identities."
```

---

### Task 7: 端到端验证

**Files:** None (verification only)

- [ ] **Step 1: Verify Rust compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 2: Run all Rust tests**

```bash
cd src-tauri && cargo test
```

Fix any failures. Common issues:
- Tests in `transcription.rs` that assert on speaker label format may need updating since labels are now 5-digit IDs instead of display names.
- Tests referencing `Uuid` imports may fail if the dependency was removed.

- [ ] **Step 3: Run frontend build check**

```bash
npm run build
```

No frontend changes were made, but verify nothing is broken.

- [ ] **Step 4: Commit any test fixes**

```bash
git add -A
git commit -m "test: fix tests for new speaker_id format"
```
