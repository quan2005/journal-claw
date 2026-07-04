# Final-state 终局锚点与发布文档收尾 · Agent 编排设计

日期：2026-06-27

## 可验收目标

完成后，仓库中的“终局事实源”应当一致：

1. `docs/final-state.md` 可作为当前终局协作锚点，不再误导 agent 认为 Rust/Tauri/语音/MDX 仍在主线。
2. README、用户指南、应用内文案不再把已下线能力宣传为当前能力。
3. 依赖清单、lockfile 与验证命令恢复可复跑，测试结果有清晰基线。
4. 独立验收 agent 能按 story AC 逐条给出 pass/fail 证据。

## 派发原则

- 每个执行 agent 只负责一个独立文件域，避免互相覆盖。
- 每个执行 agent 必须输出“改了哪些文件、如何自验、未处理什么”。
- 每个执行 agent 都必须配一个对抗式验收 agent。执行 agent 像 Generator，产出候选结果；验收 agent 像 Discriminator，只负责找证据、找漏洞、证明它不满足 AC。
- 验收 agent 不接受实现者自述作为证据，只读 story、design、diff、命令输出和文件内容。
- 执行 agent 不翻 `story.md` 状态，不写 `verify-report.md`；验收通过后由主对话统一处理。
- 对抗轮次最多 2 轮：第一轮验收 fail 时，主对话只把 fail 项和证据返给对应执行 agent 修复；第二轮仍 fail 则停止并交用户裁决，不靠主对话替实现者辩护。

## GAN 式对抗编排

本任务采用“开发工程师 vs 测试工程师”的成对编排：

| 产出 Agent（Generator）      | 对抗验收 Agent（Discriminator）     | 对抗目标                                                                                        |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Agent A · 终局锚点文档       | Agent A-test · final-state 文档审计 | A-test 必须尝试证明 `docs/final-state.md` 仍存在过期 Phase、Rust/Tauri、pi 缺失或五对象状态冲突 |
| Agent B · 用户文档与应用文案 | Agent B-test · 用户可见叙述审计     | B-test 必须尝试证明 README/guide/locale/About/Permissions 仍在宣传已下线能力                    |
| Agent C · 依赖与验证入口     | Agent C-test · 验证可复跑审计       | C-test 必须尝试证明 lockfile/manifest drift、pnpm approval、缺失测试依赖或新增测试失败仍存在    |
| 主对话整合                   | Agent D · 最终独立验收              | D 不站在任何执行 agent 一边，只按 story AC 与本 design 给总判定                                 |

### 对抗协议

每个 `*-test` agent 的提示词必须包含：

1. 你不是协助实现者润色报告，而是测试工程师；你的目标是找到 fail。
2. 只接受文件内容、`git diff`、`rg`、测试命令输出作为证据。
3. 不得引用执行 agent 的自评作为 pass 依据。
4. 每个 fail 必须包含：失败 AC、证据位置或命令、最小修复建议。
5. 找不到 fail 时，必须说明尝试了哪些反证搜索，并给出 pass 证据。

主对话只做三件事：

- 将 Generator 的 diff 交给对应 Discriminator。
- 将 Discriminator 的 fail 项原样返回给对应 Generator 修复。
- 在局部对抗都通过后，派 Agent D 做全局独立验收。

主对话不直接把某个 agent 的自述当作验收结论。

## Agent A — 终局锚点文档

### 范围

- 主要文件：`docs/final-state.md`
- 可按需少量触碰：`docs/adr/rust-removal-roadmap.md`、`docs/adr/rust-removal-release-note.md`
- 不触碰：README、`docs/guide/*`、应用源码、package/lockfile

### 任务

把 `docs/final-state.md` 从 2026-06-25 规划态更新为 2026-06-27 M8-b 终局态。

必须覆盖：

