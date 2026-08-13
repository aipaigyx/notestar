// Electron preload - 暴露安全的 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('noteAPI', {
  // 悬浮球：显示主窗口 / 退出应用 / 展开收起面板
  showMainWindow: () => ipcRenderer.invoke('app:showMain'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  expandBubble: () => ipcRenderer.invoke('bubble:expand'),
  collapseBubble: () => ipcRenderer.invoke('bubble:collapse'),
  // 笔记 CRUD
  getNotes: () => ipcRenderer.invoke('notes:getAll'),
  getNote: (id) => ipcRenderer.invoke('notes:get', id),
  saveNote: (note) => ipcRenderer.invoke('notes:save', note),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', id),
  getDeletedNotes: () => ipcRenderer.invoke('notes:getDeleted'),
  restoreNote: (id) => ipcRenderer.invoke('notes:restore', id),
  purgeNote: (id) => ipcRenderer.invoke('notes:purge', id),

  // 课程 CRUD
  getCourses: () => ipcRenderer.invoke('courses:getAll'),
  saveCourse: (course) => ipcRenderer.invoke('courses:save', course),
  deleteCourse: (id) => ipcRenderer.invoke('courses:delete', id),

  // 对话
  getChatSessions: () => ipcRenderer.invoke('chat:getSessions'),
  saveChatSession: (session) => ipcRenderer.invoke('chat:saveSession', session),
  deleteChatSession: (id) => ipcRenderer.invoke('chat:deleteSession', id),

  // 统计
  getStats: () => ipcRenderer.invoke('stats:get'),
  addStudyTime: (minutes) => ipcRenderer.invoke('stats:addStudyTime', minutes),
  setPlan: (dailyMinutes) => ipcRenderer.invoke('stats:setPlan', dailyMinutes),

  // 文件导入
  importFiles: () => ipcRenderer.invoke('files:import'),
  selectImage: () => ipcRenderer.invoke('files:selectImage'),
  readClipboardImage: () => ipcRenderer.invoke('files:readClipboardImage'),
  // 图片外置存储：base64 落盘，返回相对引用路径 images/xxx.png
  saveImage: (dataUri) => ipcRenderer.invoke('images:save', dataUri),
  // 实时屏幕截图：列出屏幕/窗口 + 截取画面
  listScreenSources: () => ipcRenderer.invoke('screen:listSources'),
  captureScreen: (opts) => ipcRenderer.invoke('screen:capture', opts),
  // 笔记导出（Markdown/HTML）：单篇或整课
  exportNotes: (opts) => ipcRenderer.invoke('files:exportNotes', opts),
  // 一键备份 / 备份信息
  backupData: () => ipcRenderer.invoke('data:backup'),
  getBackupInfo: () => ipcRenderer.invoke('data:backupInfo'),

  // 本地音频转写 (Whisper)
  transcribeAudio: (audioData) => ipcRenderer.invoke('audio:transcribe', audioData),

  // AI 接口（支持流式）
  generateNote: (rawText) => ipcRenderer.invoke('ai:generateNote', rawText),
  chatWithAI: (question, noteContext, history) => ipcRenderer.invoke('ai:chat', question, noteContext, history),
  summarizeNote: (noteContent) => ipcRenderer.invoke('ai:summarize', noteContent),
  analyzeNote: (noteContent, includeImages = true, noteId = '', force = false) => ipcRenderer.invoke('ai:analyzeNote', noteContent, includeImages, noteId, force),
  getAnalysisCache: (noteId, contents) => ipcRenderer.invoke('analysis:get', noteId, contents),
  expandNote: (noteContent, includeImages = true) => ipcRenderer.invoke('ai:expandNote', noteContent, includeImages),

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
  importData: () => ipcRenderer.invoke('data:import'),
  clearData: (type) => ipcRenderer.invoke('data:clear', type),

  // 知识点复习（题库 + 错题本）
  quizSaveSessions: (sessions) => ipcRenderer.invoke('quiz:saveSessions', sessions),
  quizGetSessions: () => ipcRenderer.invoke('quiz:getSessions'),
  quizSaveMistakes: (mistakes) => ipcRenderer.invoke('quiz:saveMistakes', mistakes),
  quizGetMistakes: () => ipcRenderer.invoke('quiz:getMistakes'),
  quizGenerate: (opts) => ipcRenderer.invoke('quiz:generate', opts),
  quizSaveMastery: (mastery) => ipcRenderer.invoke('quiz:saveMastery', mastery),
  quizGetMastery: () => ipcRenderer.invoke('quiz:getMastery'),
  quizExportHtml: (opts) => ipcRenderer.invoke('quiz:exportHtml', opts),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // AI 连通性测试 + 获取模型列表
  testConnection: (config) => ipcRenderer.invoke('ai:testConnection', config),

  // 日志系统
  logWrite: (level, source, message, data) => ipcRenderer.invoke('log:write', level, source, message, data),
  logGetFiles: () => ipcRenderer.invoke('log:getFiles'),
  logRead: (fileName) => ipcRenderer.invoke('log:read', fileName),
  logClear: (fileName) => ipcRenderer.invoke('log:clear', fileName),
  logSetLevel: (level) => ipcRenderer.invoke('log:setLevel', level),
  logOpenDir: () => ipcRenderer.invoke('log:openDir'),
  onLogEntry: (callback) => {
    ipcRenderer.removeAllListeners('log:entry')
    const listener = (_, entry) => callback(entry)
    ipcRenderer.on('log:entry', listener)
    return () => ipcRenderer.removeListener('log:entry', listener)
  },
})
