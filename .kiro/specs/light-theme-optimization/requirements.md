# 需求文档：浅色主题优化（Impeccable 设计理念）

## 简介

当前浅色主题（墨青色系）存在多项与 Impeccable 设计理念相悖的问题：使用纯白背景（#ffffff）、大量依赖 alpha 透明度（rgba）定义交互状态、缺乏 Surface 层级系统、中性色不带品牌色调。本次优化参考 Impeccable 的核心设计理念——Tinted Neutrals、消除 Alpha 依赖、Surface 层级系统、60-30-10 色彩分配——在保持墨青色系（hue ~200°）不变的前提下，全面提升浅色主题的视觉品质和一致性。

仅修改 `src/styles/globals.css` 中 `:root` 和 `[data-theme="light"]` 下的 CSS 变量值，以及 `src/lib/tags.ts` 中浅色主题的标签颜色逻辑。不涉及组件结构或逻辑变更。

## 术语表

- **Theme_Engine**: 应用的主题系统，通过 CSS 变量控制所有 UI 元素的颜色，定义在 `src/styles/globals.css` 中
- **Light_Theme**: 浅色主题，即 `:root` 和 `[data-theme="light"]` 中定义的 CSS 变量集合
- **Tinted_Neutral**: 带有品牌色调（墨青 hue ~200°）暗示的中性色，替代纯灰色。OKLCH chroma 值在 0.005~0.015
- **Surface_Layer**: 表面层级系统，通过 2-3 个递进的表面颜色创建视觉深度，替代阴影
- **Alpha_Free_Color**: 不使用 rgba/hsla 透明度的明确颜色值，为每个上下文定义确定性的覆盖颜色
- **Background_Layer**: --bg、--sidebar-bg、--titlebar-bg、--dock-bg 等构成的多层背景体系
- **Interactive_State**: 列表项的选中态（--item-selected-bg）和悬停态（--item-hover-bg）
- **Divider**: 分割线和边框（--divider、--dock-border 等）
- **Tag_System**: 标签颜色系统，通过 `src/lib/tags.ts` 中的 PALETTE 和颜色逻辑控制
- **WCAG_AA**: Web 内容无障碍指南 AA 级，正文对比度至少 4.5:1，大文字至少 3:1
- **Color_Ratio_60_30_10**: 60% 中性背景、30% 次要颜色、10% 强调色的分配规则

## 需求

### 需求 1：Tinted Neutrals — 消除纯白和纯灰

**用户故事：** 作为用户，我希望浅色主题的背景和中性色带有墨青色调的微妙暗示，而非纯白或纯灰，这样界面感觉更自然、更有品牌凝聚力。

#### 验收标准

1. THE Theme_Engine SHALL 将 --bg 从纯白 #ffffff 替换为带有墨青色调（hue ~200°）的近白色（推荐 oklch(97.5% 0.005 200) 或等效 hex 值），chroma 值在 0.003~0.008 范围内
2. THE Theme_Engine SHALL 确保所有中性色变量（--sidebar-bg、--dock-bg、--queue-bg、--detail-case-bg、--md-pre-bg、--item-icon-bg）均带有墨青色调暗示（hue 在 195°~210° 范围内），不使用纯灰色
3. THE Theme_Engine SHALL 将 --context-menu-bg 从纯白 #ffffff 替换为与 --bg 一致的带色调近白色
4. THE Theme_Engine SHALL 将 --record-btn-icon 从纯白 #ffffff 替换为带有微弱色调的近白色
5. WHEN Light_Theme 激活时，THE Theme_Engine SHALL 确保 --bg 与 --item-text 之间的对比度满足 WCAG_AA 标准（至少 4.5:1）
6. THE Theme_Engine SHALL 确保 --bg 的亮度值不超过 97.5%（OKLCH L 值）

### 需求 2：消除 Alpha 依赖 — 明确颜色值

**用户故事：** 作为用户，我希望界面颜色在任何背景上都是可预测和一致的，不会因为底层颜色变化而产生意外的视觉效果。

#### 验收标准

1. THE Theme_Engine SHALL 将 --item-selected-bg 从 rgba(58,90,106,0.05) 替换为明确的不透明颜色值（预计算该 alpha 在 --bg 上的最终呈现色）
2. THE Theme_Engine SHALL 将 --item-hover-bg 从 rgba(0,0,0,0.04) 替换为明确的不透明颜色值
3. THE Theme_Engine SHALL 将 --titlebar-bg 从 rgba(0,0,0,0.04) 替换为明确的不透明颜色值
4. THE Theme_Engine SHALL 将 --dock-dropzone-hover-bg 从 rgba(58,90,106,0.06) 替换为明确的不透明颜色值
5. THE Theme_Engine SHALL 将 --record-highlight 从 rgba(58,90,106,0.06) 替换为明确的不透明颜色值
6. THE Theme_Engine SHALL 将 --md-code-bg 从 rgba(0,0,0,0.055) 替换为明确的不透明颜色值
7. THE Theme_Engine SHALL 将 --scrollbar-thumb 和 --scrollbar-thumb-hover 从 rgba 值替换为明确的不透明颜色值
8. THE Theme_Engine SHALL 将 --sheet-overlay 保留为 rgba 值，因为遮罩层需要透视底层内容（合理的 alpha 例外）
9. THE Theme_Engine SHALL 将 --queue-shadow 和 --context-menu-shadow 保留为 rgba 值，因为阴影需要与底层混合（合理的 alpha 例外）
10. WHEN 所有 alpha 值被替换后，THE Theme_Engine SHALL 确保替换后的颜色与原 alpha 值在 --bg 上的视觉呈现一致（色差 ΔE < 2）

