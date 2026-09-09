// Electron preload - 暴露安全的 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron')
const IPC = require('./ipc-constants.cjs')

// 防御性加载守卫：常量缺失时立即失败，避免静默失效
if (!IPC.notes.save || !IPC.ai.chat) {
  throw new Error('IPC constants missing: ipc-constants.cjs not loaded correctly')
}

// 参数清洗：Vue 响应式 ref/reactive 会返回 Proxy，structuredClone 无法克隆
// 所有传参先转成纯数据。
const plain = (value) => {
  try { return JSON.parse(JSON.stringify(value)) }
  catch { return value }
}

// 事件订阅治理：每个通道只保留一个"自己"的已注册监听器。
// 注册的时候先移除自己上一次的监听器，避免两次 on 累积（防重复挂载/HMR 泄漏），
// 同时不再用全局 removeAllListeners，从而不误清同通道由其他来源注册的监听器。
// 返回解绑函数，调用方可按需清理。
const _ownedSubs = new Map()
function sub(chan, handler) {
  const owned = (_, ...args) => handler(...args)
  if (_ownedSubs.has(chan)) ipcRenderer.removeListener(chan, _ownedSubs.get(chan))
  _ownedSubs.set(chan, owned)
  ipcRenderer.on(chan, owned)
  return () => {
    if (_ownedSubs.get(chan) === owned) _ownedSubs.delete(chan)
    ipcRenderer.removeListener(chan, owned)
  }
}

