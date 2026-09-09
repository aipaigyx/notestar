// ========== Store - AI 域 ==========
// 职责：AI 助手能力（笔记生成/对话/总结/分析/扩展/AI 生图）、AI 会话管理、笔记上下文构建 + RAG 检索。
// 依赖：只 import core 的 settings/notes/chatSessions/currentChatSession/hasElectron/frontendLogger（无环）。
import type { ChatSession, ChatMessage, Settings, Note, NoteAnalysis, NoteExpansion } from '../types'
import { AI_PLATFORMS } from '../types'
import { settings, notes, courses, chatSessions, currentChatSession, hasElectron, frontendLogger } from './core'

// 根据平台获取 API 配置
function getPlatformConfig(provider: string) {
  const platform = AI_PLATFORMS.find(p => p.id === provider) || AI_PLATFORMS[0]
  return {
    hostname: platform.hostname,
    apiPath: platform.apiPath,
    defaultModel: platform.defaultModel,
    baseUrl: `https://${platform.hostname}${platform.apiPath}`,
  }
}

// 构建浏览器模式 AI 请求（所有平台兼容 OpenAI 格式）
async function callAIBrowser(s: Settings, messages: any[], onChunk?: (chunk: string) => void): Promise<string> {
  if (!s.apiKey) throw new Error('未配置 API Key，请先在设置中填写')
  const config = getPlatformConfig(s.provider)
  const model = s.model || config.defaultModel

  // 构建 API 请求体（各平台参数略有差异）
  const reqBody: any = {
    model,
    messages,
    stream: !!onChunk,
    temperature: 0.7,
    max_tokens: 8192,
  }

  // NVIDIA NIM 支持 top_p 和 seed 参数
  if (s.provider === 'nvidia') {
    reqBody.top_p = 1
    reqBody.seed = 42
    reqBody.max_tokens = 16384
  }

  const res = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${s.apiKey}`,
    },
    body: JSON.stringify(reqBody),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`${s.provider} API 返回 ${res.status}: ${errBody.substring(0, 200)}`)
  }
  if (onChunk && res.body) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const json = line.slice(6).trim()
        if (json === '[DONE]') continue
        try {
          const parsed = JSON.parse(json)
          const delta = parsed.choices?.[0]?.delta?.content || ''
          if (delta) { fullText += delta; onChunk(delta) }
        } catch (e) { /* skip */ }
      }
    }
    return fullText
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ========== AI 笔记生成（支持流式回调） ==========
export async function generateNoteFromText(rawText: string, onChunk?: (chunk: string) => void): Promise<string> {
  if (hasElectron) {
    // 注册流式监听
    if (onChunk) {
      window.noteAPI.onGenerateNoteChunk(onChunk)
    }
    return await window.noteAPI.generateNote(rawText)
  } else {
    // 浏览器模式：统一调用
    const messages = [
      { role: 'system', content: `你是一个专业的学习笔记整理助手。请将以下课堂录音转写文本整理成详细的结构化笔记。

要求：
1. **详细提取**所有知识点和概念，不要遗漏任何重要信息
2. 用多级标题（##、###）分层次组织内容，结构清晰
3. 整理重要公式、定义和定理，用引用块或代码块标注
4. 对每个知识点展开详细说明，不要只写一句话
5. 标注重点（**加粗**）和难点
6. 如果原文中有操作步骤，用有序列表整理
7. 保留原文中的所有关键信息和细节，不要简化或省略
8. 用清晰的 Markdown 格式输出
9. 第一行用 # 开头作为笔记标题
10. 确保内容详实、结构完整，像一份真正的课堂笔记而非简短摘要` },
      { role: 'user', content: `请整理以下转写文本，要求详细完整：\n\n${rawText}` },
    ]
    return await callAIBrowser(settings.value, messages, onChunk)
  }
}

// ========== AI 对话（支持流式 + 多轮对话） ==========
// mode: 'qa' 问答 | 'teach' 教学代理（苏格拉底式）| 'quiz' 测验出题
export async function chatWithAI(question: string, noteContext?: string, history?: ChatMessage[], onChunk?: (chunk: string) => void, mode: 'qa' | 'teach' | 'quiz' = 'qa'): Promise<string> {
  if (hasElectron) {
    if (onChunk) {
      window.noteAPI.onChatChunk(onChunk)
    }
    // 深拷贝 history 为纯对象数组，避免 Vue Proxy 无法被 IPC structuredClone
    const plainHistory = history ? JSON.parse(JSON.stringify(history)) : []
    return await window.noteAPI.chatWithAI(question, noteContext || '', plainHistory, mode)
  } else {
    const systemPrompt = noteContext
      ? `你是一个学习助手AI。以下是学生的笔记内容，请基于这些笔记回答问题。如果笔记中没有相关内容，请说明并给出一般性建议。\n\n学生笔记：\n${noteContext}`
      : '你是一个学习助手AI，请回答学生的学习问题。回答简洁清晰。'
    const messages = [
      { role: 'system', content: systemPrompt },
    ]
    if (history) {
      for (const msg of history.slice(-6)) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: question })
    return await callAIBrowser(settings.value, messages, onChunk)
  }
}

// ========== AI 总结 ==========
export async function summarizeNote(noteContent: string): Promise<string> {
  if (hasElectron) {
    return await window.noteAPI.summarizeNote(noteContent)
  } else {
    const messages = [
      { role: 'system', content: '请对以下笔记内容生成一段简短摘要（100字以内），概括核心知识点。' },
      { role: 'user', content: noteContent },
    ]
    return await callAIBrowser(settings.value, messages)
  }
}

// ========== AI 知识分析（生成知识点树 + 知识卡片） ==========
// 打开笔记时自动加载缓存结果（零点击复用，不重复调用 API）
export async function getAnalysisCache(noteId: string, contents: string[]): Promise<{ found: boolean; result?: NoteAnalysis; cachedAt?: string }> {
  if (hasElectron) {
    return await window.noteAPI.getAnalysisCache(noteId, contents)
  }
  return { found: false }
}

export async function analyzeNote(noteContent: string, includeImages = true, noteId = '', force = false): Promise<NoteAnalysis> {
  if (hasElectron) {
    return await window.noteAPI.analyzeNote(noteContent, includeImages, noteId, force)
  } else {
    const systemPrompt = `你是一个知识结构分析专家。请分析以下笔记内容，生成结构化的知识分析结果。

要求输出严格的 JSON 格式（不要包含 markdown 代码块标记），包含以下字段：

{
  "summary": "一段100字以内的知识点摘要",
  "tree": { "title": "根节点", "children": [{ "title": "一级知识点", "children": [{ "title": "二级知识点", "children": [] }] }] },
  "cards": [{ "title": "卡片标题", "content": "详细说明", "type": "concept", "difficulty": "easy" }],
  "keyPoints": ["关键点1", "关键点2"],
  "suggestions": ["建议1", "建议2"],
  "charts": [{"type":"bar|pie|line|comparison|timeline|flow|venn","title":"图表标题","labels":[],"values":[],"events":[],"steps":[],"sets":[],"onlyA":[],"onlyB":[],"both":[]}]
}

规则：tree 不超过3层，cards 3-6张，keyPoints 3-5个，suggestions 2-3条；charts 仅在内容适合可视化时生成最多2个（数值对比→bar、占比→pie、趋势→line、概念对比→comparison、事件先后→timeline、步骤流程→flow、异同对比→venn），否则空数组。只输出 JSON。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: noteContent },
    ]
    const result = await callAIBrowser(settings.value, messages)
    try {
      let jsonStr = result.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      return JSON.parse(jsonStr)
    } catch (e) {
      return { summary: result.substring(0, 200), tree: { title: '知识结构', children: [] }, cards: [], keyPoints: [], suggestions: [], _raw: result }
    }
  }
}

