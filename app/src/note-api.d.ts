// ============================================================
// noteAPI 桥接层完整类型声明（唯一权威来源）
// 对应 electron/preload.js 中 contextBridge.exposeInMainWorld('noteAPI', {...})
// 所有 preload 暴露的键都必须在此声明，保持签名与 preload 完全一致。
// ============================================================
import type {
  Note,
  Course,
  ChatSession,
  ChatMessage,
  Stats,
  Settings,
  LogLevel,
  LogEntry,
  LogFileInfo,
  ImportedFile,
  NoteAnalysis,
  NoteExpansion,
  WebSearchResult,
  WebImageResult,
  QuizSession,
  QuizMistake,
  QuizMasteryMap,
  QuizQuestion,
} from './types'

// values match preload 中 transcribeAudio/recSaveSegment 的不走 plain() 的 Buffer 类参数
type Transferable = ArrayBuffer | ArrayBufferView

// AI 思维导图树（ai:extractHierarchy 返回：{id, label, children}）
export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
}

// 录屏使用量 / 清理结果 / embedding 重建结果（与 main.cjs 返回值一致）
export interface RecSession {
  sessionId: string
  title?: string
  noteId?: string
  durationSec?: number
  createdAt?: string
  segments?: { index: number; path?: string; durationSec?: number }[]
  [k: string]: unknown
}
export interface RecUsageInfo { sessions: number; bytes: number }
export interface RecCleanResult { removed: number; bytes: number }
export interface EmbedRebuildResult { ok: boolean; total: number; skip: number; fail: number; error?: string }
export interface EmbedStatusInfo { ok: boolean; model: string; dim: number; count: number }

export interface NoteAPI {
  // ── 应用 / 窗口 ──
  showMainWindow: () => Promise<boolean>
  quitApp: () => Promise<boolean>
  getAppVersion: () => Promise<{ version: string; name: string; electron: string; chrome: string; node: string }>

  // ── 悬浮球 ──
  expandBubble: (height: number) => Promise<boolean>
  collapseBubble: () => Promise<boolean>
  bubbleExpand: (open: boolean, height: number) => Promise<boolean>
  bubbleCollapse: () => Promise<boolean>
  bubbleAction: (act: string) => Promise<boolean>
  bubbleDragStart: () => Promise<boolean>
  bubbleDragMove: (pos: { x: number; y: number }) => Promise<boolean>
  onBubbleState: (callback: (state: { open?: boolean; recording?: boolean; toast?: string }) => void) => void

  // ── 录屏选窗 (bubble-picker.html 专用) ──
  pickerGetSources: () => Promise<{ id: string; name: string; thumbnail: string; isScreen?: boolean }[]>
  pickerSelect: (payload: { type: 'cancel' | 'select'; sourceId?: string }) => void

  // ── 笔记 CRUD ──
  getNotes: () => Promise<Note[]>
  getNote: (id: string) => Promise<Note | null>
  saveNote: (note: Partial<Note>) => Promise<Note>
  deleteNote: (id: string) => Promise<boolean>
  getDeletedNotes: () => Promise<Note[]>
  restoreNote: (id: string) => Promise<boolean>
  purgeNote: (id: string) => Promise<boolean>

  // ── 课程 CRUD ──
  getCourses: () => Promise<Course[]>
  saveCourse: (course: Partial<Course>) => Promise<Course>
  deleteCourse: (id: string) => Promise<boolean>

  // ── 对话 ──
  getChatSessions: () => Promise<ChatSession[]>
  saveChatSession: (session: Partial<ChatSession>) => Promise<ChatSession>
  deleteChatSession: (id: string) => Promise<boolean>

  // ── 统计 ──
  getStats: () => Promise<Stats>
  addStudyTime: (minutes: number) => Promise<Stats>
  setPlan: (dailyMinutes: number) => Promise<Stats>

