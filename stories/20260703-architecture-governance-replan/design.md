# Design：架构治理重规划

Story：`./story.md`（approved 2026-07-03）
分工：Claude 规划/WS-1 文档；opencode 执行代码任务；kimi 独立验收；Claude 终审合并。

## 工作流拆解（依赖顺序）

### WS-0 基线净化（kimi，进行中）

审阅 46 个未提交改动 → 本地数据目录（`apps/desktop/.journal*`、`.playwright-cli/` 等）入 .gitignore → `pnpm -r test` + `pnpm build` 全绿 → 按 Conventional Commits 分主题提交，不 push。

### WS-1 文档体系重组（Claude 亲自，规范制定不外包）

结构（用户已拍板：CLAUDE.md 薄 hub + docs 分层）：

- `CLAUDE.md` → ~80 行：命令速查 + 铁律摘要（一行一条+链接）+ 导航。
- `docs/CONVENTIONS.md`（新增）：工程规范——测试策略、目录约定、commit/PR/CI、门禁流程、版本管理。
- `docs/ARCH.md` → 唯一架构真相：分层图、依赖方向（web→contracts←daemon；desktop 零业务语义）、每条边界规则配违反示例。
- `docs/DESIGN.md` 保持唯一设计规范；`docs/final-state.md` 保持产品北极星；ADR 只增不改。
- 清理 `docs/guide/` 等处引用已删能力的残余。
- 铁律：每条约定单一权威出处，其余只链接（AC-1）；文档引用实体与代码一致（AC-2）。

### WS-2 tauri.ts 彻底内联拆解 + 死代码清理（opencode，并行分批）

删除 `apps/web/src/lib/tauri.ts`（735 行、44 个引用文件），调用方直接消费 `runtimeClient`/`hostBridge`。

- 按域切成互不重叠的文件集，3 个批次**并行**分发（同一工作区，文件集不相交）：
  - B1 journal/todos/timeline 域
  - B2 topics/identity/materials 域
  - B3 settings/workspace/runs/其余组件与 hooks
- 各批次约束：只改 import 与调用点，不改行为；相关测试同步改 import 不改语义；批次内 `pnpm --filter @journal/web test` + typecheck 全绿。
- 收尾批 B4（依赖 B1-B3）：删除 tauri.ts 本体 + 全局 grep 残余 + 死代码清理（以文档实体核对反向驱动）+ 全仓测试构建全绿（AC-3）。

### WS-3 护栏机器化（opencode，依赖 WS-2 收尾）

Rule1：优先 ESLint 内建，零新依赖；表达不了才引 dependency-cruiser。

- `no-restricted-imports`：组件目录禁 import raw `electron`、禁绕过 hostBridge/runtimeClient、禁 import 已删除的 `lib/tauri`。
- `no-restricted-syntax`/CI 脚本：组件禁硬编码 daemon URL（`localhost:` 字面量）、禁 localStorage 业务持久化（面板宽度白名单除外）。
- docs 一致性 CI 脚本：核对核心文档引用的文件路径真实存在（AC-2 长效化）。
- 每条规则附故意违反的红测试证明会拦（AC-4）。

## 验收流程

每个任务：opencode 交付 → kimi 按 story AC + 本 design 范围出 verify-report → Claude 读 diff/跑测试终审 → commit。

## 风险与回滚

- 44 文件拆解为最大风险：批次文件集不相交、每批独立提交、可单批回滚。
- ESLint 新规上线可能大面积红：必须在 WS-2 完成后启用（顺序已保证）。
