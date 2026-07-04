# 验收标准 · Verification Standard

> 项目级质量基准。所有 G 任务（G4-G16）的验收必须遵循本标准。
> 编排者（Claude）维护，用户可随时修订。
> 版本：1.0 · 2026-06-25

---

## 0. 核心原则

**验收 ≠ 测试通过。** 验收 = 证明交付物满足需求契约 + 技术正确。

两层不可混淆：

- **需求符合度**：做的东西是不是 story 要求的（AC 逐条）
- **技术正确性**：做的东西技术上对不对（build/test/typecheck/lint/diff 卫生）

测试全绿 ≠ 验收通过。测试全绿只是技术正确性的一个维度。

---

## 1. 角色与隔离

| 角色       | 谁担任                                                 | 职责                                | 约束                                 |
| ---------- | ------------------------------------------------------ | ----------------------------------- | ------------------------------------ |
| **实现方** | Claude subagent（Frontend Developer / 其他专业 agent） | 写代码、自测、自证                  | 不得自判 verified                    |
| **验收方** | Codex CLI（独立 subagent）                             | 独立检查、逐条打勾、出报告          | 不得改源码；产出只能是 verify-report |
| **编排者** | Claude 主会话                                          | 派发、补证据、综合判定、翻 verified | 补证据必须可复现、标注来源           |

**硬隔离**：实现方和验收方不得是同一个 agent 实例。验收方不得采信实现方自述——必须自己跑命令拿证据。

---

## 2. 沙盒权限策略（关键决策）

### 决定：验收方使用 `workspace-write`，不用 `read-only`

**理由**：

- 验收需要跑 `build` + `test`，这些必须写临时文件（`dist/`、`node_modules/.vite-temp/`）
- `read-only` 导致验收方跑不了 build/test，连续两次假 FAIL（Phase 1、Phase 2）
- `workspace-write` 让 Codex 能完整验收，一次性出结论

### 隔离性保障（防止验收方越界改源码）

验收方 `workspace-write` 后，编排者**必须**执行越界核查：

```bash
# 验收前记录基线
git rev-parse HEAD > /tmp/verify-baseline

# 验收方跑完后，检查有无源码改动
git diff --name-only                 # 应该只有 verify-report + 构建产物
git diff --name-only | grep -vE "verify-report|dist/|\.vite-temp|node_modules" || echo "✅ 无源码越界"
```

**规则**：

- 验收方只能写 `verify-report*.md` + `.gitignore` 内的构建产物
- 任何**源码改动**（src/、apps/\*/src/）= 验收方越界 → 判违规，撤销验收，重派
- 构建产物（dist/、.vite-temp/）在 `.gitignore` 内，不构成越界

### 验收前置条件

实现方必须**先 commit**，验收方在干净 HEAD 上验收。这样：

- 验收方跑 build/test 产生的临时文件不会和实现方改动混淆
- `git diff` 基线清晰

---

## 3. 验收流程（5 步 SOP）

### Step 1 · 派发验收

编排者在实现方 commit 后，派 Codex 验收：

```bash
codex exec -C <repo> -s workspace-write \
  -o /tmp/codex-verify-final.txt \
  --ignore-rules --ignore-user-config \
  "<验收 prompt，含 story AC + 本标准引用>"
```

### Step 2 · 验收方独立检查

Codex 逐条执行 AC 检查命令，每条给 PASS/FAIL + 真实输出证据。

### Step 3 · 越界核查

编排者执行 §2 的 `git diff` 越界检查。有源码改动 → 违规重派。

### Step 4 · 综合判定

- 全 PASS → APPROVED → 翻 verified
- 有 FAIL → 编排者判定：
  - 沙盒限制导致的 FAIL → 编排者在可写环境补证据（标注"降级证据"），补过后改判
  - 真实缺陷的 FAIL → NEEDS_REWORK → 回实现方返工

### Step 5 · 报告归档

verify-report.md 落盘到 story 目录，含：Codex 原始结论 + 越界核查结果 + 补证据（如有）+ 综合判定。

---

## 4. AC 可验收性要求（起 story 时的硬约束）

每个 G 任务的 story AC 必须**可被 Codex 在 workspace-write 下验证**。不可验收的 AC 要改写。

可验收的判据类型（Codex 能自己跑）：