  // ── 文件 / 图片 ──
  importFiles: () => Promise<ImportedFile[] | null>
  selectImage: () => Promise<{ name: string; dataUri: string; size: number } | null>
  readClipboardImage: () => Promise<{ name: string; dataUri: string; size: number } | null>
  saveImage: (dataUri: string) => Promise<string>

  // ── 屏幕截图 ──
  listScreenSources: () => Promise<{ id: string; name: string; isScreen: boolean; thumbnail: string }[]>
  captureScreen: (opts: { sourceId?: string; mode?: 'source' | 'foreground' }) => Promise<{ name: string; dataUri: string }>
  fastCaptureScreen: (opts?: { width?: number; height?: number }) => Promise<{ ok: boolean; dataUri?: string; reason?: string }>

  // ── 导出 / 备份 ──
  exportNotes: (opts: { noteIds?: string[]; courseId?: string; format?: 'md' | 'html'; analysisMap?: Record<string, NoteAnalysis> }) => Promise<string | null>
  backupData: () => Promise<string | null>
  getBackupInfo: () => Promise<{ lastBackupAt?: string; backupDir?: string; overdue: boolean }>

  // ── 联网搜索 ──
  openSearch: (keywords: string) => Promise<boolean>
  openUrl: (url: string) => Promise<boolean>
  searchWeb: (query: string) => Promise<WebSearchResult[]>
  searchWebImages: (query: string) => Promise<WebImageResult[]>
  generateImage: (prompt: string) => Promise<string>

  // ── 语音转写 / 独立窗口（ArrayBuffer 不走 plain()）──
  transcribeAudio: (audioData: Transferable) => Promise<{ text: string }>
  openVoiceWindow: () => Promise<boolean>
  closeVoiceWindow: () => Promise<boolean>

  // ── AI 接口 ──
  generateNote: (rawText: string) => Promise<string>
  chatWithAI: (question: string, noteContext: string, history?: ChatMessage[], mode?: 'qa' | 'teach' | 'quiz' | null) => Promise<string>
  summarizeNote: (noteContent: string) => Promise<string>
  weeklyReport: (data: unknown) => Promise<string>
  analyzeNote: (noteContent: string, includeImages?: boolean, noteId?: string, force?: boolean) => Promise<NoteAnalysis>
  getAnalysisCache: (noteId: string, contents: string[]) => Promise<{ found: boolean; result?: NoteAnalysis; cachedAt?: string }>
  expandNote: (noteContent: string, includeImages?: boolean) => Promise<NoteExpansion>
  extractHierarchy: (payload: { title?: string; content?: string }) => Promise<MindMapNode>

  // ── AI 流式监听 ──
  onGenerateNoteChunk: (callback: (chunk: string) => void) => void
  onChatChunk: (callback: (chunk: string) => void) => void

  // ── 数据管理 ──
  exportData: () => Promise<string | null>
  exportText: (filename: string, content: string) => Promise<boolean>
  importData: () => Promise<{ success: boolean; notes: number; courses: number } | null>
  clearData: (type: 'all' | 'notes' | 'chat' | 'stats' | 'courses') => Promise<boolean>

  // ── 出题 / 复习 ──
  quizSaveSessions: (sessions: QuizSession[]) => Promise<boolean>
  quizGetSessions: () => Promise<QuizSession[]>
  quizSaveMistakes: (mistakes: QuizMistake[]) => Promise<boolean>
  quizGetMistakes: () => Promise<QuizMistake[]>
  quizGenerate: (opts: { noteIds?: string[]; courseIds?: string[]; count?: number; provider?: 'auto' | 'cloud' | 'local'; extendRatio?: number }) => Promise<{ questions: QuizQuestion[]; provider: string }>
  quizSaveMastery: (mastery: QuizMasteryMap) => Promise<boolean>
  quizGetMastery: () => Promise<QuizMasteryMap>
  quizExportHtml: (opts: { title: string; items: Record<string, unknown>[] }) => Promise<string | null>

