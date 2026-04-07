# 方案 B：色彩系统对齐

> Date: 2026-04-07
> Status: Approved
> Scope: globals.css 色彩 token + 组件硬编码色值 + TodoSidebar

## 问题

1. **双 accent 色**：浅色模式用青绿 `#4a6a7a`，深色模式用琥珀金 `#C8933B` 作为 primary action 色。规范要求全局只有录音红一种 accent
2. **纯灰中性色**：深色模式大量 `#3a3a3a`、`#666`、`#888` 等纯灰，缺少规范要求的墨水青 tint
3. **深色 token 重复 3 次**：globals.css 中 @media 块（147-261）、第一个 [data-theme="dark"]（264-357）、第二个 [data-theme="dark"]（548-637），且三者之间有不一致
4. **TodoSidebar 硬编码**：8 处 `rgba(255,255,255,*)` 在浅色模式下不可见
5. **硬编码琥珀色**：~15 处 `rgba(200,147,5*)` 散布在组件中

## 设计

### 色彩策略

**移除青绿/琥珀 accent，统一为红色系：**

`--record-btn` 的语义是 "primary action"，不仅用于录音按钮。重命名为 `--action` 并统一为 accent 红的变体：

| 角色 | 浅色模式 | 深色模式 |
|---|---|---|
| --accent | #ff3b30 | #ff375f |
| --action | #c0392b（红色偏深，用于非录音 action） | #d94452（红色偏亮） |
| --action-hover | #a83228 | #e05565 |

但这个改动影响面太大（21+ 变量 + 15+ 组件），需要分阶段：

**Phase 1（本次）：**
- 合并深色 token 重复为 1 份
- 为所有纯灰中性色添加墨水青 tint
- 修复 TodoSidebar 的 rgba(255,255,255,*) 问题
- 添加 --space-* 间距 token

**Phase 2（后续）：**
- 将青绿/琥珀替换为红色系 action 色
- 这需要更仔细的视觉设计和用户确认

### 墨水青 Tint 规则

纯灰 `#NNN` → 加入微妙的蓝青偏移。方法：R 分量略低，B 分量略高。

深色模式替换表：

| 原值 | 用途 | 新值 | 说明 |
|---|---|---|---|
| `#3a3a3a` | month-label, sidebar-month, section-label | `#353840` | R-5, B+6 |
| `#666` | segment-text | `#5e6268` | 加青 |
| `#1c1c1c` | selected-bg | `#1a1c20` | 微调 |
| `#606060` | detail-summary | `#585c64` | 加青 |
| `#404040` | detail-case-key | `#3a3e46` | 加青 |
| `#808080` | detail-case-val | `#787c84` | 加青 |
| `#bbb` | detail-case-title | `#b4b8c0` | 加青 |
| `#333` | queue-border, context-menu-border | `#2e3238` | 加青 |
| `#222` | divider | `#1e2228` | 加青 |
| `#909090` | md-h3 | `#888c94` | 加青 |
| `#b0b0b0` | md-text | `#a8acb4` | 加青 |
| `#888888` | md-bullet, dock-dropzone-hint | `#808488` | 加青 |
| `#cccccc` | md-em | `#c4c8d0` | 加青 |
| `#aaaaaa` | item-meta, dock-dropzone-text | `#a2a6ae` | 加青 |

浅色模式大部分已有冷色 tint，仅修复：
- `#bbb` (todo-checkbox-border) → `#b4b8c0`

### 深色 Token 合并

保留结构：
1. `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` — 系统深色
2. `[data-theme="dark"] { ... }` — 手动深色

删除第三个重复块（548-637）。将其中的差异值（如 `--dock-dropzone-hint: #606060`）合并到保留的块中，取最终生效的值。

### TodoSidebar 修复

将 8 处 `rgba(255,255,255,*)` 替换为 CSS 变量引用：

| 用途 | 替换为 |
|---|---|
| checkbox border | `var(--divider)` |
| tag background | `var(--item-hover-bg)` |
| row hover | `var(--item-hover-bg)` |
| row border | `var(--divider)` |
| section border | `var(--divider)` |

### 间距 Token

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
}
```

本次仅定义 token，不迁移组件（组件迁移范围太大，留给后续）。

### 不动的部分

- 青绿/琥珀 → 红色的 accent 替换（Phase 2）
- 组件中硬编码的 `rgba(200,147,5*)` 琥珀色（Phase 2）
- 动效（方案 C）
- 字体（方案 A 已完成）

## 影响范围

- `src/styles/globals.css` — 合并深色 token、添加墨水青 tint、添加 --space-* token
- `src/components/TodoSidebar.tsx` — 替换 rgba(255,255,255,*) 为变量引用

## 风险

中。深色模式色值变化需要视觉验证。合并 3 份 token 时需注意不一致的值。
