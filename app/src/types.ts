// 数据类型定义
export interface Note {
  id: string
  title: string
  courseId: string
  tags: string[]
  content: string
  createdAt: string
  updatedAt: string
  paragraphs: number
  deletedAt?: string // 回收站标记：非空表示已移入回收站
}

export interface Course {
  id: string
  name: string
  noteCount: number
  color: string
  active?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
  /** AI 消息联网搜索到的资料（用于展示来源） */
  webSources?: WebSearchResult[]
  /** AI 消息相关的网络参考图 */
  webImages?: WebImageResult[]
}

/** 联网搜索结果 */
export interface WebSearchResult {
  title: string
  snippet: string
  url: string
}

/** 联网参考图结果 */
export interface WebImageResult {
  /** 本地缓存路径（images/web/xxx），空则用 directUrl */
  localPath: string
  /** 直链缩略图 URL（本地缓存失败时前端直接显示） */
  directUrl: string
  /** 原图/来源页 URL */
  sourceUrl: string
  /** 图片标题（B 站封面为视频标题 / AI 生图标记） */
  title?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  noteRefs?: string[]
}

export interface Stats {
  totalStudyMinutes: number
  streakDays: number
  lastStudyDate: string
  weeklyMinutes: number[]
  mastery: { courseId: string; pct: number }[]
  plan?: { dailyMinutes: number } // 学习计划：每日目标（分钟）
}

export interface Settings {
  apiKey: string
  model: string
  provider: AIProvider
  // 每平台独立 API Key（v2026-09-02）：key 为"平台 id → 明文 key"，前端内存使用；
  // 落盘时主进程整体加密到 apiKeysEnc。apiKey 字段保留为"当前 provider 的 key"以兼容旧逻辑。
  apiKeys?: Record<string, string>
  modelRouting?: ModelRouting // 按功能路由模型（可选）
  // P0-V1 修复：记住上次截图选择的窗口/屏幕 sourceId（desktopCapturer source id），避免每次截图都走不可靠的标题匹配
  rememberedCapture?: { sourceId: string; sourceName: string } | null
  // Day 3 P1-V4：录屏占用告警阈值（GB，超过后 UI 弹提示清理）+ 一键清理 N 天前的录屏
  recStorageWarnGB?: number // 默认 2
  recCleanupDays?: number  // 默认 30
  // 翁法罗斯皮肤：卡片自定义背景图（Electron: "images/xxx.png" 相对引用；浏览器: dataUri）
  // 旧版单图字段，保留兼容：有值时并入 cardBackgrounds.global
  cardBackground?: string | null
  // 卡片背景系统 v2：按卡片区域分组，每组可独立设背景 + 遮罩强度
  // group: 'all' | 'dashboard' | 'notes'（all=其余全局主卡片兜底）
  cardBackgrounds?: {
    all?: string | null       // 全局兜底背景（旧 cardBackground 迁移到此处）
    dashboard?: string | null // 仪表盘统计/图表卡片
    notes?: string | null     // 笔记列表/笔记卡片
    veil?: number             // 遮罩强度 0.3~0.85，默认 0.62
  }
  // 用户资料（侧栏头像/昵称）：avatar 为图片相对引用（images/xxx.png）或 dataUri
  userProfile?: {
    name?: string
    avatar?: string | null
  }
}

// 按功能路由模型：chat=AI对话 quick=快速整理(AI整理) deep=深度分析(知识分析/扩展/摘要)
export interface ModelRoute {
  provider: AIProvider
  model: string
}
export interface ModelRouting {
  chat?: ModelRoute
  quick?: ModelRoute
  deep?: ModelRoute
}

// 支持的 AI 平台
export type AIProvider = 'deepseek' | 'openai' | 'zhipu' | 'qwen' | 'moonshot' | 'nvidia' | 'local'

// AI 平台配置
export interface AIPlatformConfig {
  id: AIProvider
  name: string
  icon: string
  hostname: string
  apiPath: string
  defaultModel: string
  models: { id: string; name: string; desc?: string }[]
  apiKeyUrl: string
  apiKeyPrefix: string
  docUrl: string
}