  // ── 设置 ──
  getSettings: () => Promise<Settings>
  saveSettings: (settings: Settings) => Promise<boolean>
  testConnection: (config: { provider?: string; apiKey: string; hostname?: string; apiPath?: string; model?: string }) => Promise<{ success: boolean; message: string; models?: string[] }>

  // ── 日志 ──
  logWrite: (level: LogLevel | Lowercase<LogLevel>, source: string, message: string, data?: unknown) => Promise<boolean>
  logGetFiles: () => Promise<LogFileInfo[]>
  logRead: (fileName: string) => Promise<{ lines: LogEntry[]; error: string | null }>
  logClear: (fileName: string) => Promise<boolean>
  logSetLevel: (level: LogLevel | Lowercase<LogLevel>) => Promise<boolean>
  logOpenDir: () => Promise<boolean>
  onLogEntry: (callback: (entry: LogEntry) => void) => () => void
  onQuizProviderNotice: (callback: (payload: { provider: string; message?: string }) => void) => () => void

  // ── 跟拍 / 录屏 ──
  followAiDescribe: (imageDataUri: string) => Promise<string>
  followAppendEntry: (payload: Record<string, unknown>) => Promise<boolean>
  followListVisionModels: () => Promise<{ all: string[]; vision: string[] }>
  pullOllamaModel: (model: string) => Promise<boolean>
  recSaveSegment: (payload: { sessionId: string; index: number; buffer: Transferable; mime?: string; durationSec?: number }) => Promise<string>  // buffer 不走 plain()（structuredClone）
  recFinishSession: (payload: { sessionId: string; title?: string; durationSec?: number; noteId?: string; segmentDurations?: number[] }) => Promise<{ sessionId: string }>
  recListSessions: () => Promise<RecSession[]>
  recGetUsage: () => Promise<RecUsageInfo>
  recDeleteSession: (sessionId: string) => Promise<boolean>
  recDeleteAll: () => Promise<boolean>
  recOpenDir: () => Promise<void>
  recPickDisplaySource: () => Promise<boolean>
  recStartProxyRecording: (sessionId: string) => Promise<boolean>
  recStopProxyRecording: () => Promise<boolean>
  recCleanupBefore: (days: number) => Promise<RecCleanResult>

  // ── display-media 自定义选择器 ──
  displayMediaReply: (payload: { reqId?: string; streamId?: string; remember?: boolean }) => Promise<boolean>
  onDisplayMediaRequest: (callback: (payload: { requestId?: string }) => void) => () => void
  onRecOverQuota: (callback: (payload: { usedGB?: number; warnGB?: number }) => void) => () => void

  // ── 笔记向量化 ──
  embedNote: (note: Note) => Promise<boolean>
  deleteEmbed: (noteId: string) => Promise<boolean>
  batchEmbed: (opts: Record<string, unknown>) => Promise<EmbedRebuildResult>
  embedSearch: (params: Record<string, unknown>) => Promise<{ noteId: string; score: number; content: string }[]>
  embedStatus: () => Promise<EmbedStatusInfo>

  // ── 数据变更事件 / 导航 ──
  onNotesChanged: (callback: () => void) => void
  openInMain: (noteId: string) => Promise<boolean>
  onNotesOpen: (callback: (noteId: string) => void) => () => void
  onNavigate: (callback: (path: string) => void) => void

  // ── TTS ──
  ttsSpeak: (text: string) => Promise<string>
  noteAudio: (noteId: string) => Promise<string>

  // ── 自动更新 ──
  updateCheck: () => Promise<boolean>
  updateDownload: () => Promise<boolean>
  updateInstall: () => Promise<boolean>
  updateGetStatus: () => Promise<{ updateAvailable: boolean; updateDownloaded: boolean; version: string; downloadProgress: number }>
  onUpdateStatus: (callback: (status: { isChecking?: boolean; updateAvailable?: boolean; updateDownloaded?: boolean; version?: string; downloadProgress?: number }) => void) => () => void
}

declare global {
  interface Window {
    noteAPI: NoteAPI
  }
}

export type { Transferable }