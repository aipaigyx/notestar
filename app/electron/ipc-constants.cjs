// Electron IPC 通道常量 —— 唯一事实来源
// 仅由 main.cjs / preload.js / auto-updater.cjs（同一 electron/ 目录的 CJS）共享引用。
// 渲染进程不写通道字符串，只调用 window.noteAPI.*（其类型见 src/note-api.d.ts）。
// 值严格取自各 .cjs 源码，字节一致；本阶段不改名任何通道。

const IPC = {
  // ── 应用 / 窗口 ──
  app: {
    showMain: 'app:showMain',
    quit: 'app:quit',
    getVersion: 'app:getVersion',
  },

  // ── 悬浮球 ──
  bubble: {
    expand: 'bubble:expand',
    collapse: 'bubble:collapse',
    action: 'bubble:action',
    dragStart: 'bubble:dragStart',
    dragMove: 'bubble:dragMove',
  },

  // ── 笔记 ──
  notes: {
    getAll: 'notes:getAll',
    get: 'notes:get',
    save: 'notes:save',
    delete: 'notes:delete',
    getDeleted: 'notes:getDeleted',
    restore: 'notes:restore',
    purge: 'notes:purge',
    openInMain: 'notes:openInMain',
  },

  // ── 课程 ──
  courses: {
    getAll: 'courses:getAll',
    save: 'courses:save',
    delete: 'courses:delete',
  },

  // ── AI 对话会话 ──
  chat: {
    getSessions: 'chat:getSessions',
    saveSession: 'chat:saveSession',
    deleteSession: 'chat:deleteSession',
  },

  // ── 学习统计 ──
  stats: {
    get: 'stats:get',
    addStudyTime: 'stats:addStudyTime',
    setPlan: 'stats:setPlan',
  },

  // ── 文件 / 图片 ──
  files: {
    import: 'files:import',
    selectImage: 'files:selectImage',
    readClipboardImage: 'files:readClipboardImage',
    exportNotes: 'files:exportNotes',
  },
  images: {
    save: 'images:save',
  },

  // ── 屏幕截图 ──
  screen: {
    listSources: 'screen:listSources',
    capture: 'screen:capture',
    fastCapture: 'screen:fastCapture',
  },

  // ── 数据管理 / 备份 ──
  data: {
    backup: 'data:backup',
    backupInfo: 'data:backupInfo',
    export: 'data:export',
    exportText: 'data:exportText',
    import: 'data:import',
    clear: 'data:clear',
  },

  // ── 系统外壳 / 联网 ──
  shell: {
    openSearch: 'shell:openSearch',
    openUrl: 'shell:openUrl',
  },
  search: {
    web: 'search:web',
    webImages: 'search:webImages',
  },

  // ── AI ──
  ai: {
    generateNote: 'ai:generateNote',
    chat: 'ai:chat',
    summarize: 'ai:summarize',
    weeklyReport: 'ai:weeklyReport',
    analyzeNote: 'ai:analyzeNote',
    expandNote: 'ai:expandNote',
    extractHierarchy: 'ai:extractHierarchy',
    generateImage: 'ai:generateImage',
    testConnection: 'ai:testConnection',
  },
  analysis: {
    get: 'analysis:get',
  },

  // ── 语音转写 / 独立窗口 ──
  audio: {
    transcribe: 'audio:transcribe',
  },
  voice: {
    open: 'voice:open',
    close: 'voice:close',
  },

  // ── 出题 / 复习 ──
  quiz: {
    saveSessions: 'quiz:saveSessions',
    getSessions: 'quiz:getSessions',
    saveMistakes: 'quiz:saveMistakes',
    getMistakes: 'quiz:getMistakes',
    generate: 'quiz:generate',
    saveMastery: 'quiz:saveMastery',
    getMastery: 'quiz:getMastery',
    exportHtml: 'quiz:exportHtml',
  },

  // ── 设置 ──
  settings: {
    get: 'settings:get',
    save: 'settings:save',
  },

  // ── 日志 ──
  log: {
    write: 'log:write',
    getFiles: 'log:getFiles',
    read: 'log:read',
    clear: 'log:clear',
    setLevel: 'log:setLevel',
    openDir: 'log:openDir',
  },

  // ── 跟拍（AI 视觉笔记）──
  follow: {
    aiDescribe: 'follow:aiDescribe',
    appendEntry: 'follow:appendEntry',
    listVisionModels: 'follow:listVisionModels',
    pullModel: 'follow:pullModel',
  },

  // ── 录屏 ──
  rec: {
    saveSegment: 'rec:saveSegment',
    finishSession: 'rec:finishSession',
    listSessions: 'rec:listSessions',
    getUsage: 'rec:getUsage',
    deleteSession: 'rec:deleteSession',
    deleteAll: 'rec:deleteAll',
    openDir: 'rec:openDir',
    pickDisplaySource: 'rec:pickDisplaySource',
    getDisplaySources: 'rec:getDisplaySources',
    pickResult: 'rec:pickResult',
    startProxyRecording: 'rec:startProxyRecording',
    stopProxyRecording: 'rec:stopProxyRecording',
    cleanupBefore: 'rec:cleanupBefore',
  },

  // ── display-media 自定义选择器 ──
  displayMedia: {
    reply: 'display-media:reply',
  },

  // ── 笔记向量化 ──
  embed: {
    one: 'embed:one',
    delete: 'embed:delete',
    batch: 'embed:batch',
    search: 'embed:search',
    status: 'embed:status',
  },

  // ── 本地 TTS ──
  tts: {
    speak: 'tts:speak',
    noteAudio: 'tts:noteAudio',
  },

  // ── 自动更新（注册于 auto-updater.cjs）──
  update: {
    check: 'update:check',
    download: 'update:download',
    install: 'update:install',
    silentCheck: 'update:silentCheck',
    getStatus: 'update:getStatus',
  },

  // ── 录屏代理窗口私有通道（main ↔ rec-proxy.html，不经 preload）──
  proxy: {
    start: 'rec-proxy:start',
    stop: 'rec-proxy:stop',
    capture: 'rec-proxy:capture',
    done: 'rec-proxy:done',
    segAck: 'rec-proxy:seg-ack',
    seg: 'rec-proxy:seg',
    captureReply: 'rec-proxy:capture-reply',
    error: 'rec-proxy:error',
    log: 'rec-proxy:log',
  },

  // ── 事件 / 广播（webContents.send + on* 订阅）──
  EV: {
    bubbleState: 'bubble:state',
    generateNoteChunk: 'ai:generateNote:chunk',
    chatChunk: 'ai:chat:chunk',
    logEntry: 'log:entry',
    quizProviderNotice: 'quiz:providerNotice',
    displayMediaRequest: 'display-media:request',
    recOverQuota: 'rec:overQuota',
    notesChanged: 'notes:changed',
    navigate: 'navigate',
    notesOpen: 'notes:open',
    updateStatus: 'update:status',
  },
}

module.exports = IPC
// 扁平的 invoke 通道字符串集合（不含事件/proxy），供一致性测试使用
module.exports.INVOKE = Object.keys(IPC)
  .filter((k) => k !== 'EV' && k !== 'proxy')
  .flatMap((k) => Object.values(IPC[k]))
module.exports.EVENTS = Object.values(IPC.EV)