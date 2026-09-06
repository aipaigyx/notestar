// Electron preload - 暴露安全的 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron')

// 参数清洗：Vue 响应式 ref/reactive 会返回 Proxy，structuredClone 无法克隆
// （报错 "An object could not be cloned."）。所有传参先转成纯数据。
const plain = (value) => {
  try { return JSON.parse(JSON.stringify(value)) }
  catch { return value }
}

contextBridge.exposeInMainWorld('noteAPI', {
  // 悬浮球：显示主窗口 / 退出应用 / 展开收起面板
  showMainWindow: () => ipcRenderer.invoke('app:showMain'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  expandBubble: (height) => ipcRenderer.invoke('bubble:expand', plain(height)),
  collapseBubble: () => ipcRenderer.invoke('bubble:collapse'),
  // ── 悬浮球菜单（bubble.html 实际调用名，转发到上面通道）──
  bubbleExpand: (open, height) => open
    ? ipcRenderer.invoke('bubble:expand', height)
    : ipcRenderer.invoke('bubble:collapse'),
  bubbleCollapse: () => ipcRenderer.invoke('bubble:collapse'),
  bubbleAction: (act) => ipcRenderer.invoke('bubble:action', plain(act)),
  bubbleDragStart: () => ipcRenderer.invoke('bubble:dragStart'),
  bubbleDragMove: (pos) => ipcRenderer.invoke('bubble:dragMove', plain(pos)),
  onBubbleState: (callback) => {
    ipcRenderer.removeAllListeners('bubble:state')
    ipcRenderer.on('bubble:state', (_, state) => callback(state || {}))
  },
  // ── 录屏选窗（bubble-picker.html 专用）──
  pickerGetSources: () => ipcRenderer.invoke('rec:getDisplaySources'),
  pickerSelect: (payload) => ipcRenderer.send('rec:pickResult', plain(payload)),
  // 笔记 CRUD
  getNotes: () => ipcRenderer.invoke('notes:getAll'),
  getNote: (id) => ipcRenderer.invoke('notes:get', plain(id)),
  saveNote: (note) => ipcRenderer.invoke('notes:save', plain(note)),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', plain(id)),
  getDeletedNotes: () => ipcRenderer.invoke('notes:getDeleted'),
  restoreNote: (id) => ipcRenderer.invoke('notes:restore', plain(id)),
  purgeNote: (id) => ipcRenderer.invoke('notes:purge', plain(id)),

  // 课程 CRUD
  getCourses: () => ipcRenderer.invoke('courses:getAll'),
  saveCourse: (course) => ipcRenderer.invoke('courses:save', plain(course)),
  deleteCourse: (id) => ipcRenderer.invoke('courses:delete', plain(id)),

  // 对话
  getChatSessions: () => ipcRenderer.invoke('chat:getSessions'),
  saveChatSession: (session) => ipcRenderer.invoke('chat:saveSession', plain(session)),
  deleteChatSession: (id) => ipcRenderer.invoke('chat:deleteSession', plain(id)),

  // 统计
  getStats: () => ipcRenderer.invoke('stats:get'),
  addStudyTime: (minutes) => ipcRenderer.invoke('stats:addStudyTime', plain(minutes)),
  setPlan: (dailyMinutes) => ipcRenderer.invoke('stats:setPlan', plain(dailyMinutes)),

  // 文件导入
  importFiles: () => ipcRenderer.invoke('files:import'),
  selectImage: () => ipcRenderer.invoke('files:selectImage'),
  readClipboardImage: () => ipcRenderer.invoke('files:readClipboardImage'),
  // 图片外置存储：base64 落盘，返回相对引用路径 images/xxx.png
  saveImage: (dataUri) => {
    // 诊断日志：确认渲染进程侧传入的 dataUri 是否完整（排查大字符串 IPC 截断）
    try {
      ipcRenderer.invoke('log:write', 'INFO', 'Preload', 'saveImage arg', JSON.stringify({ len: typeof dataUri === 'string' ? dataUri.length : -1, head: typeof dataUri === 'string' ? dataUri.slice(0, 60) : String(dataUri) }))
    } catch (e) { /* ignore */ }
    return ipcRenderer.invoke('images:save', plain(dataUri))
  },
  // 实时屏幕截图：列出屏幕/窗口 + 截取画面
  listScreenSources: () => ipcRenderer.invoke('screen:listSources'),
  captureScreen: (opts) => ipcRenderer.invoke('screen:capture', plain(opts)),
  // 跟拍期间的快截截图（代理窗口 canvas drawImage 截当前解码帧，比 getSources+thumbnail 快 5~10 倍）
  // 代理未开或失败 → 自动兜底老链路，调用方无需自己处理降级
  fastCaptureScreen: (opts) => ipcRenderer.invoke('screen:fastCapture', plain(opts || {})),
  // 笔记导出（Markdown/HTML）：单篇或整课
  exportNotes: (opts) => ipcRenderer.invoke('files:exportNotes', plain(opts)),
  // 一键备份 / 备份信息
  backupData: () => ipcRenderer.invoke('data:backup'),
  getBackupInfo: () => ipcRenderer.invoke('data:backupInfo'),
  // 联网搜索（AI 助手兜底）：用系统浏览器打开搜索引擎
  openSearch: (keywords) => ipcRenderer.invoke('shell:openSearch', keywords),
  // 打开外部链接（联网来源点击）
  openUrl: (url) => ipcRenderer.invoke('shell:openUrl', url),
  // 联网搜索（AI 联网总结）：返回结构化结果 [{title, snippet, url}]，DDG 优先 + Bing 兜底
  searchWeb: (query) => ipcRenderer.invoke('search:web', query),
  // 联网参考图搜索（AI 回答配图）：Bing 图片，返回 [{localPath, directUrl, sourceUrl}]
  searchWebImages: (query) => ipcRenderer.invoke('search:webImages', query),
  // AI 生图（免费 Pollinations，无需密钥）：返回图片直链 URL
  generateImage: (prompt) => ipcRenderer.invoke('ai:generateImage', prompt),

  // 本地音频转写 (Whisper)
  // 注意：不能经 plain() 序列化——ArrayBuffer 会被 JSON.stringify 变成 {}，导致转写永远失败。
  // ArrayBuffer 本身支持 structuredClone，直接传即可。
  transcribeAudio: (audioData) => ipcRenderer.invoke('audio:transcribe', audioData),
  // 语音转文字独立窗口
  openVoiceWindow: () => ipcRenderer.invoke('voice:open'),
  closeVoiceWindow: () => ipcRenderer.invoke('voice:close'),

  // AI 接口（支持流式）
  generateNote: (rawText) => ipcRenderer.invoke('ai:generateNote', plain(rawText)),
  chatWithAI: (question, noteContext, history, mode) => ipcRenderer.invoke('ai:chat', plain(question), plain(noteContext), plain(history), plain(mode || 'qa')),
  summarizeNote: (noteContent) => ipcRenderer.invoke('ai:summarize', plain(noteContent)),
  weeklyReport: (data) => ipcRenderer.invoke('ai:weeklyReport', plain(data)),
  analyzeNote: (noteContent, includeImages = true, noteId = '', force = false) => ipcRenderer.invoke('ai:analyzeNote', plain(noteContent), plain(includeImages), plain(noteId), plain(force)),
  getAnalysisCache: (noteId, contents) => ipcRenderer.invoke('analysis:get', plain(noteId), plain(contents)),
  expandNote: (noteContent, includeImages = true) => ipcRenderer.invoke('ai:expandNote', plain(noteContent), plain(includeImages)),
  extractHierarchy: (payload) => ipcRenderer.invoke('ai:extractHierarchy', plain(payload || {})),

  // AI 流式监听（注册前先清理旧监听器，避免重复注册导致文本重复）
  onGenerateNoteChunk: (callback) => {
    ipcRenderer.removeAllListeners('ai:generateNote:chunk')
    ipcRenderer.on('ai:generateNote:chunk', (_, chunk) => callback(chunk))
  },
  onChatChunk: (callback) => {
    ipcRenderer.removeAllListeners('ai:chat:chunk')
    ipcRenderer.on('ai:chat:chunk', (_, chunk) => callback(chunk))
  },

  // 数据管理
  exportData: () => ipcRenderer.invoke('data:export'),
  // 导出任意文本（AI 对话导出 Markdown）
  exportText: (filename, content) => ipcRenderer.invoke('data:exportText', { filename, content }),
  importData: () => ipcRenderer.invoke('data:import'),
  clearData: (type) => ipcRenderer.invoke('data:clear', plain(type)),

  // 知识点复习（题库 + 错题本）
  quizSaveSessions: (sessions) => ipcRenderer.invoke('quiz:saveSessions', plain(sessions)),
  quizGetSessions: () => ipcRenderer.invoke('quiz:getSessions'),
  quizSaveMistakes: (mistakes) => ipcRenderer.invoke('quiz:saveMistakes', plain(mistakes)),
  quizGetMistakes: () => ipcRenderer.invoke('quiz:getMistakes'),
  quizGenerate: (opts) => ipcRenderer.invoke('quiz:generate', plain(opts)),
  quizSaveMastery: (mastery) => ipcRenderer.invoke('quiz:saveMastery', plain(mastery)),
  quizGetMastery: () => ipcRenderer.invoke('quiz:getMastery'),
  quizExportHtml: (opts) => ipcRenderer.invoke('quiz:exportHtml', plain(opts)),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', plain(settings)),

  // AI 连通性测试 + 获取模型列表
  testConnection: (config) => ipcRenderer.invoke('ai:testConnection', plain(config)),

  // 日志系统
  logWrite: (level, source, message, data) => ipcRenderer.invoke('log:write', plain(level), plain(source), plain(message), plain(data)),
  logGetFiles: () => ipcRenderer.invoke('log:getFiles'),
  logRead: (fileName) => ipcRenderer.invoke('log:read', plain(fileName)),
  logClear: (fileName) => ipcRenderer.invoke('log:clear', plain(fileName)),
  logSetLevel: (level) => ipcRenderer.invoke('log:setLevel', plain(level)),
  logOpenDir: () => ipcRenderer.invoke('log:openDir'),
  onLogEntry: (callback) => {
    ipcRenderer.removeAllListeners('log:entry')
    const listener = (_, entry) => callback(entry)
    ipcRenderer.on('log:entry', listener)
    return () => ipcRenderer.removeListener('log:entry', listener)
  },
  // 出题通道通知（如云端超时自动回退本地）
  onQuizProviderNotice: (callback) => {
    ipcRenderer.removeAllListeners('quiz:providerNotice')
    const listener = (_, payload) => callback(payload || {})
    ipcRenderer.on('quiz:providerNotice', listener)
    return () => ipcRenderer.removeListener('quiz:providerNotice', listener)
  },
  // 跟拍模式（视频帧智能笔记 + 录屏）
  followAiDescribe: (imageDataUri) => ipcRenderer.invoke('follow:aiDescribe', plain(imageDataUri)),
  followAppendEntry: (payload) => ipcRenderer.invoke('follow:appendEntry', plain(payload)),
  followListVisionModels: () => ipcRenderer.invoke('follow:listVisionModels'),
  pullOllamaModel: (model) => ipcRenderer.invoke('follow:pullModel', plain(model)),
  recSaveSegment: (payload) => ipcRenderer.invoke('rec:saveSegment', payload), // buffer 不序列化（structuredClone）
  recFinishSession: (payload) => ipcRenderer.invoke('rec:finishSession', plain(payload)),
  recListSessions: () => ipcRenderer.invoke('rec:listSessions'),
  recGetUsage: () => ipcRenderer.invoke('rec:getUsage'),
  recDeleteSession: (sessionId) => ipcRenderer.invoke('rec:deleteSession', plain(sessionId)),
  recDeleteAll: () => ipcRenderer.invoke('rec:deleteAll'),
  recOpenDir: () => ipcRenderer.invoke('rec:openDir'),
  recPickDisplaySource: () => ipcRenderer.invoke('rec:pickDisplaySource'),
  recStartProxyRecording: (sessionId) => ipcRenderer.invoke('rec:startProxyRecording', sessionId),
  recStopProxyRecording: () => ipcRenderer.invoke('rec:stopProxyRecording'),
  // Day 3 P1-V4：清理 N 天前的录屏会话；占用阈值告警（Settings 配置）
  recCleanupBefore: (days) => ipcRenderer.invoke('rec:cleanupBefore', plain(days)),
  // Day 3 P0-V2：display-media 自定义选择器通道（拦截 Chromium 原生"选择要共享的窗口"弹窗）
  displayMediaReply: (payload) => ipcRenderer.invoke('display-media:reply', plain(payload)),
  onDisplayMediaRequest: (callback) => {
    ipcRenderer.removeAllListeners('display-media:request')
    const listener = (_, payload) => callback(payload || {})
    ipcRenderer.on('display-media:request', listener)
    return () => ipcRenderer.removeListener('display-media:request', listener)
  },
  // Day 3 P1-V4：录屏占用超阈值时，主进程主动推送到前端 → Settings / Dashboard Toast
  onRecOverQuota: (callback) => {
    ipcRenderer.removeAllListeners('rec:overQuota')
    const listener = (_, payload) => callback(payload || {})
    ipcRenderer.on('rec:overQuota', listener)
    return () => ipcRenderer.removeListener('rec:overQuota', listener)
  },
  // 笔记向量化（跨课程知识网络）
  embedNote: (note) => ipcRenderer.invoke('embed:one', plain(note)),
  deleteEmbed: (noteId) => ipcRenderer.invoke('embed:delete', plain(noteId)),
  batchEmbed: (opts) => ipcRenderer.invoke('embed:batch', plain(opts || {})),
  embedSearch: (params) => ipcRenderer.invoke('embed:search', plain(params || {})),
  embedStatus: () => ipcRenderer.invoke('embed:status'),
  // 数据变更事件（快捷键/悬浮球后台创建笔记后通知刷新）
  onNotesChanged: (callback) => {
    ipcRenderer.removeAllListeners('notes:changed')
    ipcRenderer.on('notes:changed', () => callback())
  },
  // 本地 TTS 朗读（返回 wav dataURI，完全离线）
  ttsSpeak: (text) => ipcRenderer.invoke('tts:speak', plain(text)),
  // 生成笔记复习音频包（全文分段合成 → 拼接 wav dataURI）
  noteAudio: (noteId) => ipcRenderer.invoke('tts:noteAudio', plain(noteId)),
  // 主进程导航事件（复习提醒点击跳转等）
  onNavigate: (callback) => {
    ipcRenderer.removeAllListeners('navigate')
    ipcRenderer.on('navigate', (_, path) => callback(path))
  },
  // 悬浮球创建新笔记（跟拍/语音等）后，通知主窗口跳转到该笔记并显示编辑页
  openInMain: (noteId) => ipcRenderer.invoke('notes:openInMain', plain(noteId)),
  onNotesOpen: (callback) => {
    ipcRenderer.removeAllListeners('notes:open')
    const listener = (_, noteId) => callback(noteId)
    ipcRenderer.on('notes:open', listener)
    return () => ipcRenderer.removeListener('notes:open', listener)
  },

  // ── 自动更新 ──
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateGetStatus: () => ipcRenderer.invoke('update:getStatus'),
  onUpdateStatus: (callback) => {
    ipcRenderer.removeAllListeners('update:status')
    const listener = (_, status) => callback(status || {})
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  },
})
