# 方案 C：动效纪律整顿

> Date: 2026-04-07
> Status: Approved
> Scope: animations.css + globals.css + 组件 transition 属性

## 问题

当前动效实现与 `.impeccable.md` 规范存在多处偏离：
- 3 个 keyframe 动画使用 box-shadow（pulse, mic-glow-expand, rec-pulse）
- 1 个 keyframe 使用 border-color（kbd-glow-pulse）
- 1 个 bounce 弹跳 keyframe（jolt，未使用但存在）
- 1 个 spring 弹簧缓动（DetailSheet cubic-bezier y=1.56）
- 1 个 height 过渡（ProcessingQueue）
- ~12 处 border-color 过渡、2 处 box-shadow 过渡
- 3 对重复 keyframe（spin, app-enter, shimmer）
- 几乎所有缓动都不是规范要求的 cubic-bezier(0.16, 1, 0.3, 1)
- prefers-reduced-motion 仅在 1 个组件中部分处理

## 设计

### 原则

规范要求：
- 仅动 transform + opacity
- 缓动：cubic-bezier(0.16, 1, 0.3, 1)
- 时长：反馈 ≤150ms，hover 200ms，布局 300ms，入场 400-500ms
- 退出比进入快 25%
- 必须尊重 prefers-reduced-motion

### 务实边界

严格来说 "仅动 transform + opacity" 会禁止所有 hover 背景色变化，这不现实。采用分层策略：

1. **硬性禁止**：box-shadow、height、width、padding、margin 动画/过渡
2. **替换为 transform+opacity**：pulse/rec-pulse/mic-glow-expand → scale+opacity，kbd-glow-pulse → opacity
3. **允许保留**：background-color、color 的 hover 过渡（≤200ms），因为这是基本交互反馈
4. **border-color 过渡**：替换为 opacity 变化或移除

### Keyframe 修复

| 原 keyframe | 问题 | 修复 |
|---|---|---|
| `jolt` | bounce 弹跳，未使用 | 删除 |
| `pulse` | box-shadow | 改为 transform: scale + opacity |
| `mic-glow-expand` | box-shadow | 改为 transform: scale + opacity |
| `rec-pulse` | box-shadow + scale overshoot | 移除 box-shadow，保留 scale（去掉 1.06 overshoot → 1.04） |
| `kbd-glow-pulse` | border-color | 改为 opacity 脉冲 |
| `shimmer` | background-position（骨架屏可接受） | 保留，合并重复 |

### 缓动标准化

引入 CSS 变量：
```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
```

所有 `ease`, `ease-out`, `ease-in-out` 替换为 `var(--ease-out)`。
DetailSheet 的 `cubic-bezier(0.34, 1.56, 0.64, 1)` 替换为 `var(--ease-out)`。

### prefers-reduced-motion

在 globals.css 添加全局媒体查询：
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 重复清理

- 删除 animations.css 中的 `spin`、`app-enter`（globals.css 中保留）
- 合并 `shimmer` 到 animations.css，globals.css 中删除

### 不动的部分

- 颜色系统（方案 B）
- 组件结构和布局
- 动画时长（大部分已在合理范围内）

## 影响范围

- `src/styles/animations.css` — keyframe 修复、删除重复
- `src/styles/globals.css` — 添加 --ease-out token、修复 kbd-glow-pulse、添加 reduced-motion、删除重复 keyframe
- `src/components/DetailSheet.tsx` — 替换 bounce 缓动
- `src/components/ProcessingQueue.tsx` — 移除 height 过渡
- `src/components/CommandDock.tsx` — 更新 mic button 过渡
- `src/components/SidebarTabs.tsx` — 移除 border-color/font-weight 过渡
- `src/components/AiStatusPill.tsx` — 移除 border-color 过渡
- 其他含 border-color/box-shadow 过渡的组件

## 风险

低-中。动效变化需要视觉验证，但不影响功能逻辑。
