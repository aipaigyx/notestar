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
    // ⚠️ 2026-09-07 逐模型实测：NVIDIA 按「账号 × 模型」授权，目录可见 ≠ 可对话。
    // 部分模型对免费/个人 Key 返回 404 "Function not found for account"。
    // 本列表已按本机实测结果排序：前 4 个确认可用；下方「部分账号无授权」项遇 404 请换推荐模型。
    defaultModel: 'google/gemma-4-31b-it',
    models: [
      { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B', desc: '推荐 · 实测可用，中文干净' },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B', desc: '实测可用 · 旗舰' },
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Nemotron 3.5 Lightning 30B', desc: '实测可用 · 推理型偏慢' },
      { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 Vision 11B', desc: '👁️ 实测可用 · 支持识图' },
      { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 Vision 90B', desc: '👁️ 大参数视觉 · 常排队' },
      { id: 'deepseek-ai/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash', desc: '快速推理 · 常排队' },
      { id: 'deepseek-ai/deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', desc: '强推理 · 常排队' },
      { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron-4 340B', desc: '部分账号无授权' },
      { id: 'nvidia/llama-3.1-nemotron-51b-instruct', name: 'Nemotron 51B', desc: '部分账号无授权' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', desc: '旧默认 · 部分账号无授权' },
      { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B', desc: '部分账号无授权' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large', desc: '部分账号无授权' },
      { id: 'microsoft/phi-3-vision-128k-instruct', name: 'Phi-3 Vision', desc: '👁️ 部分账号无授权' },
      { id: 'nvidia/vila', name: 'NVIDIA VILA', desc: '👁️ 部分账号无授权' },
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

// Electron API 类型声明：见 src/note-api.d.ts（完整权威来源）
// 原内联 Window.noteAPI 声明已迁移至 src/note-api.d.ts，避免与完整声明重复冲突。

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
