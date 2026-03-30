# 谨迹 UI Redesign — 时间流 · 日志优先

Date: 2026-03-28
Status: Approved

## Overview

将整个应用的视觉语言从"文件管理器"转向"日志型记录工具"。参考 Day One 的时间流气质，采用现代感、层次稍丰富的设计风格。核心约束：永远按时间序列排列，不支持其他排序方式。

## 整体架构

**窗口**：有最小宽度 280px，无最大宽度限制，用户可自由拖拽调整。不再因 DetailSheet 展开而触发窗口 resize。

**层级结构（从底到顶）**：
```
[TitleBar — 透明/同色，仅承载窗口拖拽区]
[RecordingList — 时间流卡片列表，flex 占满剩余高度]
[FAB RecordButton — absolute 定位，右下角悬浮]
[DetailSheet — absolute 全覆盖，从底部滑入，遮罩 + 内容卡片]
```

**TitleBar**：背景色与列表区域完全一致（`--titlebar-bg: var(--bg)`），高度保持 36px，仅作拖拽区，不显示任何文字或 icon。

**RecordingList**：`overflow-y: auto`，内容从上向下流动，最新在最顶部。底部留 88px padding 避免 FAB 遮挡最后一项。

## 卡片列表与时间流

### 月份章节标题

```
2026年3月
─────────────
```

- 字号 16px，weight 600，颜色 `--item-text`
- 下方细分割线
- 顶部 24px 空间，月份之间 32px 间距

### 录音条目卡片

```
28                录音 2026-03-28
周六              19:54 · 11:47  ✓
```

- **左侧**：日期大字（28px, weight 300，细体）+ 小字星期（11px）
- **右侧**：条目标题（13px, weight 500）+ 时间 · 时长（12px）+ 转写状态 icon
- 同一天多条录音：只有第一条显示日期数字，后续左侧空白对齐
- 无方块 icon，无左侧麦克风图标区域
- 转写状态（✓ / spinner / ✗）显示在时长右侧，极小
- hover：整行轻微背景 `var(--item-hover-bg)`
- 选中态：左边 2px 竖线（`--card-selected-bar`）+ 轻底色，不做全蓝填充
- 卡片间细分割线

### 入场动画

新录音完成处理后：
- `translateY(-12px) opacity:0` → 正常位置 `opacity:1`
- duration 280ms，ease-out
- `prefers-reduced-motion`：仅 opacity 淡入，150ms

## 录音交互与 FAB

### FAB 形态

| 状态 | 外观 |
|------|------|
| 空闲 | 56px 红色圆形，白色小圆点，呼吸 pulse 动画 |
| 录制中 | 56px 红色圆形，白色圆角方块，无动画 |

- `position: absolute; bottom: 24px; right: 24px`
- 阴影：`0 4px 16px rgba(0,0,0,0.18)`
- 按压反馈：`scale(0.92)`，duration 120ms

### 录制中实时卡片

置于列表顶部（最新月份章节之上）：

```
┌─────────────────────────────┐
│  ● 录制中      00:12        │
│  今天 14:32                 │
└─────────────────────────────┘
```

- 背景：`rgba(255,59,48,0.06)`，左边 3px 红色竖线
- 脉冲红点（pulse 动画），时长实时跳动
- 停止后变为"处理中"状态（spinner + "处理中…"）
- 处理完成后以入场动画替换为正式条目

### 停止录制 jolt 动画

```css
@keyframes jolt {
  0%   { transform: scale(1); }
  30%  { transform: scale(0.88); }
  60%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
```
duration 240ms，传递"已记录"的触觉感。

## DetailSheet

### 触发

点击任意录音条目，从底部滑入，覆盖整个窗口（TitleBar 以下）。

### 结构

