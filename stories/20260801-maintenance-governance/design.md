# JournalClaw 维护治理设计

日期：2026-08-01

## 1. 目标与维护模型

维护模型是“个人维护者 + 多个 AI Agent”，但按小团队的可复现标准运行：规则不能依赖某个 Agent 的记忆或某次会话；同一提交在本地和 CI 应得到相同结论。

最高层元规则：

> 规则必须有唯一权威出处，并尽可能转化为自动化门禁；文档、代码与 CI 不一致时，视为维护缺陷。

## 2. 方案比较

### 方案 A：文档优先

只整理 AGENTS、ARCH 和 CONVENTIONS，以人工评审执行。

- 优点：变更少，落地快。
- 缺点：仓库已经证明单靠文档会漂移；失效路径、版本基线和 CI 触发差异不能及时发现。

### 方案 B：政策即代码（采用）

权威文档定义规则，仓库脚本验证静态事实，CI 强制门禁，story/报告保存验收证据。

- 优点：可复现、可审计；能按风险和路径渐进增加强度。
- 缺点：需要维护检查脚本和 CI；初期需清理存量漂移。

### 方案 C：全面合规治理

所有改动强制完整 E2E、覆盖率阈值、安全扫描、双人审批和长期制品留存。

- 优点：控制最强。
- 缺点：与个人维护规模不匹配，反馈周期和维护成本过高。

## 3. 四层治理闭环

### 3.1 规范层

| 权威文件                | 唯一职责                                         |
| ----------------------- | ------------------------------------------------ |
| `AGENTS.md`             | 导航、铁律摘要、常用命令；不承载细则             |
| `docs/ARCH.md`          | 模块职责、依赖方向、信任边界、写入通道           |
| `docs/CONVENTIONS.md`   | 代码规范、测试策略、变更流程、CI/CD、依赖治理    |
| `docs/COMPATIBILITY.md` | 版本语义、公共兼容面、数据迁移、支持与回滚       |
| `docs/DESIGN.md`        | 视觉与交互设计系统                               |
| `docs/final-state.md`   | 产品北极星与五个一等对象，不记录易过期的实现状态 |
| `docs/adr/`             | 重要决策历史，只增不改                           |

其他指南可以解释用法，但必须链接权威规则，不复制规范正文。

### 3.2 执行层

维护检查分为五组：

1. `docs-policy`：失效路径、退休术语、权威文件重复声明、文档地图一致性。
2. `version-policy`：package 锁步版本、release baseline、tag 格式和版本文件修改来源。
3. `architecture-policy`：依赖方向、runtimeClient/hostBridge 边界、contracts 单源、Electron 特权边界。
4. `story-policy`：story frontmatter、状态转换、AC、verify-report 关联。
5. `dependency-policy`：锁文件、许可证、漏洞与 GitHub Actions 完整 SHA。

本地 hook 只提供快速反馈；CI 是最终硬门，避免本地 hook 被跳过后失去保护。

### 3.3 强制层

master 禁止未经 PR 直接写入。required checks 至少包含：

- policy：docs、version、architecture、story；
- quality：format、lint、typecheck；
- test：各 workspace Vitest；
- build：contracts、web、daemon、desktop 的适用构建；
- risk-gated：Playwright renderer、真实 daemon integration、Electron launch/package smoke。

Release 必须复用已通过的提交和验证结果，不允许 tag workflow 绕过测试后直接上传资产。

### 3.4 证据层

- CI 保存结构化测试摘要；失败时保存 trace、截图和必要日志。
- story 的 verify-report 记录 AC 到实现与测试的映射、命令和退出码。
- 视觉变化保存浅色/暗色关键截图；几何和可访问性使用自动断言，主观审美由用户确认。
- CI artifact 是短期诊断证据；仓库只保存对长期决策有价值的报告和基线，避免二进制证据无限增长。

## 4. 八个治理域

### 4.1 版本、发布与兼容

