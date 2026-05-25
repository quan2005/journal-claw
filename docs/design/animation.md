---
title: 动画
description: JournalClaw 动画纪律：transform + opacity only，ease-out-quart，≤300ms。
---

# 动画

## 核心纪律

谨迹的动画遵循三条硬规则：

1. **只动 `transform` 和 `opacity`** — 绝不触 `width`、`height`、`margin`、`padding`
2. **只用 ease-out-quart** — 缓动曲线 `cubic-bezier(0.16, 1, 0.3, 1)`
3. **≤ 300ms** — 任何动画不超过这个阈值

## 为什么只动 transform 和 opacity

`transform` 和 `opacity` 由 GPU 合成器处理，在主线程之外运行。不会触发重排（reflow）或重绘（repaint），帧率稳定在 60fps。

`width`、`height`、`margin`、`padding` 的过渡会触发主线程布局重算——性能代价高，且视觉不流畅。

## 缓动选择

ease-out-quart 的物理含义：运动开始时速度快，然后急剧减速。它比 ease-out 更干脆——没有过度柔软，不会让人觉得"在等动画做完"。

不使用的缓动：
- `ease-in-out` — 太对称，平庸
- `ease-in` — 减速到停止才加速，体验差
- bounce / elastic — 不严肃，不尊重用户的时间

## 动画时长

| 类型 | 时长 | 说明 |
|---|---|---|
| 微交互（hover、focus） | 100–180ms | 按钮、图标状态切换 |
| 内容过渡（选中、切换） | 200–250ms | 列表选中、面板切换 |
| 入场/消失 | 250–300ms | 浮动元素、通知 |

超过 300ms 的动画让用户等待。谨迹是工具，工具应该快。

## 减少动效

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

系统开启"减少动态效果"时，所有动画瞬间完成——不关闭，只是移除时长。功能完整保留。

## 动画清单

### 录音按钮

- **待机 → 录音**：`background-color` 过渡 180ms ease，琥珀金 → 录音红
- **脉冲**：`opacity` 动画，2.4s ease-in-out，0.4→1→0.4
- **Hover**：`transform: scale(1.04)` + `box-shadow`（仅水平扩散），180ms

### 列表项

- **Hover**：`background-color` 180ms ease
- **选中**：`background-color` 200ms ease + 左侧色条 `opacity` 过渡
- **入场**：从列表上方滑入，`transform: translateY(-4px)` + `opacity: 0` → 正常，250ms，stagger 30ms

### AI 标识

- **活跃**：`opacity` 脉冲，2.4s，0.6→1
- **状态切换**：`background-color` 180ms，`border-color` 180ms

### 面板切换

- **详情面板内容**：`opacity` + `transform: translateX(4px)` → 正常，200ms
- **拖拽分割线**：拖动中不带动画，松手后瞬间定位

## 禁用项

不使用 SVG 路径动画（SMIL），不使用 CSS `@keyframes` 中涉及 `box-shadow`、`border-width` 的渐变，不使用 `will-change` 预先声明——谨迹没有重度动画场景，不需要合成层预热。

## Agent Prompt 速查

在提示 AI 生成谨迹组件时，直接引用这行：

> 动画只能用 `transform` + `opacity`，ease-out-quart，≤300ms，支持 `prefers-reduced-motion`。