```
┌──────────────────────────────┐  ← 遮罩 rgba(0,0,0,0.30)，点击关闭
│                              │
│  ╔════════════════════════╗  │
│  ║  ────  (拖拽把手)      ║  │  ← 顶部圆角 16px
│  ║  28  录音 2026-03-28   ║  │  ← 大日期 + 标题
│  ║      19:54 · 11:47     ║  │  ← 时间 · 时长
│  ║  ──────────────────    ║  │
│  ║  转写内容...            ║  │  ← 可滚动文本区
│  ║                        ║  │
│  ╚════════════════════════╝  │
└──────────────────────────────┘
```

- Sheet 高度：`min(85vh, 600px)`
- 内容区：`overflow-y: auto`
- 无"转写内容"标题栏，去掉多余 chrome
- 顶部信息行视觉语言与列表卡片一致

### 动画

| 动作 | duration | easing |
|------|----------|--------|
| 打开 | 320ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| 关闭 | 260ms | ease-in |
| 遮罩 | 300ms | ease |
| 弹回 | spring | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

### 关闭方式

1. 点击遮罩
2. 向下拖拽把手超过 80px 松手
3. Escape 键

### 拖拽关闭

Sheet 跟随鼠标/触摸实时 `translateY`。松手判断：
- 位移 > 80px → 触发关闭动画
- 位移 ≤ 80px → 弹回原位（spring curve）

## Design Tokens

### 新增

```css
--sheet-overlay: rgba(0, 0, 0, 0.30);
--card-selected-bar: var(--record-btn);
--date-number: var(--item-text);
--date-secondary: var(--item-meta);
```

### 调整

```css
--titlebar-bg: var(--bg);                      /* 去掉色差 */
--item-hover-bg: rgba(0, 0, 0, 0.04);          /* light mode，更轻 */
/* dark mode: rgba(255, 255, 255, 0.05) */
```

## 字体层级

| 用途 | 字号 | weight | 颜色 | 备注 |
|------|------|--------|------|------|
| 月份标题 | 16px | 600 | `--item-text` | |
| 日期大字 | 28px | 300 | `--date-number` | tabular-nums |
| 星期 | 11px | 400 | `--item-meta` | |
| 条目标题 | 13px | 500 | `--item-text` | |
| 时间/时长 | 12px | 400 | `--item-meta` | tabular-nums |
| 转写文本 | 14px | 400 | `--item-text` | line-height 1.75 |

## 间距节奏

基准 4px。常用：8 / 12 / 16 / 24 / 32px。

## 动画汇总

| 动画 | duration | easing | 描述 |
|------|----------|--------|------|
| 卡片入场 | 280ms | ease-out | translateY(-12px)→0, opacity 0→1 |
| Sheet 打开 | 320ms | (0.32,0.72,0,1) | translateY(100%)→0 |
| Sheet 关闭 | 260ms | ease-in | translateY(0)→100% |
| 遮罩 | 300ms | ease | opacity |
| FAB 按压 | 120ms | ease-out | scale(0.92) |
| FAB jolt | 240ms | ease-out | scale 抖动 |
| 弹回 | — | (0.34,1.56,0.64,1) | spring 回弹 |
| reduced-motion | 150ms | ease | 仅 opacity |

## 文件变更范围

| 文件 | 变更类型 |
|------|----------|
| `src/styles/globals.css` | 更新 tokens，新增 tokens |
| `src/styles/animations.css` | 新增 jolt，更新 pulse |
| `src/components/TitleBar.tsx` | 去掉背景色差 |
| `src/components/MonthDivider.tsx` | 升级为章节标题样式 |
| `src/components/RecordingItem.tsx` | 完全重写为日期卡片样式 |
| `src/components/RecordingList.tsx` | 同天日期去重逻辑，底部 padding |
| `src/components/RecordButton.tsx` | 改为 absolute FAB，加 jolt 动画 |
| `src/components/DetailSheet.tsx` | 新建，替换 DetailPanel |
| `src/App.tsx` | 移除窗口 resize 逻辑，改用 DetailSheet，FAB absolute 布局 |