- JournalClaw 保持 `0.x`，直到四类公共兼容面均有契约、迁移和自动化验证：workspace 数据、daemon API、设置 schema、skill/plugin contract。
- `fix` 和向后兼容 `feat` 升 patch；breaking change 升 minor。release-please 配置启用 pre-major 的 minor/patch 映射。
- 采用单一产品版本，根和四个 workspace manifest 锁步；tag 固定为既有 `vX.Y.Z`。
- release-please 是版本、CHANGELOG 和 GitHub Release 正文的唯一生成器；资产 workflow 只验证和上传 DMG，不再次生成 release notes。
- 普通 PR 禁止直接修改版本文件；只有 Release PR 可以修改。
- 先把 manifest 与已发布 `v0.16.0` 对齐，再重建 Release PR；不得合并当前错误基线产生的 `1.0.0` PR。

  1.0 准入条件：

1. 四类公共兼容面有明确版本策略；
2. 数据迁移和上一正式版本升级测试稳定；
3. 至少一次完整发布、安装、升级和回滚演练通过；
4. breaking change 有弃用窗口，而非直接移除；
5. 用户明确批准进入 1.0。

### 4.2 架构与代码组织

- Web 业务能力只经 runtimeClient；宿主能力只经 hostBridge。
- desktop 保持零业务语义；daemon service 承担业务语义；route 只做协议适配。
- `packages/contracts` 是跨端 wire contract 唯一源，禁止 Web/daemon 创建人工镜像。
- contract 包不得依赖 apps；apps 之间禁止源码互引；desktop 不依赖 daemon service。
- 新 endpoint 必须同时提供 runtime schema、类型和契约测试。现有手写 route/client 逐步迁移，禁止继续扩大单个巨型 switch/入口文件。
- 文件大小本身不设机械硬门；当一个模块承担多个职责、存在多个变化原因或无法独立测试时必须拆分。

### 4.3 写入通道

采用分级通道：

| 写入发起者         | 通道             | 规则                                        |
| ------------------ | ---------------- | ------------------------------------------- |
| Agent 修改用户资产 | ChangeSet        | 授权、预览、审计、原子应用                  |
| 用户直接操作       | Mutation Service | 统一校验和原子写入，立即执行并记录结果      |
| 系统元数据         | 专用 Store       | 不混入用户资产审批，但必须限制目录和 schema |
| 数据迁移           | Migration        | 备份、幂等、版本标记、失败停写与恢复        |

任何 route、组件或 Electron handler 都不得直接绕过对应通道写用户资产。

### 4.4 代码工程规范

- 全 workspace 统一 strict TypeScript、ESLint 和 Prettier；环境差异通过分层 tsconfig 表达。
- 禁止新增 lint warning、React act warning、循环依赖和未解释的类型逃逸；存量 warning/format 差异建账并采用“不得增加”。格式基线记录违规文件内容指纹，并与 PR 目标分支对比，阻断新文件、已知文件内债务扩大以及基线新增/改写；格式严格清理作为独立债务，普通 PR 只允许基线缩减。
- 错误必须保留可操作上下文，边界层负责映射为稳定错误码；禁止静默 catch。
- 日志不得输出 API key、用户正文或完整文件内容；敏感字段统一脱敏。
- 优先使用权威实现或许可证兼容的成熟库；引入依赖必须说明用途、维护状态、许可证、体积和替代方案。
- 禁止顺手进行与 story 无关的重构；发现邻近债务时建账，不扩大当前变更面。

### 4.5 测试与验证

测试以风险映射，而不是以固定测试金字塔数量为目标：

| 变更类型              | 最低验证                                                |
| --------------------- | ------------------------------------------------------- |
| 文档/规则             | docs policy、链接/路径、一致性、format                  |
| contracts/API         | contract test、daemon route、runtime client、相关 build |
| daemon/权限/文件写入  | service 单测、真实临时文件系统、失败/恢复路径           |
| Web hook/组件         | Testing Library 用户可观察断言、Web 全量 Vitest         |
| 跨面板/真实 CSS/视觉  | production renderer Playwright、浅/暗主题证据           |
| preload/IPC/启动/打包 | desktop Vitest、真实 Electron launch/package smoke      |
| 数据迁移              | 上一版本 fixture、备份、重复运行、失败注入与恢复        |

