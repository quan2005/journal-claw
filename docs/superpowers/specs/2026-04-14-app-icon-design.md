# 谨迹 App Icon 设计规格

日期：2026-04-14

## 设计概念

繁体「謹」字由等距水平线条（日志行隐喻）构成，通过 SVG clipPath 裁切实现。字形居中放大溢出图标边界，被 macOS squircle 圆角裁切。右下角带琥珀金录音指示点（偏内侧位置）。

## 视觉参数

| 参数 | 值 |
|---|---|
| 字符 | 謹（繁体） |
| 字体 | system-ui, font-weight: 700 |
| 字色/线色 | #C8933B（琥珀金） |
| 背景色 | #0f0f0f（近黑） |
| viewBox | 0 0 320 320 |
| 字号 | 260（相对 viewBox） |
| 垂直居中 | dominant-baseline="central", text-anchor="middle" |
| 线间距 | 16px |
| 线宽 | 3.5（基准，小尺寸按比例加粗） |
| 溢出比例 | SVG 渲染尺寸 > 容器尺寸，约 130% |

## 录音指示点

| 参数 | 值 |
|---|---|
| 位置 | viewBox 坐标 (220, 225)，偏内侧 |
| 光晕 | r=13, fill=#C8933B, opacity=0.18 |
| 实心点 | r=6.5, fill=#C8933B |
| 小尺寸规则 | 32px 及以下去掉录音点 |

## 尺寸适配

| 输出尺寸 | 用途 | 线宽 | 录音点 |
|---|---|---|---|
| 512x512 | icon.png (master) | 3.5 | 有 |
| 256x256 | 128x128@2x.png | 4 | 有 |
| 128x128 | 128x128.png | 4.5 | 有 |
| 64x64 | 32x32@2x.png | 5 | 有 |
| 32x32 | 32x32.png | 7 | 无 |

另需生成：
- icon.icns（macOS）
- icon.ico（Windows）
- Square30x30Logo.png, Square44x44Logo.png, Square71x71Logo.png, Square89x89Logo.png, Square107x107Logo.png, Square142x142Logo.png, Square150x150Logo.png, Square284x284Logo.png, Square310x310Logo.png, StoreLogo.png（Windows Store）

## 实现方式

1. 用 Node.js 脚本生成 SVG 源文件
2. 用 sharp 或 resvg 将 SVG 渲染为各尺寸 PNG
3. 用 iconutil 生成 .icns
4. 用 png-to-ico 或类似工具生成 .ico
5. 替换 src-tauri/icons/ 下所有现有图标文件

## 技术要点

- clipPath 内的 text 元素依赖系统字体渲染，不同系统可能有差异。生产方案应将「謹」字转为 path 数据以确保一致性
- 小尺寸版本需要加粗线宽以保持可见性
- macOS squircle 圆角由系统自动应用，PNG 本身应为正方形无圆角
