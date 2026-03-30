# 谨迹

你负责思考，AI 负责剩下的。

谨迹是一款 macOS 桌面应用，帮助知识工作者把录音、文件、随手记录变成整理好的日志。输入越低门槛，输出越高质量。

## 为什么需要它

- **产品经理**：走路时冒出想法，说不完整，也没时间记
- **学生**：上课拼命记还是漏了要点，导师嘱咐转眼就忘
- **职场人**：开完会各散东西，下次还得重新对齐

每一个场景，谨迹只做一件事：不需要整理，就得到整理好的东西。

## 功能

![谨迹主界面](docs/images/screenshot-20260330-205220.png)

- **录音** — 一键开始，自动降噪、去除静默，转为 M4A
- **导入文件** — 拖入 PDF、DOCX、TXT，AI 自动处理
- **粘贴文字** — 粘贴会议摘要、网页内容，即时生成日志
- **AI 整理** — Claude CLI 提炼结构、生成纪要、补全材料
- **沉浸阅读** — Markdown 渲染，代码高亮，左列表右详情
- **多 Workspace** — 按月份归档，支持自定义工作区路径
- **深色 / 浅色主题** — 系统跟随，也可手动切换

## 快速上手

1. 从 [Releases](https://github.com/quan2005/journal/releases) 下载最新 `.dmg`，拖入应用程序
2. 安装 [Claude CLI](https://claude.ai/download)，确保 `claude` 命令可用
3. 打开谨迹，在设置中配置工作区路径，开始录音或导入文件

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 |
| 前端 | React 19 + TypeScript + Vite |
| 音频采集 | cpal 0.17 |
| 音频处理 | nnnoiseless（降噪）+ rubato（重采样）+ afconvert（M4A）|
| AI 处理 | Claude CLI（外部进程）|
| 序列化 | serde / serde_json |

## 架构

数据流：

```
用户操作（录音 / 拖文件 / 粘贴）
  → Frontend invoke() → src/lib/tauri.ts
  → Rust 命令处理 → workspace/yyMM/raw/ 写入原始材料
  → 启动 Claude CLI → 生成 workspace/yyMM/DD-title.md
  → 发出 journal-updated 事件
  → Frontend useJournal hook 重新加载条目
```

目录：

```
src/                     # 前端
  components/            # React 组件
  hooks/                 # useJournal, useRecorder, useTheme
  lib/tauri.ts           # 所有 IPC 调用封装
  types.ts               # 共享类型
src-tauri/src/           # Rust 后端
  ai_processor.rs        # 调用 Claude CLI，发出事件
  recorder.rs            # 录音控制
  audio_process.rs       # 降噪 / 重采样 / 去静默
  journal.rs             # 日志条目扫描与解析
  config.rs              # 应用配置读写
  workspace.rs           # 工作区路径工具函数
```

## 本地开发

**前置依赖**：Rust stable、Node.js 18+、macOS 12+

```bash
npm install
npm run tauri dev        # 启动开发模式（Vite + Tauri）
npm test                 # 前端测试（vitest）
cd src-tauri && cargo test   # Rust 单元测试
npm run tauri build      # 构建产物 → src-tauri/target/release/bundle/
```

首次运行需授权麦克风权限（系统设置 → 隐私与安全性 → 麦克风）。