- 新行为和 bugfix 先写失败测试；视觉修复验证真实 CSS cascade。
- E2E 使用用户可见 locator 和 web-first assertion，避免依赖实现细节。
- 覆盖率先采集基线并禁止下降；ChangeSet、权限、迁移、runtimeClient 和 IPC 等关键模块再设置按文件阈值。
- 独立 AI 验收核对 story 的“不漏、不多、不偏”，但只有 CI 全绿才能合并。

### 4.6 变更流程

- 产品行为、架构、数据、权限或发布链变更必须有 approved story；纯说明性文档和无行为重构可以走轻量 PR 模板。
- 影响跨模块依赖、数据格式、安全模型、公共契约或不可逆选择时新增 ADR。
- PR 标题遵循 Conventional Commits，采用 squash merge，保证 release history 可机器解析。
- 每个 PR 只解决一个可验收目标；实现、测试、文档和迁移必须在同一变更中闭环。
- 例外必须写明原因、风险、责任人和失效日期；不得使用永久 `skip-gate`。
- push、tag、Release、删除用户数据或不可逆迁移需要用户确认。

### 4.7 依赖、安全与供应链

- Bun lockfile 是依赖唯一锁定来源，CI 使用 frozen install。
- GitHub Actions 固定到完整 commit SHA，并由 Dependabot 或 Renovate 维护升级。
- 新依赖通过许可证、维护活跃度、已知漏洞和供应链来源检查；高权限 runtime 依赖需要人工复核。
- Electron 强制 context isolation、sandbox、关闭 Node integration；主进程校验 IPC sender、导航、新窗口和外链协议，不信任 renderer 侧校验。
- daemon 只监听预期 loopback 范围，鉴权/来源边界在服务端执行；敏感配置不进入 workspace 或日志。
- 严重漏洞可走紧急修复流程，但仍必须保留最小回归、变更记录和补充验收。

### 4.8 文档、ADR 与技术债

- `final-state.md` 只保留产品北极星和对象状态；已完成迁移细节进入 ADR，当前实现只写 ARCH。
- docs consistency 检查隐藏目录、失效相对路径、退休术语和权威来源重复。
- 技术债条目必须包含影响、触发条件、处理建议和责任版本；禁止只有 `TODO` 没有上下文。
- 规则修改本身视为架构变更：需要 story/ADR、规则文档、检查脚本和 CI 同步更新。

## 5. 落地顺序

### Phase 0：止血

- 阻止错误的 `1.0.0` Release PR 被合并。
- 对齐 release baseline、tag 命名和 workflow 触发链。
- 修复失效门禁路径、退休 runtime 文档和 CI 说明漂移。

### Phase 1：规则单一来源

- 新增 COMPATIBILITY；重整 ARCH、CONVENTIONS、final-state 和 AGENTS 导航。
- 明确写入通道和 Electron 信任边界。

### Phase 2：政策即代码

- 扩展 docs consistency；增加 version、architecture 和 story policy。
- 全 workspace lint/typecheck 统一，并设置 required checks。

### Phase 3：风险测试

- CI 纳入 renderer Playwright、真实 daemon integration 和 Electron smoke。
- 建立 coverage/warning 基线、防回退和失败 artifact。

### Phase 4：存量治理

- 移除 contracts 镜像和退休 API。
- 拆分 daemon server/runtime client 巨型入口。
- 为已有 workspace 数据建立版本化迁移 fixture。

每个 Phase 单独 story、单独验收；Phase 0–3 完成前不进入 1.0。

## 6. 风险控制

- 新门禁可能首先暴露存量失败。采用“存量建账、禁止新增”的方式过渡，不永久降低标准。
- 路径触发可能漏判跨模块影响。公共契约、权限、迁移和构建配置一律按高风险执行，不允许跳过。
- 真实 Electron 和视觉测试可能不稳定。必须使用固定平台/依赖、隔离数据、用户可见 locator 和失败 trace，不以增加 sleep 解决波动。
- 自动化不能判断所有产品语义。story AC 和用户对方向性变更的批准继续保留。