- 产品北极星仍保留。
- 技术最终态明确为 Electron + React + TypeScript daemon + pi 内建引擎。
- M0-M8 / ME 阶段状态与 stories/ADR 一致。
- Rust/Tauri 删除、Swift sidecar/语音下线、MDX 下线写成已完成事实。
- 五个一等对象写成当前真实状态：哪些已落地，哪些只是只读展示或仍有后续产品债。
- D1-D7 待定项改为已定/已完成，或移到“历史决策记录”。
- 删除或改写 Phase 1 pending 等旧看板。

### 成功标准

- `rg -n "Phase 1 执行|blocked by #2|Rust 侧 .*tool_loop|Electron 或过渡期 Tauri shell|何时从 Tauri shell|Phase 10.*🔲|D6.*Rust 退出时机" docs/final-state.md` 无有效命中。
- `rg -n "pi|Electron|M8-b|Rust/Tauri.*删除|语音.*下线|MDX.*下线|AgentRunPanel|SourceBinding|MemoryRecord" docs/final-state.md` 能命中当前终局事实。
- 文档内部不再出现同一阶段一处标完成、一处标未开始的冲突。
- 文档仍能回答“journal 最终是什么”和“五个一等对象当前在哪里”。

### 自验命令

```bash
rg -n "Phase 1 执行|blocked by #2|Rust 侧 .*tool_loop|Electron 或过渡期 Tauri shell|何时从 Tauri shell|Phase 10.*🔲|D6.*Rust 退出时机" docs/final-state.md
rg -n "pi|Electron|M8-b|Rust/Tauri|语音|MDX|SourceBinding|MemoryRecord" docs/final-state.md
```

## Agent A-test — final-state 文档审计

### 范围

- 只读。
- 读取：`story.md`、`design.md`、Agent A 修改后的 `docs/final-state.md`、相关 ADR/story/ARCH。

### 对抗任务

尽力证明 Agent A 没有真正把 `docs/final-state.md` 更新到 M8-b 终局态。

### 成功标准

- 对 AC-1 给出 pass/fail。
- 必须执行或等价执行以下反证搜索：

```bash
rg -n "Phase 1 执行|blocked by #2|Rust 侧 .*tool_loop|Electron 或过渡期 Tauri shell|何时从 Tauri shell|Phase 10.*🔲|D6.*Rust 退出时机" docs/final-state.md
rg -n "pi|Electron|M8-b|Rust/Tauri|语音|MDX|SourceBinding|MemoryRecord" docs/final-state.md
```

- 必须交叉检查 `docs/ARCH.md`、`docs/adr/rust-removal-acceptance.md`、M8-b story，确认没有事实冲突。
- 若 pass，说明哪些旧失败点已被消除；若 fail，列出最小修复建议。

## Agent B — 用户文档与应用文案

### 范围

- README：`README.md`、`README.cn.md`
- 用户指南：`docs/guide/index.md`、`docs/guide/installation.md`、`docs/guide/quick-start.md`、`docs/guide/materials.md`、`docs/guide/settings.md`、`docs/guide/recording.md`、`docs/guide/speaker-profiles.md`
- 应用文案：`apps/web/src/locales/en.ts`、`apps/web/src/locales/zh.ts`
- 可按需触碰：`apps/web/src/settings/components/SectionAbout.tsx`、`apps/web/src/settings/components/SectionPermissions.tsx`
- 不触碰：`docs/final-state.md`、package/lockfile、daemon/desktop 代码

### 任务

清理当前用户可见材料中对已下线能力的误导性描述。

必须覆盖：

- README 当前功能列表移除或改写 Voice recording、Speaker profiles、Voice engines。
- 中文 README 同步。
- `docs/guide/index.md` 技术概要从 Tauri/Rust 改为 Electron/TS daemon/pi。
- recording/speaker-profiles/转写相关 guide 直接删除；当前导航和相关链接必须同步清理，避免死链。
- quick-start 不再把语音录音列为常用入口。
- settings 不再介绍语音引擎可配置项。
- About/Permissions 不再暗示 WhisperKit/SpeechAnalyzer 可用。

### 成功标准

