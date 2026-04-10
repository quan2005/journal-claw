export const en = {
  // App
  appName: 'JournalClaw',
  tagline: 'Every thought, worth keeping.',

  // Sidebar tabs
  profiles: 'Profiles',
  journal: 'Journal',

  // Settings nav
  general: 'General',
  aiEngine: 'AI Engine',
  voice: 'Voice',
  permissions: 'Permissions',
  plugins: 'Plugins',
  about: 'About',
  back: 'Back',
  settings: 'Settings',

  // CommandDock
  pastePrompt: 'Paste notes, meeting minutes, or ideas',
  aiArchiveHint: 'AI organizes for you · txt · md · pdf · docx · images',
  noteOptional: 'Note (optional)',
  pasteOrDrop: 'Paste text or drop files',
  textareaPlaceholderFiles: 'Add a note…',
  textareaPlaceholderText: 'Paste text here, or drop files (txt/md/pdf/docx…)',
  cancel: 'Cancel',
  submit: 'Submit',
  submitted: 'Submitted — JournalClaw is processing…',
  submitFailed: 'Submit failed',
  audioRejected: 'Voice transcription not configured, audio ignored',
  settingsTooltip: 'Settings (⌘,)',
  startRecording: 'Start recording',
  stopRecording: 'Stop recording',
  voiceNotReady: 'Voice transcription not ready — go to Settings → Voice',

  // ErrorBoundary
  somethingWentWrong: 'Something went wrong',
  retry: 'Retry',

  // AiStatusPill
  processing: 'Processing…',
  processingNamed: '{name} · Processing',
  aiReady: 'JournalClaw ready',

  // TitleBar
  todoTooltipOpen: 'Todo (⌘T)',
  todoTooltipClose: 'Hide Todo (⌘T)',

  // Context menus (journal + identity)
  referenceEntry: 'Reference',
  copyContent: 'Copy content',
  copyFilePath: 'Copy file path',
  openInEditor: 'Open in default editor',
  showInFinder: 'Show in Finder',
  delete: 'Delete',
  mergeTo: 'Merge to…',

  // Identity list
  builtin: 'Built-in',
  noProfiles: 'No profiles yet',
  recordingHint: 'Speaker profiles are created automatically after recording',
  me: 'Me',

  // IdentityDetail context menu
  copySelected: 'Copy selected text',
  copyMarkdown: 'Copy full text (Markdown)',
  copied: 'Copied',
  copy: 'Copy',

  // DetailPanel (empty state)
  startCapturing: 'Start capturing',
  via: 'via',
  recordCard: 'Voice recording',
  recordCardHint: 'Speak your thoughts\nAI organizes them into journal entries',
  pasteCard: 'Paste / Drop files',
  pasteCardHint: 'Meeting notes, articles\nAI extracts the key information',
  sampleCard: 'Create sample entry',
  sampleCardHint: 'Generate a sample entry\nto see AI organizing in action',

  // DetailPanel code block copy
  findPrev: 'Previous (Shift+Enter)',
  findNext: 'Next (Enter)',
  closeFindBar: 'Close (Esc)',

  // SoulView
  aiPersonality: 'AI Personality',
  aiPersonalityDesc: 'Define how JournalClaw organizes and understands your notes',
  saving: 'Saving…',
  autoSaved: 'Auto-saved',
  saveFailed: 'Save failed, please retry',
  save: 'Save',

  // RecordingList
  recording: 'Recording',
  today: 'Today',
  processingDots: 'Processing…',

  // JournalList / MonthDivider
  noEntries: 'No journal entries yet. Start recording or drop a file.',
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  loadMore: 'Load more',
  loadingMore: 'Loading…',
  allLoaded: 'All entries loaded',

  // ProcessingQueue
  converting: 'Converting',
  queued: 'Queued',
  processingItem: 'Processing',
  failed: 'Failed',
  retryTooltip: 'Retry',
  retryLabel: 'Retry',
  closeTooltip: 'Close',
  done: 'Done',
  recordingStatus: 'Recording',
  confirmCancel: 'Cancel?',
  confirm: 'Confirm',
  cancelTooltip: 'Cancel',

  // AiLogModal
  failedStatus: 'Failed',
  completedStatus: 'Done',
  waitingOutput: 'Waiting for output…',
  stopProcessing: 'Stop processing',

  // MergeIdentityDialog
  mergeProfiles: 'Merge Profiles',
  mergeFrom: 'Merge "{name}" into',
  selectTarget: '— Select target profile —',
  mergeMode: 'Merge mode',
  voiceOnly: 'Voice only',
  voiceOnlyDesc: 'Link the voice ID to the target profile without merging text content',
  fullMerge: 'Full merge',
  fullMergeDesc: 'Merge voice ID, tags, and content',
  mergingDots: 'Merging…',
  confirmMerge: 'Confirm merge',

  // TodoSidebar
  todo: 'Ideas',
  itemCount: '{count} items',
  addTodo: 'Add an idea…',
  addTodoBtn: 'Add',
  completedSection: 'Done · {count}',
  clearDueDate: 'Clear due date',
  setDueDate: 'Set due date',
  copyText: 'Copy text',
  deleteTodo: 'Delete',
  exploreInDepth: 'Explore',
  setPath: 'Set path…',
  removePath: 'Remove path',
  pathGroupDefault: 'Default',
  weekdaysFull: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  monthsFull: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  // Settings: General
  workspacePath: 'Workspace path',
  workspaceDesc: 'Root directory for journals and materials',
  browse: 'Browse…',
  saveBtn: 'Save',
  saved: 'Saved',
  savingDots: 'Saving…',
  saveFailedMsg: 'Save failed, please retry',
  unsavedChanges: 'Unsaved changes',

  // Settings: AI Engine
  aiEngineSection: 'AI Engine',
  comingSoon: 'Coming soon',
  inDevelopment: 'In development',
  claudeNotFound: 'Claude Code not detected',
  installOneLiner: 'One-click install',
  requiresHomebrew: 'Requires Homebrew to be installed. Click to install, or run manually:',
  installing: 'Installing {label}…',
  leaveBlankDefault: 'Leave blank to use CLI default',
  customEndpoint: 'Custom API endpoint, leave blank for default (proxy use case)',
  leaveBlankModel: 'Leave blank to use CLI default model',
  dashscopeKeyHint: 'Alibaba Cloud DashScope API Key (independent of voice transcription config)',
  customEndpointHint: 'Custom API endpoint, leave blank for default',
  leaveBlankModelHint: 'Leave blank to use default model',

  // Settings: Voice
  voiceSection: 'Voice',
  downloading: 'Downloading',
  downloaded: 'Downloaded',
  downloadFailed: 'Download failed',
  whisperNotFound: 'whisperkit-cli not detected',
  reDetect: 'Re-detect',
  installingDots: 'Installing…',
  installBtn: 'Install',
  transcriptionModel: 'Transcription model',
  downloadBtn: 'Download',
  downloadingBtn: 'Downloading',
  alreadyDownloaded: 'Downloaded',
  downloadInBackground: 'Download continues in background — switching models or scrolling won\'t interrupt it.',
  modelDownloadTask: 'Model download task',
  latestStatus: 'Latest status',
  recentLogs: 'Recent logs',
  reDownload: 'Re-download',
  openModelDir: 'Open model directory',
  retryHint: 'You can retry directly after failure — no need to re-select the model.',
  switchModelHint: 'Switching models won\'t interrupt the current download.',
  modelStoreDir: 'Model storage directory',
  openInFinder: 'Open in Finder',
  baseModelBundled: 'Base model is bundled with the app. The directory above is for additionally downloaded Small/Large models.',
  downloadFromHF: 'Click Download to fetch automatically from HuggingFace. You can also place model files manually into the directory above.',
  dashscopeHint: 'When configured, recordings are automatically uploaded to Alibaba Cloud for transcription',
  speakerEmbedderUnavailable: 'Speaker recognition unavailable',
  speakerEmbedderHint: 'SpeakerEmbedder model not found — speaker IDs cannot be generated during transcription. Ensure the speakerkit-models resource is included in the app bundle.',

  // Settings: Permissions
  permissionsSection: 'Permissions',
  permissionsDesc: 'JournalClaw needs the following system permissions. Click "Check permissions" to view current status, or "Grant all" to authorize.',
  checkPermissions: 'Check permissions',
  rechecking: 'Re-check',
  checking: 'Checking…',
  grantAll: 'Grant all',
  allGranted: 'All permissions granted',
  clickToCheck: 'Click "Check permissions" to view authorization status',
  permMic: 'Microphone',
  permMicDesc: 'Required for recording — used for voice transcription and meeting capture.',
  permSpeech: 'Speech recognition',
  permSpeechDesc: 'Required when using Apple speech recognition engine (not needed for DashScope / WhisperKit).',
  permClaude: 'Claude CLI',
  permClaudeDesc: 'AI journal processing requires the Claude CLI to be installed.',
  installClaude: 'Please install Claude CLI:',
  statusGranted: 'Granted',
  statusDenied: 'Denied',
  statusRestricted: 'Restricted',
  statusNotDetermined: 'Not granted',
  statusUnknown: 'Unknown',
  requestPermission: 'Request access',
  openSystemSettings: 'Open System Settings',
  failedToOpen: 'Could not open System Settings: {err}',
  requestFailed: 'Request failed: {err}',
  authError: 'Authorization error: {err}',

  // Settings: Speakers
  speakersSection: 'Speaker Profiles',
  speakersDesc: 'Speakers are automatically identified after recording. Name them here — AI will use your names when organizing notes.',
  noSpeakers: 'No speakers detected yet',
  noSpeakersHint: 'Complete a recording and the system will automatically detect speakers here',
  speakerCount: 'Speaker profiles ({count})',
  unnamed: 'Unnamed',
  appearsIn: 'Appears in {count} recording(s)',
  nameTooltip: 'Rename',
  mergeTooltip: 'Merge to…',
  deleteTooltip: 'Delete',
  confirmDelete: 'Confirm delete',
  mergeVoice: 'Merge voice',
  mergeVoiceDesc: 'Merge {name} into another speaker. The source profile will be deleted after merging.',
  noOtherSpeakers: 'No other speaker profiles available to merge.',
  selectTargetSpeaker: 'Select target speaker…',
  merge: 'Merge',

  // Settings: Plugins
  pluginsSection: 'Plugins',
  pluginMarketSoon: 'Plugin marketplace coming soon',
  morePlugins: 'More plugins',

  // Settings: About
  version: 'Version {version}',
  addWeChat: 'Add on WeChat',
  wechatQr: 'WeChat QR',
  whisperCredit: 'Includes WhisperKit (MIT License) by Argmax, Inc. — on-device speech recognition engine',

  // App (AI config warning)
  aiNotConfigured: 'AI engine not configured',
  goToSettings: 'Go to Settings →',

  // App (identity assistant name)
  assistantName: 'Assistant',
  assistantDesc: 'Define how JournalClaw organizes and understands your notes',

  // DetailPanel context menu + code block
  addToTodo: 'Add to Ideas',

  // IdentityDetail / SoulView editing
  search: 'Search…',
  replaceBtn: 'Replace',
  replaceAll: 'Replace all',
  replacePlaceholder: 'Replace with…',
  reset: 'Reset',
  edit: 'Edit',
  resetAssistantTitle: 'Reset Assistant',
  confirmResetAssistant: 'Reset to default assistant settings? Current custom content will be overwritten.',

  // App confirm dialog
  confirmDeleteIdentity: 'Delete "{name}"\'s profile?',
  recordingConverting: 'Recording',

  // SectionVoice: model hints
  baseModelHint: 'Default model, stable transcription for daily notes',
  smallModelHint: 'Better accuracy, great for meeting notes',
  largeModelHint: 'Best accuracy, slower initial download',

  // SectionVoice: dynamic messages
  downloadingModel: 'Downloading {model} model…',
  downloadSuccess: '{model} downloaded, available offline',
  downloadErrorFallback: 'Download failed, check network and retry',
  downloadConflict: 'Downloading {model}, please wait',
  installError: 'Error: {err}',

  // SectionVoice: engine labels + vendors
  appleEngineLabel: 'Apple Voice',
  appleVendorSpeechAnalyzer: 'Built-in · SpeechAnalyzer',
  appleVendorDefault: 'Built-in · Zero config',
  whisperkitVendor: 'Argmax · On-device',
  dashscopeVendor: 'Alibaba Cloud · Remote',

  // SectionAiEngine
  qwenVendor: 'Alibaba Cloud',

  // SectionPlugins
  pluginScheduledSort: 'Scheduled file organization',
  pluginScheduledSortDesc: 'Auto-archive materials and logs in Workspace by rules, keeping directories tidy',
  pluginVisualizer: 'Visual card generator',
  pluginVisualizerDesc: 'Convert journal entries into visually rich cards for easy sharing',

  // Settings: Automation
  automation: 'Auto Maintenance',
  autoLintTitle: 'Auto journal maintenance',
  autoLintDesc: 'Scan entries, fix references, annotate changes, update profiles',
  frequency: 'Frequency',
  freqDaily: 'Daily',
  freqWeekly: 'Weekly',
  freqMonthly: 'Monthly',
  execTime: 'Run time',
  minEntries: 'Min new entries',
  skipIfInsufficient: 'skip if insufficient',
  lastRun: 'Last run',
  nextCheck: 'Next check',
  currentNew: 'current new',
  runNow: 'Run now',
  lintRunning: 'Running…',
  neverRun: 'Never run',
  lintFailed: 'Last run failed',
  entries: 'entries',
  organized: 'organized',

  // Settings: IM bridge
  im: 'IM',
  // Settings: Feishu bridge
  feishu: 'Feishu',
  feishuTitle: 'Feishu IM Bridge',
  feishuDesc: 'Receive messages from Feishu and process them as journal materials',
  feishuEnable: 'Enable Feishu bridge',
  feishuAppId: 'App ID',
  feishuAppSecret: 'App Secret',
  feishuAppIdPlaceholder: 'cli_xxxxxxxxxxxxxxxx',
  feishuAppSecretPlaceholder: 'App secret from Feishu Open Platform',
  feishuStatus: 'Status',
  feishuStatusIdle: 'Disabled',
  feishuStatusConnecting: 'Connecting…',
  feishuStatusConnected: 'Connected',
  feishuStatusError: 'Error',
  feishuSave: 'Save',
  feishuPermsTitle: 'Required permissions',
  feishuPermMsg: 'Receive messages via WebSocket',
  feishuPermSend: 'Send replies as bot',
  feishuPermRead: 'Read message history',
  feishuPermDrive: 'Export Feishu documents',
}

export type Strings = typeof en
