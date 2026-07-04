---
title: 画像分组展示与归档
status: verified
source: gate-L2
created: 2026-06-12
---

## 背景

当前画像列表按字母排序平铺展示。画像文件名已含分组前缀（`趣丸-xxx`、`傲程-xxx`、`product-xxx` 等），对应 `IdentityEntry.region` 字段，但前端未利用该信息做分组。

用户需要：

1. 画像按 region 分组展示
2. 新增「归档」功能——将不再活跃的画像移入 `identity/archived/` 子目录，前端统一折叠在底部

## 设计

### 存储

- 在画像 frontmatter 中添加 `archived: true` 标记归档状态
- `IdentityEntry` 新增 `archived: bool` 字段
- AI 构建上下文时（`prompt.rs`）跳过 `archived: true` 的画像；workspace agent 仍可通过文件系统按需读取

### 前端列表

从上到下：

1. **核心画像**（Soul + README）— 已实现
2. **分割线**
3. **按 region 分组的普通画像** — 每组一个 SectionHeader（label = region，如「趣丸」「傲程」「product」），默认展开
4. **分割线**
5. **归档**分组 — SectionHeader，默认折叠

### 归档操作

- 右键菜单新增「归档」/「取消归档」选项
- 归档 = 在 frontmatter 中写入 `archived: true`
- 取消归档 = 移除 frontmatter 中的 `archived` 字段

## AC

- AC-1: 当画像列表有多个 region 时，按 region 分组展示，每组有可折叠的 SectionHeader
- AC-2: region 为空的画像归入「其他」分组
- AC-3: 右键普通画像，出现「归档」选项；点击后 frontmatter 写入 `archived: true`，列表刷新
- AC-4: 归档画像统一出现在列表底部「归档」分组中，默认折叠
- AC-5: 右键归档画像，出现「取消归档」选项；点击后移除 frontmatter `archived` 字段，列表刷新
- AC-6: AI 构建 system prompt 时（`build_system_prompt`）跳过 `archived: true` 的画像。**注（验收回写）**：当前 `build_system_prompt` 只加载 `identity/README.md`（核心画像，受 AC-8 不可归档），故 archived 画像结构上不可能进入 prompt——由 AC-8 + 只读 README 架构共同保证，无需显式过滤逻辑。未来若 prompt.rs 扩展为遍历画像列表，需另起 spec 加显式 guard。
- AC-7: workspace agent 仍可通过文件路径正常读取归档画像内容（文件位置不变）
- AC-8: 核心画像（Soul + README）不可归档

## 非目标

- 不做多级子目录归档
- 不做批量归档操作
- 不移动文件（以 frontmatter 字段为准，文件位置不变）
- 不改变 AI 处理素材时的 identity-profiling skill 逻辑（skill 自身决定是否读取归档文件）

## NFR

| 维度       | 判断                                               |
| ---------- | -------------------------------------------------- |
| 性能       | N/A — identity 文件通常 < 100 个                   |
| 安全权限   | N/A                                                |
| 数据隐私   | N/A                                                |
| 可靠性降级 | 归档目录不存在时静默忽略，不报错                   |
| 可观测性   | N/A                                                |
| 回滚       | 取消归档即回滚；文件内容和路径不变                 |
| 兼容性     | 文件不移动，日志中 `@identity/xxx.md` 引用不受影响 |
| 成本       | N/A                                                |
| 风控滥用   | N/A                                                |
| 运营客服   | N/A                                                |
| 多语言地区 | N/A                                                |

## 依赖与影响

- `src-tauri/src/identity.rs` — `list_identity_entries` 需扫描 archived 子目录 [证据]
- `src-tauri/src/llm/prompt.rs:45-48` — 当前只加载 README.md，不受影响 [证据]
- `src/components/TreeSidebar.tsx` — 列表渲染需按 region 分组 [证据]
- `src/components/TreeContextMenu.tsx` — 右键菜单新增归档选项 [证据]
- workspace CLAUDE.md 第 44 行 — AI 处理素材时读取「已知档案」，归档文件仍可被 agent 访问 [证据]