// ========== AI 知识扩展（联网发散补充） ==========
export async function expandNote(noteContent: string, includeImages = true): Promise<NoteExpansion> {
  if (hasElectron) {
    return await window.noteAPI.expandNote(noteContent, includeImages)
  } else {
    const systemPrompt = `你是一个知识扩展专家。请分析以下笔记内容，基于你的知识储备进行发散性扩展，补充用户笔记中可能遗漏的重要内容。

要求输出严格的 JSON 格式（不要包含 markdown 代码块标记），包含以下字段：

{
  "expandedTopics": [
    {
      "title": "扩展知识点标题",
      "content": "详细说明这个知识点（80-150字），解释为什么它与笔记内容相关",
      "relevance": "high|medium|low"
    }
  ],
  "missingConcepts": ["原笔记中遗漏的重要概念1", "概念2"],
  "relatedFormulas": ["相关公式或定理1", "公式2"],
  "realWorldApplications": ["实际应用场景1", "应用场景2"],
  "deeperTopics": ["深入学习的方向1", "方向2"]
}

规则：
1. expandedTopics 生成4-6个扩展知识点，每个要说明与原笔记的关联
2. missingConcepts 找出2-4个原笔记应该包含但遗漏的重要概念
3. relatedFormulas 列出1-3个相关公式或定理（如果没有可以返回空数组）
4. realWorldApplications 列出2-3个实际应用场景
5. deeperTopics 推荐2-3个深入学习方向
6. 扩展内容要准确、有价值，不要编造不存在的知识
7. 只输出 JSON，不要任何其他文字说明`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请基于以下笔记内容进行知识扩展：\n\n${noteContent}` },
    ]
    const result = await callAIBrowser(settings.value, messages)
    try {
      let jsonStr = result.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      return JSON.parse(jsonStr)
    } catch (e) {
      return { expandedTopics: [], missingConcepts: [], relatedFormulas: [], realWorldApplications: [], deeperTopics: [], _raw: result }
    }
  }
}

// ========== 对话操作 ==========
export async function createChatSession(title: string): Promise<ChatSession> {
  const session: Partial<ChatSession> = { title, messages: [] }
  if (hasElectron) {
    const saved = await window.noteAPI.saveChatSession(session)
    chatSessions.value.unshift(saved)
    currentChatSession.value = saved
    return saved
  } else {
    const newSession: ChatSession = {
      ...(session as ChatSession),
      id: 'chat' + Date.now(),
      createdAt: new Date().toISOString(),
    }
    chatSessions.value.unshift(newSession)
    currentChatSession.value = newSession
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions.value))
    return newSession
  }
}

export async function saveChatSession(session: ChatSession) {
  if (hasElectron) {
    // 深拷贝为纯对象，避免 Vue Proxy 无法被 IPC structuredClone
    const plainSession = JSON.parse(JSON.stringify(session))
    const saved = await window.noteAPI.saveChatSession(plainSession)
    const idx = chatSessions.value.findIndex(s => s.id === session.id)
    if (idx >= 0) chatSessions.value[idx] = saved
    return saved
  } else {
    const idx = chatSessions.value.findIndex(s => s.id === session.id)
    if (idx >= 0) chatSessions.value[idx] = session
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions.value))
    return session
  }
}

// 删除会话
export async function deleteChatSession(id: string) {
  if (hasElectron) {
    await window.noteAPI.deleteChatSession(id)
  } else {
    chatSessions.value = chatSessions.value.filter(s => s.id !== id)
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions.value))
  }
}

// ========== 工具函数 ==========
export function buildNoteContext(maxChars = 4000): string {
  if (notes.value.length === 0) return ''
  let context = ''
  for (const note of notes.value) {
    const entry = `【${note.title}】\n${note.content}\n\n`
    if (context.length + entry.length > maxChars) break
    context += entry
  }
  return context.trim()
}

// ========== 本地按需笔记检索 ==========
// 先建立标题/标签目录，再只把与问题相关的正文发送给云端，避免上传无关笔记。
export interface NoteRetrievalResult {
  matchedNotes: Note[]
  catalog: string
  context: string
}

function makeSearchTerms(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ').trim()
  const terms = new Set<string>()
  const words = normalized.match(/[a-z0-9_]{2,}|[\u4e00-\u9fff]{2,}/g) || []
  for (const word of words) {
    if (/^[\u4e00-\u9fff]+$/.test(word)) {
      // 对中文连续文本使用双字词，提高“不分词”情况下的标题匹配率。
      for (let i = 0; i < word.length - 1; i++) terms.add(word.slice(i, i + 2))
      if (word.length <= 8) terms.add(word)
    } else {
      terms.add(word)
    }
  }
  return [...terms].filter(term => !new Set(['什么', '怎么', '如何', '一下', '可以', '关于', '我的', '这个', '那个', '请问', '帮我']).has(term))
}

export function retrieveRelevantNotes(question: string, maxNotes = 4, maxChars = 6500): NoteRetrievalResult {
  const catalog = notes.value.slice(0, 120).map(note => {
    const course = courses.value.find(c => c.id === note.courseId)?.name || '未分类'
    const tags = note.tags?.length ? `；标签：${note.tags.join('、')}` : ''
    return `- ${note.title}（课程：${course}${tags}）`
  }).join('\n')

  const terms = makeSearchTerms(question)
  const asksForLibraryOverview = /全部|所有|整体|汇总|总结|概览|关联|图谱|复习计划|练习题/.test(question)
  const scored = notes.value.map(note => {
    const title = `${note.title} ${(note.tags || []).join(' ')}`.toLowerCase()
    const body = String(note.content || '').toLowerCase()
    let score = 0
    for (const term of terms) {
      if (title.includes(term)) score += 12
      if (body.includes(term)) score += 3
    }
    // 若用户明确询问全局问题，仍只挑选少量、较新的笔记正文作为代表材料。
    if (asksForLibraryOverview) score += 1
    return { note, score }
  }).filter(item => asksForLibraryOverview || item.score > 0)
    .sort((a, b) => b.score - a.score || b.note.updatedAt.localeCompare(a.note.updatedAt))

  const matchedNotes: Note[] = []
  let usedChars = 0
  for (const { note } of scored) {
    if (matchedNotes.length >= maxNotes) break
    const entryLength = note.title.length + String(note.content || '').length + 30
    if (matchedNotes.length > 0 && usedChars + entryLength > maxChars) continue
    matchedNotes.push(note)
    usedChars += entryLength
  }

  const sourceText = matchedNotes.map(note => `【笔记：${note.title}】\n${note.content}`).join('\n\n')
  const context = `笔记目录（仅标题、课程和标签；用于判断是否相关）：\n${catalog || '（暂无笔记）'}\n\n` +
    (sourceText
      ? `已按问题匹配到的笔记正文如下（作为基础材料）：\n${sourceText}\n\n回答要求：\n1. 笔记已覆盖的知识点：准确引用笔记内容\n2. 笔记覆盖但不全面/不完整的知识点：以笔记为基础，用你的通用知识补充扩展，使回答更完整（扩展处标注“知识扩展”）\n3. 笔记没有的内容：直接用通用知识回答，不要编造笔记引用\n4. 末尾写“参考笔记：”并列出实际使用的笔记标题`
      : '本次问题没有匹配到任何笔记正文。请直接用你的通用知识回答，无需提及笔记库；若确信相关内容你在笔记中见过可提示用户补充。')

  return { matchedNotes, catalog, context }
}