- ✅ `bun run --filter <pkg> typecheck/build/test`
- ✅ `grep` / `git diff` / `git ls-files` 静态断言
- ✅ `curl` 端点（daemon）
- ✅ 读源码确认结构/逻辑

不可验收的（需编排者补或降级）：

- ⚠️ 需要 GUI 渲染验证（Tauri 真实窗口）→ 降级为 jsdom 单测 + 编排者人工补
- ⚠️ 需要外部 CLI（claude/codex/opencode 真实 run）→ 降级为 mock fixture
- ⚠️ 需要 macOS 专属 API（Speech 等）→ 降级或标注"非跨平台，单独 gate"

**起 story 时，AC 必须附"检查命令"**——不允许只写"对话路径可用"，必须写 `bun run test -- ChatPanel.test.tsx 全绿`。

---

## 5. 验收判据类型（5 类，每类有硬规则）

### A. 结构与边界

- 改动文件范围用 `git diff --name-only` 核查，必须在 story 允许清单内
- 越界文件（story 没授权的）= FAIL

### B. 类型与构建

- `typecheck` exit 0
- `build` exit 0（daemon/contracts 等可独立构建的包）
- 零类型错误

### C. 测试

- 新增测试全绿
- 回归测试不回退（对比基线，失败集不得扩大）
- 覆盖率不强制，但 AC 判据必须有对应测试

### D. 行为契约

- API 端点返回正确结构（curl 验证）
- 事件流顺序正确（SSE/JSONL）
- 错误路径返回结构化错误

### E. Diff 卫生

- 无顺手重构（既有逻辑零改动）
- 无大范围格式化（prettier 全文重排）
- runtimeClient/httpRuntimeClient 等大文件改动克制（除非 story 明确要求改签名）

---

## 6. verify-report.md 格式（验收方产出模板）

```markdown
# <Phase 名> 验收报告

**Story**: <path>
**验收方**: Codex CLI (workspace-write, gpt-5.5)
**验收日期**: <date>

## 结论：<APPROVED | NEEDS_REWORK>

## AC 逐条

| AC   | 判定      | 命令   | 输出摘要   |
| ---- | --------- | ------ | ---------- |
| AC-1 | PASS/FAIL | <命令> | <真实输出> |

## 沙盒限制说明（如有）

<哪些检查跑不了，降级了什么>

## 原始证据

<每条 AC 的完整命令输出>
```

---

## 7. 争议与降级机制

### 验收方判 FAIL 但实现方认为不公时

编排者按优先级裁定：

1. **沙盒限制**：FAIL 因 EPERM/只读 → 编排者补证据，可改判
2. **口径问题**：FAIL 因验收方误解范围（如既有 dirty 被算进）→ 编排者修正口径重派
3. **真实缺陷**：FAIL 源码确实有问题 → 返工，不改判

### 降级证据的标注规则

编排者补充的证据必须在 verify-report 里标注：

- `[编排者补证·可写环境]` 前缀
- 附完整命令 + 输出
- 说明为什么 Codex 跑不了

---

## 8. 分类型验收模板

### 基础设施类（G1/G2 类：monorepo/daemon 骨架）

- AC：结构存在 + 能 build + 能启动 + 配置同步
- 核心判据：`bun install` + `build` + 端点 curl + CI 路径

### 契约类型（G3/G6 类：contracts/types）

- AC：类型导出 + 可被 import + 类型守卫测试
- 核心判据：`typecheck` + 两端 `workspace:*` 依赖 + 类型测试

### 服务类（G4/G8 类：AgentRunService/ChangeSet）

- AC：API 行为 + 事件流 + 持久化 + 错误路径
- 核心判据：`curl` 端点 + SSE 事件序列 + JSONL 回放 + 结构化错误

### UI 类（G7/G12 类：Workbench）

- AC：渲染不回退 + 结构化数据接入 + 视觉 token 复用
- 核心判据：组件测试 + jsdom 行为 + grep 断言（不重做视觉）

### 权限类（G9/G13 类：AuthorizationMode）

- AC：三档语义 + 拒绝结构化 + flag 映射
- 核心判据：边界判定测试 + 结构化错误 + 不泄露 CLI flag 到 UI

---

## 9. 适用范围

本标准适用于 G4-G16 所有后续任务。已有 Phase 0/1/2 的验收（read-only + 编排者补证）作为历史记录保留，不回溯改判。

后续 story 必须在 design.md 里引用本标准，并在 AC 里附检查命令。