contextBridge.exposeInMainWorld('noteAPI', {
  // 悬浮球：显示主窗口 / 退出应用 / 展开收起面板
  showMainWindow: () => ipcRenderer.invoke(IPC.app.showMain),
  quitApp: () => ipcRenderer.invoke(IPC.app.quit),
  getAppVersion: () => ipcRenderer.invoke(IPC.app.getVersion),
  expandBubble: (height) => ipcRenderer.invoke(IPC.bubble.expand, plain(height)),
  collapseBubble: () => ipcRenderer.invoke(IPC.bubble.collapse),
  // ── 悬浮球菜单（bubble.html 实际调用名，转发到上面通道）──
  bubbleExpand: (open, height) => open
    ? ipcRenderer.invoke(IPC.bubble.expand, height)
    : ipcRenderer.invoke(IPC.bubble.collapse),
  bubbleCollapse: () => ipcRenderer.invoke(IPC.bubble.collapse),
  bubbleAction: (act) => ipcRenderer.invoke(IPC.bubble.action, plain(act)),
  bubbleDragStart: () => ipcRenderer.invoke(IPC.bubble.dragStart),
  bubbleDragMove: (pos) => ipcRenderer.invoke(IPC.bubble.dragMove, plain(pos)),
  onBubbleState: (callback) => sub(IPC.EV.bubbleState, (state) => callback(state || {})),
  // ── 录屏选窗（bubble-picker.html 专用）──
  pickerGetSources: () => ipcRenderer.invoke(IPC.rec.getDisplaySources),
  pickerSelect: (payload) => ipcRenderer.send(IPC.rec.pickResult, plain(payload)),
  // 笔记 CRUD
  getNotes: () => ipcRenderer.invoke(IPC.notes.getAll),
  getNote: (id) => ipcRenderer.invoke(IPC.notes.get, plain(id)),
  saveNote: (note) => ipcRenderer.invoke(IPC.notes.save, plain(note)),
  deleteNote: (id) => ipcRenderer.invoke(IPC.notes.delete, plain(id)),
  getDeletedNotes: () => ipcRenderer.invoke(IPC.notes.getDeleted),
  restoreNote: (id) => ipcRenderer.invoke(IPC.notes.restore, plain(id)),
  purgeNote: (id) => ipcRenderer.invoke(IPC.notes.purge, plain(id)),

  // 课程 CRUD
  getCourses: () => ipcRenderer.invoke(IPC.courses.getAll),
  saveCourse: (course) => ipcRenderer.invoke(IPC.courses.save, plain(course)),
  deleteCourse: (id) => ipcRenderer.invoke(IPC.courses.delete, plain(id)),

  // 对话
  getChatSessions: () => ipcRenderer.invoke(IPC.chat.getSessions),
  saveChatSession: (session) => ipcRenderer.invoke(IPC.chat.saveSession, plain(session)),
  deleteChatSession: (id) => ipcRenderer.invoke(IPC.chat.deleteSession, plain(id)),

  // 统计
  getStats: () => ipcRenderer.invoke(IPC.stats.get),
  addStudyTime: (minutes) => ipcRenderer.invoke(IPC.stats.addStudyTime, plain(minutes)),
  setPlan: (dailyMinutes) => ipcRenderer.invoke(IPC.stats.setPlan, plain(dailyMinutes)),

  // 文件导入
  importFiles: () => ipcRenderer.invoke(IPC.files.import),
  selectImage: () => ipcRenderer.invoke(IPC.files.selectImage),
  readClipboardImage: () => ipcRenderer.invoke(IPC.files.readClipboardImage),
  // 图片外置存储：base64 落盘，返回相对引用路径 images/xxx.png
  saveImage: (dataUri) => {
    // 诊断日志：确认渲染进程侧传入的 dataUri 是否完整（排查大字符串 IPC 截断）
    try {
      ipcRenderer.invoke(IPC.log.write, 'INFO', 'Preload', 'saveImage arg', JSON.stringify({ len: typeof dataUri === 'string' ? dataUri.length : -1, head: typeof dataUri === 'string' ? dataUri.slice(0, 60) : String(dataUri) }))
    } catch (e) { /* ignore */ }
    return ipcRenderer.invoke(IPC.images.save, plain(dataUri))
  },
  // 实时屏幕截图：列出屏幕/窗口 + 截取画面
  listScreenSources: () => ipcRenderer.invoke(IPC.screen.listSources),
  captureScreen: (opts) => ipcRenderer.invoke(IPC.screen.capture, plain(opts)),
  // 跟拍期间的快截截图（代理窗口 canvas drawImage 截当前解码帧，比 getSources+thumbnail 快 5~10 倍）
  // 代理未开或失败 → 自动兜底老链路，调用方无需自己处理降级
  fastCaptureScreen: (opts) => ipcRenderer.invoke(IPC.screen.fastCapture, plain(opts || {})),
  // 笔记导出（Markdown/HTML）：单篇或整课
  exportNotes: (opts) => ipcRenderer.invoke(IPC.files.exportNotes, plain(opts)),
  // 一键备份 / 备份信息
  backupData: () => ipcRenderer.invoke(IPC.data.backup),
  getBackupInfo: () => ipcRenderer.invoke(IPC.data.backupInfo),
  // 联网搜索（AI 助手兜底）：用系统浏览器打开搜索引擎
  openSearch: (keywords) => ipcRenderer.invoke(IPC.shell.openSearch, keywords),
  // 打开外部链接（联网来源点击）
  openUrl: (url) => ipcRenderer.invoke(IPC.shell.openUrl, url),
  // 联网搜索（AI 联网总结）：返回结构化结果 [{title, snippet, url}]，DDG 优先 + Bing 兜底
  searchWeb: (query) => ipcRenderer.invoke(IPC.search.web, query),
  // 联网参考图搜索（AI 回答配图）：Bing 图片，返回 [{localPath, directUrl, sourceUrl}]
  searchWebImages: (query) => ipcRenderer.invoke(IPC.search.webImages, query),
  // AI 生图（免费 Pollinations，无需密钥）：返回图片直链 URL
  generateImage: (prompt) => ipcRenderer.invoke(IPC.ai.generateImage, prompt),

  // 本地音频转写 (Whisper)
  // 注意：不能经 plain() 序列化——ArrayBuffer 会被 JSON.stringify 变成 {}，导致转写永远失败。
  // ArrayBuffer 本身支持 structuredClone，直接传即可。
  transcribeAudio: (audioData) => ipcRenderer.invoke(IPC.audio.transcribe, audioData),
  // 语音转文字独立窗口
  openVoiceWindow: () => ipcRenderer.invoke(IPC.voice.open),
  closeVoiceWindow: () => ipcRenderer.invoke(IPC.voice.close),

  // AI 接口（支持流式）
  generateNote: (rawText) => ipcRenderer.invoke(IPC.ai.generateNote, plain(rawText)),
  chatWithAI: (question, noteContext, history, mode) => ipcRenderer.invoke(IPC.ai.chat, plain(question), plain(noteContext), plain(history), plain(mode || 'qa')),
  summarizeNote: (noteContent) => ipcRenderer.invoke(IPC.ai.summarize, plain(noteContent)),
  weeklyReport: (data) => ipcRenderer.invoke(IPC.ai.weeklyReport, plain(data)),
  analyzeNote: (noteContent, includeImages = true, noteId = '', force = false) => ipcRenderer.invoke(IPC.ai.analyzeNote, plain(noteContent), plain(includeImages), plain(noteId), plain(force)),
  getAnalysisCache: (noteId, contents) => ipcRenderer.invoke(IPC.analysis.get, plain(noteId), plain(contents)),
  expandNote: (noteContent, includeImages = true) => ipcRenderer.invoke(IPC.ai.expandNote, plain(noteContent), plain(includeImages)),
  extractHierarchy: (payload) => ipcRenderer.invoke(IPC.ai.extractHierarchy, plain(payload || {})),

  // AI 流式监听（注册前先清理旧监听器，避免重复注册导致文本重复）
  onGenerateNoteChunk: (callback) => sub(IPC.EV.generateNoteChunk, (chunk) => callback(chunk)),
  onChatChunk: (callback) => sub(IPC.EV.chatChunk, (chunk) => callback(chunk)),

  // 数据管理
  exportData: () => ipcRenderer.invoke(IPC.data.export),
  // 导出任意文本（AI 对话导出 Markdown）
  exportText: (filename, content) => ipcRenderer.invoke(IPC.data.exportText, { filename, content }),
  importData: () => ipcRenderer.invoke(IPC.data.import),
  clearData: (type) => ipcRenderer.invoke(IPC.data.clear, plain(type)),

  // 知识点复习（题库 + 错题本）
  quizSaveSessions: (sessions) => ipcRenderer.invoke(IPC.quiz.saveSessions, plain(sessions)),
  quizGetSessions: () => ipcRenderer.invoke(IPC.quiz.getSessions),
  quizSaveMistakes: (mistakes) => ipcRenderer.invoke(IPC.quiz.saveMistakes, plain(mistakes)),
  quizGetMistakes: () => ipcRenderer.invoke(IPC.quiz.getMistakes),
  quizGenerate: (opts) => ipcRenderer.invoke(IPC.quiz.generate, plain(opts)),
  quizSaveMastery: (mastery) => ipcRenderer.invoke(IPC.quiz.saveMastery, plain(mastery)),
  quizGetMastery: () => ipcRenderer.invoke(IPC.quiz.getMastery),
  quizExportHtml: (opts) => ipcRenderer.invoke(IPC.quiz.exportHtml, plain(opts)),

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC.settings.get),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.settings.save, plain(settings)),

  // AI 连通性测试 + 获取模型列表
  testConnection: (config) => ipcRenderer.invoke(IPC.ai.testConnection, plain(config)),

  // 日志系统
  logWrite: (level, source, message, data) => ipcRenderer.invoke(IPC.log.write, plain(level), plain(source), plain(message), plain(data)),
  logGetFiles: () => ipcRenderer.invoke(IPC.log.getFiles),
  logRead: (fileName) => ipcRenderer.invoke(IPC.log.read, plain(fileName)),
  logClear: (fileName) => ipcRenderer.invoke(IPC.log.clear, plain(fileName)),
  logSetLevel: (level) => ipcRenderer.invoke(IPC.log.setLevel, plain(level)),
  logOpenDir: () => ipcRenderer.invoke(IPC.log.openDir),
  onLogEntry: (callback) => sub(IPC.EV.logEntry, (entry) => callback(entry)),
  // 出题通道通知（如云端超时自动回退本地）
  onQuizProviderNotice: (callback) => sub(IPC.EV.quizProviderNotice, (payload) => callback(payload || {})),
  // 跟拍模式（视频帧智能笔记 + 录屏）
  followAiDescribe: (imageDataUri) => ipcRenderer.invoke(IPC.follow.aiDescribe, plain(imageDataUri)),
  followAppendEntry: (payload) => ipcRenderer.invoke(IPC.follow.appendEntry, plain(payload)),
  followListVisionModels: () => ipcRenderer.invoke(IPC.follow.listVisionModels),
  pullOllamaModel: (model) => ipcRenderer.invoke(IPC.follow.pullModel, plain(model)),
  recSaveSegment: (payload) => ipcRenderer.invoke(IPC.rec.saveSegment, payload), // buffer 不序列化（structuredClone）
  recFinishSession: (payload) => ipcRenderer.invoke(IPC.rec.finishSession, plain(payload)),
  recListSessions: () => ipcRenderer.invoke(IPC.rec.listSessions),
  recGetUsage: () => ipcRenderer.invoke(IPC.rec.getUsage),
  recDeleteSession: (sessionId) => ipcRenderer.invoke(IPC.rec.deleteSession, plain(sessionId)),
  recDeleteAll: () => ipcRenderer.invoke(IPC.rec.deleteAll),
  recOpenDir: () => ipcRenderer.invoke(IPC.rec.openDir),
  recPickDisplaySource: () => ipcRenderer.invoke(IPC.rec.pickDisplaySource),
  recStartProxyRecording: (sessionId) => ipcRenderer.invoke(IPC.rec.startProxyRecording, sessionId),
  recStopProxyRecording: () => ipcRenderer.invoke(IPC.rec.stopProxyRecording),
  // Day 3 P1-V4：清理 N 天前的录屏会话；占用阈值告警（Settings 配置）
  recCleanupBefore: (days) => ipcRenderer.invoke(IPC.rec.cleanupBefore, plain(days)),
  // Day 3 P0-V2：display-media 自定义选择器通道（拦截 Chromium 原生"选择要共享的窗口"弹窗）
  displayMediaReply: (payload) => ipcRenderer.invoke(IPC.displayMedia.reply, plain(payload)),
  onDisplayMediaRequest: (callback) => sub(IPC.EV.displayMediaRequest, (payload) => callback(payload || {})),
  // Day 3 P1-V4：录屏占用超阈值时，主进程主动推送到前端 → Settings / Dashboard Toast
  onRecOverQuota: (callback) => sub(IPC.EV.recOverQuota, (payload) => callback(payload || {})),
  // 笔记向量化（跨课程知识网络）
  embedNote: (note) => ipcRenderer.invoke(IPC.embed.one, plain(note)),
  deleteEmbed: (noteId) => ipcRenderer.invoke(IPC.embed.delete, plain(noteId)),
  batchEmbed: (opts) => ipcRenderer.invoke(IPC.embed.batch, plain(opts || {})),
  embedSearch: (params) => ipcRenderer.invoke(IPC.embed.search, plain(params || {})),
  embedStatus: () => ipcRenderer.invoke(IPC.embed.status),
  // 数据变更事件（快捷键/悬浮球后台创建笔记后通知刷新）
  onNotesChanged: (callback) => sub(IPC.EV.notesChanged, () => callback()),
  // 本地 TTS 朗读（返回 wav dataURI，完全离线）
  ttsSpeak: (text) => ipcRenderer.invoke(IPC.tts.speak, plain(text)),
  // 生成笔记复习音频包（全文分段合成 → 拼接 wav dataURI）
  noteAudio: (noteId) => ipcRenderer.invoke(IPC.tts.noteAudio, plain(noteId)),
  // 主进程导航事件（复习提醒点击跳转等）
  onNavigate: (callback) => sub(IPC.EV.navigate, (path) => callback(path)),
  // 悬浮球创建新笔记（跟拍/语音等）后，通知主窗口跳转到该笔记并显示编辑页
  openInMain: (noteId) => ipcRenderer.invoke(IPC.notes.openInMain, plain(noteId)),
  onNotesOpen: (callback) => sub(IPC.EV.notesOpen, (noteId) => callback(noteId)),

  // ── 自动更新 ──
  updateCheck: () => ipcRenderer.invoke(IPC.update.check),
  updateDownload: () => ipcRenderer.invoke(IPC.update.download),
  updateInstall: () => ipcRenderer.invoke(IPC.update.install),
  updateGetStatus: () => ipcRenderer.invoke(IPC.update.getStatus),
  onUpdateStatus: (callback) => sub(IPC.EV.updateStatus, (status) => callback(status || {})),
})