- 对当前用户文档和应用文案运行搜索时，不再把已下线能力作为当前可用功能宣传。
- 允许 ADR/release note 等历史/迁移说明保留，但当前 `docs/guide` 不保留语音/转写下线说明页；相关 guide 文件应删除，链接应清理。
- 中英文 README 对当前能力和技术栈描述一致。
- 应用内 About 不再显示 WhisperKit credit；Permissions 不再要求语音识别权限作为当前主功能前提。

### 自验命令

```bash
rg -n "Voice recording|Speaker profiles|Voice engines|SpeechAnalyzer|WhisperKit|语音录音|语音引擎|声纹|转写" README.md README.cn.md docs/guide apps/web/src/locales apps/web/src/settings
rg -n "Tauri v2|Rust（50|Rust IPC|Electron|TypeScript daemon|pi" docs/guide README.md README.cn.md
```

命中项必须逐条判断：当前能力宣传为 fail；明确下线/历史说明可 pass。

## Agent B-test — 用户可见叙述审计

### 范围

- 只读。
- 读取：README、`docs/guide/*`、locale、settings About/Permissions diff。

### 对抗任务

尽力证明 Agent B 仍然让用户以为录音、语音转写、WhisperKit、SpeechAnalyzer、speaker profiles、Tauri/Rust IPC 是当前能力，或仍保留语音/转写 guide 死链。

### 成功标准

- 对 AC-2、AC-3 给出 pass/fail。
- 必须执行或等价执行以下反证搜索：

```bash
rg -n "Voice recording|Speaker profiles|Voice engines|SpeechAnalyzer|WhisperKit|语音录音|语音引擎|声纹|转写" README.md README.cn.md docs/guide apps/web/src/locales apps/web/src/settings
rg -n "Tauri v2|Rust（50|Rust IPC|Electron|TypeScript daemon|pi" docs/guide README.md README.cn.md
```

- 每个命中必须分类为：`当前能力宣传` / `历史迁移说明` / `无关词` / `死链或残留 guide`。
- `当前能力宣传` 或 `死链或残留 guide` 任一有效命中即 fail。

## Agent C — 依赖与验证入口

### 范围

- `apps/desktop/package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml` / `.npmrc` / package-manager 配置，仅当必须修复 pnpm build approval 或 frozen install 时触碰
- 可按需触碰测试配置，不碰业务源码
- 不触碰：`docs/final-state.md`、README、guide、locale 文案

### 任务

恢复依赖与验证入口可复跑性，尤其解决 `apps/desktop/package.json` 与 `pnpm-lock.yaml` 的 Electron 依赖分类漂移，以及当前环境中 pnpm build approval / half-installed node_modules 造成的复跑阻断。

必须覆盖：

- 明确 Electron 应在 dependencies 还是 devDependencies，并让 manifest 与 lockfile 一致。
- 确保 `pnpm install --frozen-lockfile` 不因 lockfile drift 失败。
- 确保最小验证矩阵能启动，而不是被缺失 vitest module、pnpm approval 或半残 node_modules 阻断。
- 记录 web vitest 已知 9 个失败基线；如已修复则更新为真实结果。

### 成功标准

- `pnpm install --frozen-lockfile` 成功，或在本仓库约定的等价 CI 安装命令成功。
- `pnpm --filter @journal/contracts test` 成功。
- `pnpm --filter @journal/daemon typecheck` 和 `pnpm --filter @journal/daemon test` 成功。
- `pnpm --filter @journal/desktop typecheck` 和 `pnpm --filter @journal/desktop test` 成功。
- `pnpm --filter @journal/web typecheck` 成功。
- `pnpm --filter @journal/web test` 成功，或仅保留已确认的 9 个既有失败并列出文件集合；不得新增失败。
- 不引入 `@tauri-apps/*`、Rust toolchain、Swift/WhisperKit 依赖。

### 自验命令