### 需求 3：Surface 层级系统 — 用表面创建深度

**用户故事：** 作为用户，我希望界面有清晰的视觉深度层次，通过不同亮度的表面来区分内容层级，而不仅仅依赖阴影。

#### 验收标准

1. THE Theme_Engine SHALL 定义三个 Surface 层级变量：--surface-1、--surface-2、--surface-3，亮度从高到低递减，均带有墨青色调
2. THE Theme_Engine SHALL 确保 --surface-1 的亮度高于 --bg（用于卡片、弹出层等提升元素），--surface-2 等于或略低于 --bg（用于主内容区），--surface-3 低于 --bg（用于凹陷区域如侧边栏）
3. THE Theme_Engine SHALL 确保相邻 Surface 层级之间存在至少 1.5% 的 OKLCH 亮度差
4. THE Theme_Engine SHALL 将 --sidebar-bg 映射到 --surface-3 层级
5. THE Theme_Engine SHALL 将 --dock-bg 映射到 --surface-3 层级
6. THE Theme_Engine SHALL 将 --titlebar-bg 映射到 --surface-3 或更深的层级
7. THE Theme_Engine SHALL 将 --detail-case-bg、--md-pre-bg、--queue-bg 映射到 --surface-1 层级
8. THE Theme_Engine SHALL 确保 Background_Layer 中各层的亮度形成一致的层次梯度：--surface-1 > --bg > --surface-3

### 需求 4：增强交互状态可见性 — 无 Alpha 方案

**用户故事：** 作为用户，我希望列表项的选中态和悬停态清晰可辨，使用明确的颜色而非透明度叠加。

#### 验收标准

1. THE Theme_Engine SHALL 使用明确的不透明颜色值定义 --item-selected-bg，该颜色应为 --bg 与墨青强调色的混合色，视觉效果等同于原 alpha 0.10~0.12 的效果
2. THE Theme_Engine SHALL 使用明确的不透明颜色值定义 --item-hover-bg，该颜色应为 --bg 与墨青色调的混合色，视觉效果等同于原 alpha 0.05~0.06 的效果
3. THE Theme_Engine SHALL 确保 --item-selected-bg 的视觉效果明显强于 --item-hover-bg，两者之间存在可区分的明度差（至少 2%）
4. WHEN 列表项处于选中态时，THE Theme_Engine SHALL 确保 --item-selected-text 与 --item-selected-bg 的对比度满足 WCAG_AA 标准（至少 4.5:1）
5. THE Theme_Engine SHALL 确保 --item-selected-bg 和 --item-hover-bg 均带有墨青色调（hue 在 195°~210° 范围内），与品牌色保持一致

### 需求 5：增强分割线和边框对比度 — Tinted 边框

**用户故事：** 作为用户，我希望分割线和边框在浅色背景上清晰可见，且带有品牌色调而非纯灰色。

#### 验收标准

1. THE Theme_Engine SHALL 将 --divider 调整为带有墨青色调的边框色（推荐 oklch(88% 0.008 200) 或等效 hex 值），比当前 #e5e5ea 更深
2. THE Theme_Engine SHALL 将 --dock-border 调整为与 --divider 一致或更深的带色调值
3. THE Theme_Engine SHALL 确保 --divider 与 --bg 之间的对比度至少为 1.3:1
4. THE Theme_Engine SHALL 将 --sheet-handle 调整为比当前 #d1d1d6 更深的带墨青色调值，使底部抽屉的拖拽手柄更明显
5. THE Theme_Engine SHALL 确保所有边框色（--divider、--dock-border、--detail-case-border、--dock-kbd-border）均带有墨青色调暗示，不使用纯灰色

### 需求 6：增强标签颜色对比度

**用户故事：** 作为用户，我希望标签（如 bug、plan 等）在浅色背景上有足够的对比度，这样我能快速识别标签内容。

#### 验收标准

1. THE Tag_System SHALL 将浅色主题下标签文字的 alpha 值从当前的 0.78 提升到至少 0.88
2. THE Tag_System SHALL 将浅色主题下标签背景的 alpha 值从当前的 0.13 提升到至少 0.16
3. WHEN Light_Theme 激活时，THE Tag_System SHALL 确保每个 PALETTE 颜色生成的标签文字与标签背景之间的对比度至少为 3:1

