# Quickstart: 首次启动引导体验

**Created**: 2026-05-25

## 开发流程

```bash
# 1. 确认在 feature 分支
git branch  # 应显示 * 001-onboarding-experience

# 2. 启动开发环境
npm run tauri dev

# 3. 模拟首次启动（清除引导状态）
# 删除 config.json 中的 onboarding_completed 字段:
# macOS: ~/Library/Application Support/com.journalclaw.app/config.json
```

## 关键文件

| 优先级 | 文件 | 工作内容 |
|---|---|---|
| 1 | `src/components/OnboardingView.tsx` | 新建：引导主组件（三步：工作区 → AI 引擎 → 能力展示） |
| 2 | `src/hooks/useOnboarding.ts` | 新建：引导状态管理 hook |
| 3 | `src/App.tsx` | 修改：集成引导覆盖层渲染 |
| 4 | `src-tauri/src/config.rs` | 修改：添加 `onboarding_completed` 字段 |
| 5 | `src-tauri/src/onboarding.rs` | 新建：get/set onboarding 状态命令 |
| 6 | `src-tauri/src/main.rs` | 修改：注册新 Tauri 命令 |
| 7 | `src/lib/tauri.ts` | 修改：添加 onboarding IPC 封装；确认 AI 引擎测试连接命令可用 |
| 8 | `src/locales/zh.ts` | 修改：添加引导中文字符串（含 AI 引擎步骤） |
| 9 | `src/locales/en.ts` | 修改：添加引导英文字符串 |
| 10 | `src/styles/onboarding.css` | 新建：引导专用样式（含提供商选择卡、连接测试状态） |
| 11 | `src/components/JournalList.tsx` | 修改：移除空状态提示文字 |
| 12 | `src/components/DetailPanel.tsx` | 修改：添加空工作区引导语 |
| 13 | `src/settings/components/SectionAiEngine.tsx` | 参考：审查提供商选择、API Key 输入、连接测试的现有实现 |

## 验证清单

- [ ] 首次启动显示引导流程
- [ ] 步骤 0 展示默认工作区路径
- [ ] 确认路径后过渡到 AI 引擎配置步骤
- [ ] 步骤 1 展示提供商选择器（至少 4 个选项）
- [ ] API Key 输入框支持显示/隐藏切换
- [ ] "测试连接"按钮功能正常：成功/失败结果明确展示
- [ ] 连接测试成功后"继续"按钮反映已配置状态
- [ ] AI 配置步骤可跳过
- [ ] 步骤 2 展示两种输入方式（拖入文件、粘贴文本）
- [ ] 每步均可跳过直接进入主界面
- [ ] 引导完成后再启动不重现
- [ ] 深色/浅色主题切换正常
- [ ] 减少动效偏好受尊重
- [ ] 中文/英文文案显示正确
- [ ] 空工作区无"暂无日志"文字
- [ ] 引导中触发的导入/粘贴在过渡后不中断
- [ ] 窗口关闭后重启恢复到未完成步骤
- [ ] 旧版本升级用户（config.json 无 `onboarding_completed` 字段）触发引导
