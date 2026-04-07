# 方案 A：字体系统重建

> Date: 2026-04-07
> Status: Approved
> Scope: globals.css + App.css + 所有组件 inline font 样式

## 问题

当前 app 使用 IBM Plex Mono 作为全局正文字体，与 `.impeccable.md` 规范严重偏离：

- 规范要求正文用系统无衬线（SF Pro），等宽仅用于代码块
- 字号有 15+ 种硬编码值（8px–26px），无 token 体系
- 字重使用不规范，无统一约束
- App.css 残留 Tauri 脚手架代码，字体栈冲突（Inter/Avenir）
- Settings 面板字体栈与主 app 不一致

## 设计

### 字体栈

| 角色 | CSS 值 | 使用场景 |
|---|---|---|
| Body | `system-ui, -apple-system, BlinkMacSystemFont, sans-serif` | 全局默认，所有正文 |
| Mono | `'IBM Plex Mono', ui-monospace, monospace` | `.md-body` 代码块、inline code |
| Serif | `'Noto Serif SC', serif` | JournalItem 标题（保留现有用法） |

Body 栈在 macOS 上解析为 SF Pro，≥20px 自动切换 Display 光学尺寸。

### 字号 Token

7 级模块化比例（1.25），定义为 CSS 自定义属性：

```css
:root {
  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.8125rem;  /* 13px */
  --text-base: 0.875rem;   /* 14px */
  --text-md:   1rem;       /* 16px */
  --text-lg:   1.25rem;    /* 20px */
  --text-xl:   1.5rem;     /* 24px */
  --text-2xl:  1.875rem;   /* 30px */
}
```

最小可用字号为 `--text-xs` (12px)。当前 8–10px 的用法全部提升到 12px。

### 字号映射

| 当前值 | 出现位置 | 目标 token |
|---|---|---|
| 8–9px | Todo due badge, 日历 weekday | `--text-xs` |
| 10–11px | Todo section header, 标签, 时间戳, kbd hint | `--text-xs` |
| 12–12.5px | 摘要, dock 标签, 月份标签, sidebar tab | `--text-sm` |
| 13px | JournalItem 标题, dock 文字, toast | `--text-base` |
| 14px | 详情正文, settings nav, dropzone | `--text-base` |
| 16–17px | Markdown 段落, 转录文字 | `--text-md` |
| 18px | Markdown h2, detail sheet header | `--text-lg` |
| 24–26px | 日期数字, Markdown h1 | `--text-xl` |

### 字重 Token

```css
:root {
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
}
```

规则：正文 400 / 强调 500 / 标题 600。禁止 300 和 700+。

### 清理

- 删除 `App.css` 中所有死代码（`.logo`, `.container`, `a`, `button`, `input`, `h1`, `#greet-input`）
- 删除 `App.css` 中 `:root` 的 Inter/Avenir 字体栈
- 统一 Settings 面板字体为全局 Body 栈
- `.md-body` 中的字号改用 token

### 不动的部分

- 颜色系统（方案 B）
- 动效（方案 C）
- 间距 token（方案 B）
- 组件结构和布局
- Noto Serif SC 在 JournalItem 标题中的使用

## 影响范围

- `src/styles/globals.css` — 添加 token，修改全局字体栈
- `src/App.css` — 删除死代码和冲突字体栈
- 所有含 inline `fontSize` / `fontFamily` / `fontWeight` 的组件
- `src/components/Settings.tsx` — 统一字体栈

## 风险

低。纯视觉变更，不影响业务逻辑。所有改动可通过视觉回归验证。