### 需求 7：增强辅助文字对比度 — 不在彩色背景上使用灰色

**用户故事：** 作为用户，我希望时间戳、月份标签等辅助文字在浅色背景上更容易阅读，且不使用纯灰色。

#### 验收标准

1. THE Theme_Engine SHALL 将 --item-meta 从当前的 #86868b 调整为带有墨青色调的更深值（推荐 oklch(50%~55% 0.01 200) 或等效 hex 如 #6a7278）
2. THE Theme_Engine SHALL 将 --month-label 从当前的 #8e8e93 调整为带有墨青色调的更深值
3. THE Theme_Engine SHALL 将 --duration-text 从当前的 #c7c7cc 调整为带有墨青色调的更深值（推荐范围 #a0a8ad ~ #b0b4b8）
4. THE Theme_Engine SHALL 确保 --item-meta 与 --bg 之间的对比度至少为 4.5:1
5. THE Theme_Engine SHALL 确保所有辅助文字颜色（--item-meta、--month-label、--duration-text、--detail-section-label、--dock-dropzone-text）均带有墨青色调暗示，不使用纯灰色

### 需求 8：增强 AI 状态胶囊和 Dock 组件对比度

**用户故事：** 作为用户，我希望 AI 状态胶囊和底部 Dock 区域的各元素在浅色背景上更清晰。

#### 验收标准

1. THE Theme_Engine SHALL 将 --ai-pill-border 从当前的 #c8d8e0 调整为更深的带墨青色调值，使胶囊边框更明显
2. THE Theme_Engine SHALL 将 --dock-dropzone-border 从当前的 #b0b0b4 调整为带有墨青色调的更深值
3. THE Theme_Engine SHALL 将 --dock-kbd-bg 从当前的 #e8e8e8 调整为带有墨青色调的值，使快捷键提示更突出
4. THE Theme_Engine SHALL 确保 --ai-pill-text 与 --ai-pill-bg 之间的对比度至少为 4.5:1

### 需求 9：60-30-10 色彩分配一致性

**用户故事：** 作为用户，我希望界面的色彩分配遵循 60-30-10 规则，强调色稀少而有力，不会因过度使用而削弱其视觉冲击力。

#### 验收标准

1. THE Theme_Engine SHALL 确保 60% 的界面面积由 Tinted_Neutral 背景色覆盖（--bg、--sidebar-bg、--dock-bg、--surface 层级）
2. THE Theme_Engine SHALL 确保 30% 的界面面积由次要颜色覆盖（--item-text、--item-meta、--divider、--md-text 等文字和边框色）
3. THE Theme_Engine SHALL 确保墨青强调色（--record-btn、--item-selected-text、--md-h1、--md-h2 等）仅用于 CTA 按钮、选中态文字、标题等关键元素，占比约 10%
4. THE Theme_Engine SHALL 保持 --record-btn 为 #4a6a7a 不变
5. THE Theme_Engine SHALL 保持 --record-btn-hover 为 #3a5a6a 不变
6. THE Theme_Engine SHALL 保持 --item-selected-text 为 #3a5a6a 不变
7. THE Theme_Engine SHALL 保持 --md-h1 和 --md-h2 为 #3a5a6a 不变
8. THE Theme_Engine SHALL 保持所有墨青色系的色相值（H）在 195°~210° 范围内

### 需求 10：确保暗色主题不受影响

**用户故事：** 作为用户，我希望浅色主题的优化不会影响暗色主题的任何颜色。

#### 验收标准

1. THE Theme_Engine SHALL 仅修改 `:root` 和 `[data-theme="light"]` 中的 CSS 变量值
2. THE Theme_Engine SHALL 保持 `[data-theme="dark"]` 和 `@media (prefers-color-scheme: dark)` 中的所有变量值不变
3. THE Theme_Engine SHALL 保持 Tag_System 中暗色主题的 alpha 值（textAlpha: 0.72, bgAlpha: 0.12）不变

### 需求 11：视觉层次通过多维度实现

**用户故事：** 作为用户，我希望界面的视觉层次不仅依赖字号大小，还通过颜色深浅、字重、间距等多维度来建立清晰的信息层级。

#### 验收标准

1. THE Theme_Engine SHALL 确保主文字（--item-text）、辅助文字（--item-meta）、弱化文字（--duration-text）之间存在至少三个可区分的对比度层级
2. THE Theme_Engine SHALL 确保 --item-text 与 --bg 的对比度至少为 7:1（AAA 级），--item-meta 与 --bg 的对比度至少为 4.5:1（AA 级），--duration-text 与 --bg 的对比度至少为 3:1
3. THE Theme_Engine SHALL 确保标题色（--md-h1、--md-h2）与正文色（--md-text）之间存在可感知的色彩差异（标题使用墨青强调色，正文使用深色中性色）