// 所有支持的 AI 平台配置
export const AI_PLATFORMS: AIPlatformConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek 深度求索',
    icon: '🧠',
    hostname: 'api.deepseek.com',
    apiPath: '/chat/completions',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', desc: '推荐，速度快' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', desc: '深度思考模式' },
    ],
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    apiKeyPrefix: 'sk-',
    docUrl: 'https://platform.deepseek.com/docs',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🌍',
    hostname: 'api.openai.com',
    apiPath: '/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', desc: '推荐，性价比高' },
      { id: 'gpt-4o', name: 'GPT-4o', desc: '最强模型' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: '长文本' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: '经济实惠' },
    ],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyPrefix: 'sk-',
    docUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'zhipu',
    name: '智谱 AI (GLM)',
    icon: '⚡',
    hostname: 'open.bigmodel.cn',
    apiPath: '/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash', desc: '推荐，免费快速' },
      { id: 'glm-4', name: 'GLM-4', desc: '标准模型' },
      { id: 'glm-4-air', name: 'GLM-4 Air', desc: '轻量版' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', desc: '增强版' },
    ],
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    apiKeyPrefix: '',
    docUrl: 'https://open.bigmodel.cn/docs',
  },
  {
    id: 'qwen',
    name: '通义千问 (阿里云)',
    icon: '🚀',
    hostname: 'dashscope.aliyuncs.com',
    apiPath: '/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-turbo',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', desc: '推荐，快速' },
      { id: 'qwen-plus', name: 'Qwen Plus', desc: '均衡版' },
      { id: 'qwen-max', name: 'Qwen Max', desc: '最强模型' },
      { id: 'qwen-long', name: 'Qwen Long', desc: '长文本' },
    ],
    apiKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    apiKeyPrefix: 'sk-',
    docUrl: 'https://help.aliyun.com/zh/dashscope/',
  },
  {
    id: 'moonshot',
    name: '月之暗面 (Kimi)',
    icon: '🌙',
    hostname: 'api.moonshot.cn',
    apiPath: '/v1/chat/completions',
    defaultModel: 'moonshot-v1-8k',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', desc: '推荐，8K上下文' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', desc: '32K上下文' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', desc: '128K超长上下文' },
    ],
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    apiKeyPrefix: 'sk-',
    docUrl: 'https://platform.moonshot.cn/docs',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    icon: '🟢',
    hostname: 'integrate.api.nvidia.com',
    apiPath: '/v1/chat/completions',
    // ⚠️ 2026-09-02 实测 /v1/models：meta/llama-3.1-8b/70b/405b 已下线，以下均为真实可用的模型 id
    defaultModel: 'nvidia/llama-3.1-nemotron-70b-instruct',
    models: [
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', desc: '推荐 · NVIDIA 优化 Llama' },
      { id: 'nvidia/llama-3.1-nemotron-51b-instruct', name: 'Nemotron 51B', desc: '快速 · NVIDIA 优化' },
      { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron-4 340B', desc: '超大规模模型' },
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Nemotron 3.5 Lightning 30B', desc: '新一代快速模型' },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B', desc: '旗舰模型' },
      { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 Vision 11B', desc: '👁️ 支持图片识别' },
      { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 Vision 90B', desc: '👁️ 大参数视觉模型' },
      { id: 'microsoft/phi-3-vision-128k-instruct', name: 'Phi-3 Vision', desc: '👁️ 微软视觉模型' },
      { id: 'nvidia/vila', name: 'NVIDIA VILA', desc: '👁️ NVIDIA 视觉模型' },
      { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B', desc: 'Google 最新' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large', desc: 'Mistral 旗舰' },
      { id: 'mistralai/mixtral-8x22b-v0.1', name: 'Mixtral 8x22B', desc: '混合专家模型' },
      { id: 'deepseek-ai/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash', desc: '快速推理' },
      { id: 'deepseek-ai/deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', desc: '强推理' },
    ],
    apiKeyUrl: 'https://build.nvidia.com',
    apiKeyPrefix: 'nvapi-',
    docUrl: 'https://docs.api.nvidia.com',
  },
  {
    id: 'local',
    name: '本地模型 (Ollama)',
    icon: '💻',
    hostname: '127.0.0.1',
    apiPath: '/v1/chat/completions',
    defaultModel: 'qwen2.5:7b-instruct',
    models: [
      { id: 'qwen2.5:7b-instruct', name: 'Qwen2.5 7B Instruct', desc: '推荐，已内置，离线可用' },
      { id: 'qwen2.5:3b', name: 'Qwen2.5 3B', desc: '轻量快速' },
      { id: 'qwen2.5:14b', name: 'Qwen2.5 14B', desc: '更智能，需要较大显存' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', desc: 'Meta 开源模型' },
      { id: 'gemma2:9b', name: 'Gemma 2 9B', desc: 'Google 轻量模型' },
    ],
    apiKeyUrl: '',
    apiKeyPrefix: '',
    docUrl: 'https://ollama.com',
  },
]

export interface ImportedFile {
  name: string
  content: string
}

// AI 知识分析结果
export interface KnowledgeTreeNode {
  title: string
  children: KnowledgeTreeNode[]
}

export interface KnowledgeCard {
  title: string
  content: string
  type: 'concept' | 'formula' | 'definition' | 'example' | 'keypoint'
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface CodeSnippet {
  language: string
  code: string
  description?: string
}

// AI 分析图表（根据内容自动判断是否生成）
export interface AnalysisChart {
  type: 'bar' | 'pie' | 'comparison' | 'line' | 'timeline' | 'flow' | 'venn'
  title: string
  labels?: string[]
  values?: number[]
  rows?: { label: string; items: string[] }[]
  // timeline 时间轴：按时间排序的事件
  events?: { time: string; title: string; desc?: string }[]
  // flow 流程图：步骤序列（可含 → 分支说明）
  steps?: string[]
  // venn 维恩图：两个集合的交集与独有项
  sets?: [string, string]
  onlyA?: string[]
  onlyB?: string[]
  both?: string[]
}

export interface NoteAnalysis {
  summary: string
  tree: KnowledgeTreeNode
  cards: KnowledgeCard[]
  keyPoints: string[]
  suggestions: string[]
  formulas?: string[]                 // 笔记含公式/化学式时提取，否则空数组
  codeSnippets?: CodeSnippet[]        // 笔记含代码时提取，否则空数组
  charts?: AnalysisChart[]            // 内容适合图表化时生成，否则空数组
  _raw?: string
}

// AI 知识扩展结果
export interface ExpandedTopic {
  title: string
  content: string
  relevance: 'high' | 'medium' | 'low'  // 与原笔记的相关度
}

export interface NoteExpansion {
  expandedTopics: ExpandedTopic[]       // 扩展知识点
  missingConcepts: string[]             // 原笔记中遗漏的重要概念
  relatedFormulas: string[]             // 相关公式或定理
  realWorldApplications: string[]       // 实际应用场景
  deeperTopics: string[]                // 深入学习方向
  _raw?: string
}

// ========== 日志系统类型 ==========
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  timestamp: string
  level: string
  levelColor: string
  source: string
  message: string
  data: string | null
}

export interface LogFileInfo {
  name: string
  size: number
  mtime: string
}

// Electron API 类型声明
declare global {
  interface Window {
    noteAPI: {
      // 悬浮球
      showMainWindow: () => Promise<boolean>
      quitApp: () => Promise<boolean>
      // 笔记
      getNotes: () => Promise<Note[]>
      getNote: (id: string) => Promise<Note | null>
      saveNote: (note: Partial<Note>) => Promise<Note>
      deleteNote: (id: string) => Promise<boolean>
      getDeletedNotes: () => Promise<Note[]>
      restoreNote: (id: string) => Promise<boolean>
      purgeNote: (id: string) => Promise<boolean>
      // 课程
      getCourses: () => Promise<Course[]>
      saveCourse: (course: Partial<Course>) => Promise<Course>
      deleteCourse: (id: string) => Promise<boolean>
      // 对话
      getChatSessions: () => Promise<ChatSession[]>
      saveChatSession: (session: Partial<ChatSession>) => Promise<ChatSession>
      deleteChatSession: (id: string) => Promise<boolean>
      // 统计
      getStats: () => Promise<Stats>
      addStudyTime: (minutes: number) => Promise<Stats>
      setPlan: (dailyMinutes: number) => Promise<Stats>
      // 文件导入
      importFiles: () => Promise<ImportedFile[] | null>
      selectImage: () => Promise<{ name: string; dataUri: string; size: number } | null>
      readClipboardImage: () => Promise<{ name: string; dataUri: string; size: number } | null>
      saveImage: (dataUri: string) => Promise<string> // 返回 images/xxx.png 相对引用
      listScreenSources: () => Promise<{ id: string; name: string; isScreen: boolean; thumbnail: string }[]>
      captureScreen: (opts: { sourceId?: string; mode?: 'source' | 'foreground' }) => Promise<{ name: string; dataUri: string }>
      exportNotes: (opts: { noteIds?: string[]; courseId?: string; format?: 'md' | 'html'; analysisMap?: Record<string, NoteAnalysis> }) => Promise<string | null>
      backupData: () => Promise<string | null>
      getBackupInfo: () => Promise<{ lastBackupAt?: string; backupDir?: string; overdue: boolean }>
      // AI
      generateNote: (rawText: string) => Promise<string>
      chatWithAI: (question: string, noteContext: string, history?: ChatMessage[], mode?: 'qa' | 'teach' | 'quiz') => Promise<string>
      summarizeNote: (noteContent: string) => Promise<string>
      analyzeNote: (noteContent: string, includeImages?: boolean, noteId?: string, force?: boolean) => Promise<NoteAnalysis>
      getAnalysisCache: (noteId: string, contents: string[]) => Promise<{ found: boolean; result?: NoteAnalysis; cachedAt?: string }>
      expandNote: (noteContent: string, includeImages?: boolean) => Promise<NoteExpansion>
      // 本地音频转写 (Whisper) + 语音转文字独立窗口
      transcribeAudio: (audioData: ArrayBuffer) => Promise<string>
      openVoiceWindow: () => Promise<boolean>
      closeVoiceWindow: () => Promise<boolean>
      // AI 流式监听
      onGenerateNoteChunk: (callback: (chunk: string) => void) => void
      onChatChunk: (callback: (chunk: string) => void) => void
      // 数据管理
      exportData: () => Promise<string | null>
      // 导出任意文本（AI 对话导出 Markdown）
      exportText: (filename: string, content: string) => Promise<boolean>
      importData: () => Promise<{ success: boolean; notes: number; courses: number } | null>
      clearData: (type: 'all' | 'notes' | 'chat' | 'stats' | 'courses') => Promise<boolean>
      // 联网搜索（AI 助手兜底）：用系统浏览器打开搜索引擎
      openSearch: (keywords: string) => Promise<boolean>
      // 打开外部链接（联网来源点击）
      openUrl: (url: string) => Promise<boolean>
      // 联网搜索（AI 联网总结）：DDG 优先 + Bing 兜底
      searchWeb: (query: string) => Promise<WebSearchResult[]>
      // 联网参考图搜索（AI 回答配图）
      searchWebImages: (query: string) => Promise<WebImageResult[]>
      // AI 生图（免费 Pollinations）：返回图片直链 URL
      generateImage: (prompt: string) => Promise<string>
      // 知识点复习（题库 + 错题本）
      quizSaveSessions: (sessions: QuizSession[]) => Promise<boolean>
      quizGetSessions: () => Promise<QuizSession[]>
      quizSaveMistakes: (mistakes: QuizMistake[]) => Promise<boolean>
      quizGetMistakes: () => Promise<QuizMistake[]>
      quizGenerate: (opts: { noteIds?: string[]; courseIds?: string[]; count?: number; provider?: 'auto' | 'cloud' | 'local'; extendRatio?: number }) => Promise<{ questions: QuizQuestion[]; provider: string }>
      quizSaveMastery: (mastery: QuizMasteryMap) => Promise<boolean>
      quizGetMastery: () => Promise<QuizMasteryMap>
      quizExportHtml: (opts: { title: string; items: { question: string; answer: string; myAnswer: string; explanation: string; source: string; typeLabel?: string; difficulty?: string; correct: boolean; kind?: string; basis?: string }[] }) => Promise<string | null>
      // 设置
      getSettings: () => Promise<Settings>
      saveSettings: (settings: Settings) => Promise<boolean>
      // AI 连通性测试 + 获取模型列表
      testConnection: (config: { provider?: string; apiKey: string; hostname?: string; apiPath?: string }) => Promise<{ success: boolean; message: string; models?: string[] }>
      // 日志系统
      logWrite: (level: LogLevel, source: string, message: string, data?: any) => Promise<boolean>
      logGetFiles: () => Promise<LogFileInfo[]>
      logRead: (fileName: string) => Promise<{ lines: LogEntry[]; error: string | null }>
      logClear: (fileName: string) => Promise<boolean>
      logSetLevel: (level: LogLevel) => Promise<boolean>
      logOpenDir: () => Promise<boolean>
      onLogEntry: (callback: (entry: LogEntry) => void) => () => void
  // 数据变更事件（快捷键/悬浮球后台创建笔记后通知刷新）
  onNotesChanged: (callback: () => void) => void
    }
  }
}

// ========== 知识点复习（Quiz） ==========
export type QuizQuestionType = 'choice' | 'blank' | 'judge' | 'multi' | 'match' | 'sort'
export type QuizQuestionKind = 'review' | 'extend' // review=溯源复习题 extend=举一反三扩展题
export type QuizMastery = 'new' | 'weak' | 'medium' | 'mastered'
export type QuizDifficulty = 'easy' | 'medium' | 'hard'

export interface QuizQuestion {
  id: string
  type: QuizQuestionType
  question: string          // 题干
  kind?: QuizQuestionKind   // 复习题 / 扩展题（缺省=review）
  basis?: string            // 扩展题：所依据的知识点原文片段（用于"依据溯源"校验）
  options?: string[]        // 选择题/多选题选项（4 个）
  answer: string            // 正确答案（choice: 'A'；blank: 关键词；judge: '对'|'错'；multi: 'AC'；match: 映射串；sort: 正确步骤序列）
  explanation: string       // 解析（必须说明依据）
  source: string            // 笔记出处（标题 + 原文引用片段，保证答案可追溯）
  sourceNoteId?: string     // 来源笔记 id（可点击跳转到笔记）
  difficulty?: QuizDifficulty // 难度（AI 标注）
  pairs?: { left: string; right: string }[] // 匹配题：左右配对 / 排序题：正确步骤（用 left 存步骤文本，right 存序号）
  // 间隔重复状态（随答题更新）
  mastery?: QuizMastery     // new 未练 / weak 生疏 / medium 一般 / mastered 掌握
  reviewCount?: number      // 已练次数
  correctStreak?: number    // 连续答对次数
  lastResult?: boolean      // 最近一次对错
  nextReviewAt?: string     // 下次复习时间（ISO）
}

export interface QuizSession {
  id: string
  title: string             // 如「Blender 三渲二 · 10 题」
  createdAt: string
  scope: { noteIds: string[]; courseIds: string[]; count: number }
  questions: QuizQuestion[]
  answers: (string | null)[] // 我的答案（未答为 null）
  correct: number           // 答对数
  total: number
  durationSec?: number      // 总用时（秒）
  perQuestionSec?: number[] // 每题用时
}

export interface QuizMistake {
  question: QuizQuestion
  myAnswer: string
  sessionId: string
  createdAt: string
}

// 间隔重复掌握度表：questionId → 状态
export interface QuizMasteryItem {
  mastery: QuizMastery
  reviewCount: number
  correctStreak: number
  lastResult: boolean
  nextReviewAt: string
  question: QuizQuestion // 题目快照（复习队列直接用）
}
export type QuizMasteryMap = Record<string, QuizMasteryItem>

export {}