```bash
pnpm install --frozen-lockfile
pnpm --filter @journal/contracts test
pnpm --filter @journal/daemon typecheck
pnpm --filter @journal/daemon test
pnpm --filter @journal/desktop typecheck
pnpm --filter @journal/desktop test
pnpm --filter @journal/web typecheck
pnpm --filter @journal/web test
rg -n "@tauri-apps|src-tauri|WhisperKit|SpeechAnalyzer|journal-speech" package.json pnpm-lock.yaml apps/*/package.json
```

## Agent C-test — 验证可复跑审计

### 范围

- 只读。
- 读取：package manifests、`pnpm-lock.yaml`、workspace/package-manager 配置、测试输出。

### 对抗任务

尽力证明 Agent C 没有真正恢复验证可复跑性，或引入了新的依赖/测试风险。

### 成功标准

- 对 AC-4 给出 pass/fail。
- 必须复跑或核对 Agent C 提供的原始输出：

```bash
pnpm install --frozen-lockfile
pnpm --filter @journal/contracts test
pnpm --filter @journal/daemon typecheck
pnpm --filter @journal/daemon test
pnpm --filter @journal/desktop typecheck
pnpm --filter @journal/desktop test
pnpm --filter @journal/web typecheck
pnpm --filter @journal/web test
rg -n "@tauri-apps|src-tauri|WhisperKit|SpeechAnalyzer|journal-speech" package.json pnpm-lock.yaml apps/*/package.json
```

- 如果无法复跑命令，必须把阻断原因列为 fail 或待用户裁决，不能用“实现者说跑过了”代替证据。
- 若 web 测试非全绿，必须核对失败文件集合是否等于已确认基线，且无新增失败。

## Agent D — 最终独立验收

### 范围

- 只读，不修改任何代码或文档。
- 读取：`story.md`、`design.md`、Agent A/B/C 的 diff、相关文档和源码。
- 输出：`stories/20260627-final-state-cleanup/verify-report.md`

### 任务

作为独立验收 agent，按 story AC-1 到 AC-5 和本 design 的 agent 成功标准验收整体结果。

### 成功标准

- 每条 AC 有 pass/fail 结论与证据。
- 每个执行 agent 与对抗验收 agent 的成果均有独立判定：Agent A/A-test、B/B-test、C/C-test 均需列出 pass/fail。
- 越界检查覆盖：未新增业务能力，未恢复已下线语音/MDX/Rust/Tauri 路径，未覆盖无关脏工作树。
- 测试/命令结果有原始摘要；未能运行的命令必须说明阻断原因并按 fail 或待用户裁决处理。
- 若全部通过，报告 frontmatter `result: pass`；否则 `result: fail` 并按风险排序列修复建议。

### 验收命令建议

```bash
git diff --stat
git diff --name-status
rg -n "Phase 1 执行|Rust 侧 .*tool_loop|Electron 或过渡期 Tauri shell|何时从 Tauri shell|Phase 10.*🔲" docs/final-state.md
rg -n "Voice recording|Speaker profiles|Voice engines|SpeechAnalyzer|WhisperKit|语音录音|语音引擎|声纹|转写" README.md README.cn.md docs/guide apps/web/src/locales apps/web/src/settings
rg -n "@tauri-apps|src-tauri|tauri::|#\\[tauri::command\\]|invoke_handler" package.json pnpm-lock.yaml apps/web/src apps/daemon/src apps/desktop/src .github
pnpm install --frozen-lockfile
pnpm --filter @journal/contracts test
pnpm --filter @journal/daemon typecheck
pnpm --filter @journal/daemon test
pnpm --filter @journal/desktop typecheck
pnpm --filter @journal/desktop test
pnpm --filter @journal/web typecheck
pnpm --filter @journal/web test
```

## 主对话整合标准

主对话只在以下条件全部满足后收尾：

- Agent D 报告 `result: pass`。
- `story.md` 可翻为 `verified`。
- 若文档影响架构/约定/用户可见说明，按项目约定再触发 docs-maintenance 判断是否需要补同步。
- 最终回复列出修改文件、验收结果、未处理的后续债。
