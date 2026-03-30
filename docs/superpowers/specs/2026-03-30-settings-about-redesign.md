# Settings About Page Redesign

**Date:** 2026-03-30
**Status:** Approved

## Goal

将设置页"关于"从功能性的版本号展示，升级为品牌名片——既保留版本/版权信息，又融入品牌叙事和联系方式。

---

## Layout (top to bottom)

### 1. 应用名区块（居中卡片）

- 应用名 `谨迹`：18px, `var(--item-text)`, fontWeight 500
- Slogan：`每一次思考，都值得被谨迹`，12px, `var(--item-meta)`，marginTop 6px
- 容器：`var(--detail-case-bg)` 背景，`1px solid var(--divider)` 边框，borderRadius 8，padding 20px，textAlign center

### 2. 理念卡片（两条信念）

每条信念独立一行，左侧 2px 竖线（`var(--record-btn)` 金色），无外框，间距 12px。

**第一条：**
- 主句（粗体）：`你只管输入，剩下的交给谨迹。`，13px, `var(--item-text)`, fontWeight 600
- 副句：`拖入零散的会议讨论，它会替你把散的拼完整。`，11px, `var(--item-meta)`，marginTop 3px

**第二条：**
- 主句（粗体）：`你的时间应该花在决策上，不是整理上。`，13px, `var(--item-text)`, fontWeight 600
- 副句：`整理是谨迹的事，你的精力值得更好的去处。`，11px, `var(--item-meta)`，marginTop 3px

理念卡片容器：marginTop 16px，无背景无边框，padding 0

### 3. 联系作者（可折叠/静态展示）

- 区块标题：`联系作者`，11px，`var(--month-label)`，uppercase，letterSpacing 0.08em，marginTop 24px，marginBottom 12px
- 微信二维码：120×120px img，borderRadius 8，居中展示
- 说明文字：`扫码添加微信`，10px，`var(--duration-text)`，marginTop 8px，居中

二维码图片放在 `src/assets/wechat-qrcode.png`，通过 Vite 静态资源 import（`import qrCode from '../../assets/wechat-qrcode.png'`）打包进程序，不手写 base64。

### 4. 底部元信息

- 单行：`版本 {version} · macOS · Tauri · React · Rust · Claude`
- 10px，`var(--duration-text)`，居中，marginTop 24px

---

## Skeleton Loading

与其他 Section 一致：
- 应用名区块：center 布局，SkeletonRow height=18 width=60，height=12 width=120
- 理念区：两条 SkeletonRow height=13 + height=11
- 联系区：SkeletonRow height=120 width=120（居中）+ height=10 width=80

加载完成后 160ms `section-fadein` 淡入，与其他 Section 一致。

---

## File Changes

- `src/settings/components/SectionAbout.tsx`：重写内容区，import 静态资源图片
- `src/assets/wechat-qrcode.png`：压缩至 200px 的微信二维码（29KB）

---

## Out of Scope

- 不添加点击复制微信号功能（二维码已足够）
- 不引入新的 CSS 变量
- 不修改其他 Section
