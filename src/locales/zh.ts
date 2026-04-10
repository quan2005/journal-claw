import type { Strings } from './en'

export const zh: Strings = {
  // App
  appName: '谨迹',
  tagline: '你负责思考，AI 负责剩下的。',

  // Sidebar tabs
  profiles: '画像',
  journal: '记忆',

  // Settings nav
  general: '通用',
  aiEngine: 'AI 引擎',
  voice: '语音转写',
  permissions: '授权管理',
  plugins: '技能插件',
  about: '关于',
  back: '返回',
  settings: '设置',

  // CommandDock
  pastePrompt: '粘贴会议记录、文章、随手笔记',
  aiArchiveHint: 'AI 帮你归档 · 支持 txt · md · pdf · docx · 图片',
  noteOptional: '备注（可选）',
  pasteOrDrop: '粘贴文本或文件',
  textareaPlaceholderFiles: '补充说明…',
  textareaPlaceholderText: '在此粘贴文本，或拖入文件（txt/md/pdf/docx 等）…',
  cancel: '取消',
  submit: '提交整理',
  submitted: '已提交，谨迹整理中…',
  submitFailed: '提交失败',
  audioRejected: '语音转写未配置，音频文件已忽略',
  settingsTooltip: '设置 (⌘,)',
  startRecording: '开始录音',
  stopRecording: '停止录音',
  voiceNotReady: '语音转写未就绪，请前往设置 → 语音转写',

  // ErrorBoundary
  somethingWentWrong: '出了点问题',
  retry: '重试',

  // AiStatusPill
  processing: '整理中…',
  processingNamed: '{name} · 整理中',
  aiReady: '谨迹待命中',

  // TitleBar
  todoTooltipOpen: '待办 (⌘T)',
  todoTooltipClose: '收起待办 (⌘T)',

  // Context menus (journal + identity)
  referenceEntry: '引用',
  copyContent: '复制内容',
  copyFilePath: '复制文件路径',
  openInEditor: '用默认编辑器打开',
  showInFinder: '在 Finder 中显示',
  delete: '删除',
  mergeTo: '合并到…',

  // Identity list
  builtin: '内置',
  noProfiles: '暂无身份档案',
  recordingHint: '录音后会自动创建说话人档案',
  me: '我',

  // IdentityDetail context menu
  copySelected: '复制选中文本',
  copyMarkdown: '复制全文 (Markdown)',
  copied: '已复制',
  copy: '复制',

  // DetailPanel (empty state)
  startCapturing: '通过以下方式开始记录',
  via: '开始',
  recordCard: '录音记录',
  recordCardHint: '说出你的想法\nAI 自动整理成日志',
  pasteCard: '粘贴 / 拖文件',
  pasteCardHint: '会议记录、日记\nAI 自动提炼关键信息',
  sampleCard: '创建示例条目',
  sampleCardHint: '生成一条示例\n了解 AI 整理效果',

  // DetailPanel code block copy
  findPrev: '上一个 (Shift+Enter)',
  findNext: '下一个 (Enter)',
  closeFindBar: '关闭 (Esc)',

  // SoulView
  aiPersonality: '人格设定',
  aiPersonalityDesc: '定义谨迹的角色与工作偏好',
  saving: '保存中…',
  autoSaved: '已自动保存',
  saveFailed: '保存失败，请重试',
  save: '保存',

  // RecordingList
  recording: '录制中',
  today: '今天',
  processingDots: '处理中…',

  // JournalList / MonthDivider
  noEntries: '还没有日志条目。点击录音按钮或拖入文件开始记录。',
  weekdays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  loadMore: '加载更多',
  loadingMore: '加载中…',
  allLoaded: '已加载全部',

  // ProcessingQueue
  converting: '转换中',
  queued: '排队中',
  processingItem: '处理中',
  failed: '失败',
  retryTooltip: '重试',
  retryLabel: '重试',
  closeTooltip: '关闭',
  done: '完成',
  recordingStatus: '录音中',
  confirmCancel: '确认取消？',
  confirm: '确认',
  cancelTooltip: '取消',

  // AiLogModal
  failedStatus: '失败',
  completedStatus: '已完成',
  waitingOutput: '等待输出...',
  stopProcessing: '停止处理',

  // MergeIdentityDialog
  mergeProfiles: '合并身份档案',
  mergeFrom: '将「{name}」合并到',
  selectTarget: '— 选择目标档案 —',
  mergeMode: '合并方式',
  voiceOnly: '仅声纹',
  voiceOnlyDesc: '将声纹 ID 关联到目标档案，不合并文字内容',
  fullMerge: '完整合并',
  fullMergeDesc: '合并声纹 ID、标签和正文内容',
  mergingDots: '合并中…',
  confirmMerge: '确认合并',

  // TodoSidebar
  todo: '想法',
  itemCount: '{count} 项',
  addTodo: '输入想法...',
  addTodoBtn: '添加想法',
  completedSection: '已完成 · {count}',
  clearDueDate: '清除截止日期',
  setDueDate: '设置截止日期',
  copyText: '复制文本',
  deleteTodo: '删除',
  exploreInDepth: '探讨',
  clearExploreSession: '清理探讨进程',
  setPath: '设置路径…',
  removePath: '移除路径',
  pathGroupDefault: '默认',
  weekdaysFull: ['日', '一', '二', '三', '四', '五', '六'],
  monthsFull: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],

  // Settings: General
  workspacePath: 'Workspace 路径',
  workspaceDesc: '日志和素材的存储根目录',
  browse: '选择…',
  saveBtn: '保存',
  saved: '已保存',
  savingDots: '保存中…',
  saveFailedMsg: '保存失败，请重试',
  unsavedChanges: '有未保存修改',

  // Settings: AI Engine
  aiEngineSection: 'AI 引擎',
  comingSoon: '即将推出',
  inDevelopment: '开发中',
  claudeNotFound: '未检测到 Claude Code',
  installOneLiner: '一键安装',
  requiresHomebrew: '需要已安装 Homebrew。点击一键安装，或手动运行：',
  installing: '正在安装 {label}…',
  leaveBlankDefault: '留空则使用 CLI 默认配置',
  customEndpoint: '自定义 API 端点，留空使用默认值（代理场景）',
  leaveBlankModel: '留空使用 CLI 默认模型',
  dashscopeKeyHint: '阿里云 DashScope API Key（独立于语音转写配置）',
  customEndpointHint: '自定义 API 端点，留空使用默认值',
  leaveBlankModelHint: '留空使用默认模型',

  // Settings: Voice
  voiceSection: '语音转写',
  downloading: '下载中',
  downloaded: '已下载',
  downloadFailed: '下载失败',
  whisperNotFound: '未检测到 whisperkit-cli',
  reDetect: '重新检测',
  installingDots: '安装中…',
  installBtn: '一键安装',
  transcriptionModel: '转写模型',
  downloadBtn: '下载',
  downloadingBtn: '下载中',
  alreadyDownloaded: '已下载',
  downloadInBackground: '下载已在后台继续，切换模型或滚动页面都不会中断。',
  modelDownloadTask: '模型下载任务',
  latestStatus: '最新状态',
  recentLogs: '最近日志',
  reDownload: '重新下载',
  openModelDir: '打开模型目录',
  retryHint: '失败后可直接重试，不用重新选模型。',
  switchModelHint: '切换模型不会打断当前下载任务。',
  modelStoreDir: '模型存放目录',
  openInFinder: '在 Finder 中打开',
  baseModelBundled: 'Base 模型已内置在应用包中。上方目录用于存放额外下载的 Small / Large 模型。',
  downloadFromHF: '点击下载按钮自动从 HuggingFace 下载，之后离线可用。也可手动将模型文件放入上方目录。',
  dashscopeHint: '配置后，录音将自动上传至阿里云转写',
  speakerEmbedderUnavailable: '声纹识别不可用',
  speakerEmbedderHint: '未检测到 SpeakerEmbedder 模型，录音转写时无法生成说话人 ID。请确认应用包中包含 speakerkit-models 资源。',

  // Settings: Permissions
  permissionsSection: '授权管理',
  permissionsDesc: '谨迹需要以下系统权限才能正常工作。点击「检测权限」查看当前状态，或点击「一键授权」完成授权。',
  checkPermissions: '检测权限',
  rechecking: '重新检测',
  checking: '检测中…',
  grantAll: '一键授权',
  allGranted: '所有权限已就绪',
  clickToCheck: '点击「检测权限」查看各项授权状态',
  permMic: '麦克风',
  permMicDesc: '录音功能需要访问麦克风，用于语音转写和会议记录。',
  permSpeech: '语音识别',
  permSpeechDesc: '使用 Apple 语音识别引擎时需要此权限（DashScope / WhisperKit 不需要）。',
  permClaude: 'Claude CLI',
  permClaudeDesc: 'AI 日志处理需要系统中安装 Claude CLI 命令行工具。',
  installClaude: '请先安装 Claude CLI：',
  statusGranted: '已授权',
  statusDenied: '已拒绝',
  statusRestricted: '受限制',
  statusNotDetermined: '未授权',
  statusUnknown: '未知',
  requestPermission: '请求授权',
  openSystemSettings: '前往系统设置',
  failedToOpen: '无法打开系统设置: {err}',
  requestFailed: '请求授权失败: {err}',
  authError: '授权过程出错: {err}',

  // Settings: Speakers
  speakersSection: '声纹管理',
  speakersDesc: '录音后自动识别说话人并注册声纹档案。在此处为说话人命名，AI 整理时将使用您设置的名称。',
  noSpeakers: '暂未检测到说话人',
  noSpeakersHint: '完成一次录音后，系统将自动识别说话人并在此处显示',
  speakerCount: '说话人档案（共 {count} 人）',
  unnamed: '未命名',
  appearsIn: '出现在 {count} 条录音中',
  nameTooltip: '命名',
  mergeTooltip: '合并到…',
  deleteTooltip: '删除',
  confirmDelete: '确认删除',
  mergeVoice: '合并声纹',
  mergeVoiceDesc: '将 {name} 合并到另一个说话人，合并后原档案将被删除。',
  noOtherSpeakers: '没有其他说话人档案可以合并。',
  selectTargetSpeaker: '选择目标说话人…',
  merge: '合并',

  // Settings: Plugins
  pluginsSection: '技能插件',
  pluginMarketSoon: '插件市场即将开放',
  morePlugins: '更多插件',

  // Settings: About
  version: '版本 {version}',
  addWeChat: '扫码添加微信',
  wechatQr: '微信二维码',
  whisperCredit: '内置 WhisperKit（MIT License）by Argmax, Inc. — 本地语音识别引擎',

  // App (AI config warning)
  aiNotConfigured: 'AI 引擎未配置',
  goToSettings: '前往设置 →',

  // App (identity assistant name)
  assistantName: '助理',
  assistantDesc: '定义谨迹的角色与工作偏好',

  // DetailPanel context menu + code block
  addToTodo: '添加到想法',

  // IdentityDetail / SoulView editing
  search: '搜索…',
  replaceBtn: '替换',
  replaceAll: '全部',
  replacePlaceholder: '替换为…',
  reset: '还原',
  edit: '编辑',
  resetAssistantTitle: '还原助理',
  confirmResetAssistant: '确认恢复为默认助理设定？当前的自定义内容将被覆盖。',

  // App confirm dialog
  confirmDeleteIdentity: '确认删除「{name}」的档案？',
  recordingConverting: '录音处理中',

  // SectionVoice: model hints
  baseModelHint: '默认模型，中文效果稳定，适合日常会议记录',
  smallModelHint: '中文效果更好，适合会议记录',
  largeModelHint: '最佳中文效果，首次下载较慢',

  // SectionVoice: dynamic messages
  downloadingModel: '正在下载 {model} 模型…',
  downloadSuccess: '{model} 模型已下载，可离线使用',
  downloadErrorFallback: '下载失败，请检查网络连接后重试',
  downloadConflict: '正在下载 {model}，请稍候',
  installError: '错误: {err}',

  // SectionVoice: engine labels + vendors
  appleEngineLabel: 'Apple 语音识别',
  appleVendorSpeechAnalyzer: '系统内置 · SpeechAnalyzer',
  appleVendorDefault: '系统内置 · 零配置',
  whisperkitVendor: 'Argmax · 本地',
  dashscopeVendor: '阿里云 · 云端',

  // SectionAiEngine
  qwenVendor: '阿里云',

  // SectionPlugins
  pluginScheduledSort: '定时文件整理',
  pluginScheduledSortDesc: '按规则自动归档 Workspace 中的素材和日志，保持目录整洁',
  pluginVisualizer: '图文可视化美化',
  pluginVisualizerDesc: '将日志内容转换为图文并茂的可视化卡片，便于分享',

  // Settings: Automation
  automation: '自动整理',
  autoLintTitle: '日志库自动整理',
  autoLintDesc: '扫描日志条目，修复引用、标注演进、更新档案',
  frequency: '整理频率',
  freqDaily: '每天',
  freqWeekly: '每周',
  freqMonthly: '每月',
  execTime: '执行时间',
  minEntries: '最少新增条目',
  skipIfInsufficient: '不足则跳过',
  lastRun: '上次整理',
  nextCheck: '下次检查',
  currentNew: '当前新增',
  runNow: '立即整理',
  lintRunning: '正在整理中…',
  neverRun: '尚未执行过自动整理',
  lintFailed: '上次整理失败',
  entries: '篇',
  organized: '整理了',

  // Settings: IM bridge
  im: 'IM 配置',
  // Settings: Feishu bridge
  feishu: '飞书',
  feishuTitle: '飞书 IM 桥接',
  feishuDesc: '接收飞书消息，作为日志素材处理',
  feishuEnable: '启用飞书桥接',
  feishuAppId: 'App ID',
  feishuAppSecret: 'App Secret',
  feishuAppIdPlaceholder: 'cli_xxxxxxxxxxxxxxxx',
  feishuAppSecretPlaceholder: '飞书开放平台的应用密钥',
  feishuStatus: '连接状态',
  feishuStatusIdle: '未启用',
  feishuStatusConnecting: '连接中…',
  feishuStatusConnected: '已连接',
  feishuStatusError: '错误',
  feishuSave: '保存',
  feishuPermsTitle: '所需权限',
  feishuPermMsg: '通过 WebSocket 接收消息',
  feishuPermSend: '以机器人身份发送回复',
  feishuPermRead: '读取消息历史',
  feishuPermDrive: '导出飞书文档',
}
