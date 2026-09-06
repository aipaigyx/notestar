<template>
  <div class="ai-page">
    <div class="glow-orb glow-pink" style="width: 500px; height: 500px; top: 60px; left: -60px;"></div>
    <div class="glow-orb glow-blue" style="width: 600px; height: 600px; bottom: -100px; right: 100px;"></div>

    <div class="content-layer">
      <!-- 左侧对话历史 -->
      <div class="history-panel">
        <div class="history-header">
          <h3 class="history-title">对话历史</h3>
          <button class="new-chat-btn" @click="startNewChat">+ 新对话</button>
        </div>
        <div class="history-list">
          <div
            v-for="s in chatSessions"
            :key="s.id"
            class="history-item"
            :class="{ active: currentSessionId === s.id }"
            @click="loadSession(s)"
            @dblclick.stop="startRename(s)"
          >
            <input
              v-if="editingId === s.id"
              v-model="editingTitle"
              class="rename-input"
              placeholder="输入新标题"
              @click.stop
              @blur="saveRename(s)"
              @keyup.enter="saveRename(s)"
              @keyup.esc="editingId = ''"
            />
            <span v-else class="history-item-title">{{ s.title || '未命名对话' }}</span>
            <span class="history-item-meta">{{ formatDate(s.createdAt) }}</span>
            <button type="button" class="history-export" aria-label="导出对话为 Markdown" title="导出为 Markdown" @click.stop="exportSession(s)">⇩</button>
            <button type="button" class="history-delete" aria-label="删除对话" title="删除" @click.stop="deleteSession(s.id)">×</button>
          </div>
          <div v-if="chatSessions.length === 0" class="history-empty">暂无历史对话</div>
        </div>
      </div>

      <!-- 主聊天区 -->
      <div class="chat-area">
        <!-- 顶部栏 -->
        <div class="chat-header">
          <div class="chat-header-left">
            <div class="ai-avatar-lg">
              <!-- 来古士 · 智械紫瞳 -->
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 10C4.2 6.2 7 5.4 10 5.4C13 5.4 15.8 6.2 18 10C15.8 13.8 13 14.6 10 14.6C7 14.6 4.2 13.8 2 10Z" fill="white" opacity="0.95"/>
                <circle cx="10" cy="10" r="3.1" fill="#5E2B91"/>
                <circle cx="8.9" cy="8.9" r="1.1" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <div class="chat-title-wrap">
              <span class="chat-title">{{ currentSessionTitle || '来古士' }}</span>
              <span class="chat-subtitle">本地目录检索 · 仅按需读取相关笔记</span>
            </div>
          </div>
          <div class="chat-header-right">
            <!-- AI 模式切换：问答 / 教学代理 / 测验 -->
            <div class="ai-mode-switch" title="切换 AI 工作模式">
              <button
                v-for="m in [
                  { id: 'qa', label: '💬 问答' },
                  { id: 'teach', label: '🎓 教学' },
                  { id: 'quiz', label: '📝 测验' },
                ]"
                :key="m.id"
                class="ai-mode-btn"
                :class="{ on: chatMode === m.id }"
                @click="switchMode(m.id)"
              >{{ m.label }}</button>
            </div>
            <!-- 联网搜索开关 -->
            <label class="web-toggle" :class="{ on: webSearchEnabled }" title="提问时自动联网搜索补充（AI 直接给出联网总结）">
              <span class="wt-label">🌐 联网搜索</span>
              <input type="checkbox" v-model="webSearchEnabled" />
            </label>
            <button class="header-btn" title="生成当前笔记的思维导图" @click="genMindMap" :disabled="!currentNote || mindMapBusy">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3" r="2" fill="#B794F6"/><circle cx="3" cy="11" r="1.5" fill="#FF6B9D"/><circle cx="13" cy="11" r="1.5" fill="#FF6B9D"/><circle cx="8" cy="13" r="1.5" fill="#4292F5"/><path d="M8 5L8 11.5 M8 11.5L4.5 11 M8 11.5L11.5 11" stroke="#B794F6" stroke-width="1"/></svg>
            </button>
            <button class="header-btn" title="清空当前对话" @click="clearMessages">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 5H13 M6 5V3H10V5 M5 5L6 14H10L11 5" stroke="#6B6B96" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <!-- 消息区 -->
        <div class="messages-area" ref="messagesRef">
          <template v-if="messages.length > 0">
            <div v-for="(msg, i) in messages" :key="i" class="message-row" :class="msg.role">
              <!-- 用户消息 -->
              <div v-if="msg.role === 'user'" class="user-msg">
                <div class="user-bubble">{{ msg.content }}</div>
                <span class="msg-time">{{ msg.time }}</span>
              </div>
              <!-- AI 消息 -->
              <div v-else class="ai-msg">
                <div class="ai-msg-avatar">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M1.6 8C3.4 5 5.6 4.3 8 4.3C10.4 4.3 12.6 5 14.4 8C12.6 11 10.4 11.7 8 11.7C5.6 11.7 3.4 11 1.6 8Z" fill="white" opacity="0.95"/><circle cx="8" cy="8" r="2.5" fill="#5E2B91"/>
                  </svg>
                </div>
                <div class="ai-msg-body">
                  <span class="ai-msg-name">来古士</span>
                  <div class="ai-bubble markdown-body" v-html="renderMarkdown(msg.content)"></div>
                  <div class="ai-actions">
                    <button class="ai-action-btn" @click="copyMessage(msg.content)">复制</button>
                    <button class="ai-action-btn" @click="regenerate(i)">重新生成</button>
                    <button class="ai-action-btn search" @click="searchQuestion(i)">🔍 浏览器搜索此问题</button>
                  </div>
                  <!-- 联网来源 -->
                  <div v-if="msg.webSources && msg.webSources.length" class="ai-web-sources">
                    <span class="aws-toggle" @click="expandedWebIndex = expandedWebIndex === i ? -1 : i">
                      🌐 参考了 {{ msg.webSources.length }} 条网络资料{{ expandedWebIndex === i ? '（收起）' : '（点击展开）' }}
                    </span>
                    <div v-if="expandedWebIndex === i" class="aws-list">
                      <a
                        v-for="(s, si) in msg.webSources"
                        :key="si"
                        href="#"
                        class="aws-item"
                        @click.prevent="openWebSource(s.url)"
                        :title="s.url"
                      >
                        <span class="aws-title">{{ s.title }}</span>
                        <span class="aws-snippet">{{ s.snippet }}</span>
                      </a>
                    </div>
                  </div>
                  <!-- 网络参考图 -->
                  <div v-if="msg.webImages && msg.webImages.length || genAIFor === i" class="ai-web-images">
                    <div class="awi-head">
                      <span class="awi-label">🖼️ 相关参考图</span>
                      <button class="awi-gen" :disabled="genAIFor === i" @click="genAIImages(i)">
                        {{ genAIFor === i ? '⏳ AI 生成中…' : '✨ AI 生成示意图' }}
                      </button>
                    </div>
                    <div class="awi-row">
                      <div
                        v-for="(img, ii) in msg.webImages"
                        :key="ii"
                        class="awi-item"
                        :title="img.sourceUrl || img.title"
                        @click="openWebSource(img.sourceUrl)"
                      >
                        <img
                          :src="img.localPath ? 'notestar-img://' + img.localPath.replace('images/', '') : img.directUrl"
                          loading="lazy"
                          :alt="img.title || '参考图'"
                          @error="onImgError"
                        />
                      </div>
                      <div v-if="genAIFor === i" class="awi-item awi-loading">✨ 生成中</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- AI 正在输入 -->
          <div v-if="aiThinking" class="message-row assistant">
            <div class="ai-msg">
              <div class="ai-msg-avatar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1.6 8C3.4 5 5.6 4.3 8 4.3C10.4 4.3 12.6 5 14.4 8C12.6 11 10.4 11.7 8 11.7C5.6 11.7 3.4 11 1.6 8Z" fill="white" opacity="0.95"/><circle cx="8" cy="8" r="2.5" fill="#5E2B91"/>
                </svg>
              </div>
              <div class="ai-msg-body">
                <span class="ai-msg-name">来古士</span>
                <div class="ai-bubble" v-if="streamingText">
                  <div class="markdown-body" v-html="renderMarkdown(streamingText)"></div>
                  <span class="cursor-blink">▊</span>
                </div>
                <div class="ai-bubble thinking" v-else>
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                </div>
                <span v-if="webSearching" class="web-searching-hint">🌐 正在联网搜索…</span>
              </div>
            </div>
          </div>

          <!-- 欢迎界面 -->
          <div v-if="messages.length === 0 && !aiThinking" class="welcome-screen">
            <div class="welcome-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M24 2L29 19L46 24L29 29L24 46L19 29L2 24L19 19L24 2Z" fill="url(#grad1)"/>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="48" y2="48">
                    <stop offset="0%" stop-color="#FF6B9D"/>
                    <stop offset="100%" stop-color="#B794F6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 class="welcome-title">你好，我是来古士，你的知识见证者</h2>
            <p class="welcome-desc" v-if="notes.length > 0">基于你的 {{ notes.length }} 篇笔记，我可以帮你答疑解惑、总结知识</p>
            <p class="welcome-desc" v-else>请先到「笔记整理」页导入笔记，我才能更好地回答你的问题</p>
            <div class="suggestion-grid">
              <div class="suggestion-card pink" @click="useSuggestion('总结一下我所有笔记的核心知识点')">
                <span class="suggestion-text">总结一下我所有笔记的核心知识点</span>
              </div>
              <div class="suggestion-card purple" @click="useSuggestion('帮我梳理一下知识点之间的关联')">
                <span class="suggestion-text">帮我梳理一下知识点之间的关联</span>
              </div>
              <div class="suggestion-card blue" @click="useSuggestion('给我出几道练习题')">
                <span class="suggestion-text">给我出几道练习题</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 思维导图展示区（生成后显示） -->
        <div v-if="mindMapData" class="mindmap-section">
          <MindMapView :data="mindMapData" />
          <button class="ai-action-btn" @click="mindMapData = null" style="margin-top: 12px;">关闭思维导图</button>
        </div>

        <!-- 输入区 -->
        <div class="input-area">
          <div class="input-box">
            <div class="input-row">
              <input
                v-model="inputText"
                class="chat-input"
                placeholder="输入你的问题..."
                @keyup.enter="sendMessage"
                :disabled="aiThinking"
              />
              <button class="send-btn" :disabled="!inputText.trim() || aiThinking" @click="sendMessage">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="white"/>
                </svg>
              </button>
            </div>
            <div class="input-footer">
              <span v-if="errorMsg" class="input-error">{{ errorMsg }}</span>
              <span v-else>内容由 AI 生成，仅供参考学习</span>
              <span>{{ inputText.length }} / 2000</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧上下文面板 -->
      <div class="context-panel">
        <div class="context-header">
          <h3 class="context-title">本次检索来源</h3>
          <p class="context-sub">{{ contextNotes.length ? `已按需读取 ${contextNotes.length} 篇相关笔记` : '未读取任何笔记正文' }}</p>
        </div>

        <div class="context-notes">
          <div
            v-for="note in contextNotes"
            :key="note.id"
            class="context-note-card"
            :style="{ borderLeftColor: getCourseColor(note.courseId) }"
          >
            <span class="cn-tag" :style="{ color: getCourseColor(note.courseId) }">{{ getCourseName(note.courseId) }}</span>
            <span class="cn-title">{{ note.title }}</span>
            <span class="cn-meta">{{ formatDate(note.updatedAt) }} · {{ note.paragraphs }} 段</span>
          </div>
          <div v-if="contextNotes.length === 0" class="context-empty">
            本次问题未命中笔记；AI 仅使用通用知识回答
            <span class="context-empty-hint">（回答下方可点「🔍 浏览器搜索此问题」联网查找）</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  notes, courses, chatSessions, currentCourseId,
  createChatSession, saveChatSession, deleteChatSession,
  chatWithAI, addStudyTime, renderMarkdown,
  retrieveRelevantNotes, getCurrentTime
} from '../store'
import type { ChatMessage, ChatSession, Note, WebSearchResult } from '../types'
import { showConfirm, showToast } from '../composables/useDialog'
import MindMapView from '../components/note/MindMapView.vue'

const mindMapData = ref<any>(null)
const mindMapBusy = ref(false)
const currentNote = computed(() => notes.value.find(n => n.id === routeNoteId.value) || null)
const routeNoteId = computed(() => route.query.noteId || '')
const genMindMap = async () => {
  if (!currentNote.value || mindMapBusy.value) return
  mindMapBusy.value = true
  mindMapData.value = null
  try {
    const api = (window as any).noteAPI
    if (!api.extractHierarchy) throw new Error('extractHierarchy 不可用')
    mindMapData.value = await api.extractHierarchy({
      title: currentNote.value.title || '',
      content: currentNote.value.content || '',
    })
  } catch (e: any) {
    showToast && showToast('✕ 生成失败：' + (e?.message || e), 'error')
  } finally {
    mindMapBusy.value = false
  }
}

const route = useRoute()
const inputText = ref('')
const messages = ref<ChatMessage[]>([])
const aiThinking = ref(false)
const errorMsg = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const streamingText = ref('')
// —— 流式渲染节流：网络 chunk 高频到达，若每个 chunk 都立刻触发全量 markdown
//    重渲染 + 滚动，低配机上 AI 回复期间 UI 会被打满卡死。改为累积到缓冲区，
//    约 60ms 合并刷新一次（视觉几乎无差，渲染/CPU 开销大幅下降）。
let streamBuf = ''
let streamFlushTimer: ReturnType<typeof setTimeout> | null = null
const STREAM_FLUSH_MS = 60
function flushStreamBuf() {
  streamFlushTimer = null
  if (!streamBuf) return
  streamingText.value = streamBuf
  streamBuf = ''
  scrollToBottom()
}
function pushStreamChunk(chunk: string) {
  streamBuf += chunk
  if (!streamFlushTimer) {
    streamFlushTimer = setTimeout(flushStreamBuf, STREAM_FLUSH_MS)
  }
}
function resetStreamBuf() {
  if (streamFlushTimer) { clearTimeout(streamFlushTimer); streamFlushTimer = null }
  streamBuf = ''
  streamingText.value = ''
}
const currentSessionId = ref<string>('')
const currentSessionTitle = ref('')

const selectedContextNotes = ref<Note[]>([])
const contextNotes = computed(() => selectedContextNotes.value)

// AI 工作模式：问答 / 教学代理（苏格拉底式）/ 测验
const chatMode = ref<'qa' | 'teach' | 'quiz'>('qa')
const switchMode = (m: string) => {
  if (m === 'teach' || m === 'quiz') chatMode.value = m
  else chatMode.value = 'qa'
}

// 会话重命名与导出
const editingId = ref('')
const editingTitle = ref('')
const startRename = (s: ChatSession) => {
  editingId.value = s.id
  editingTitle.value = s.title || ''
}
const saveRename = async (s: ChatSession) => {
  const t = editingTitle.value.trim()
  if (t && t !== s.title) {
    s.title = t
    await saveChatSession(s)
    if (currentSessionId.value === s.id) currentSessionTitle.value = t
  }
  editingId.value = ''
}
const exportSession = async (s: ChatSession) => {
  const md = `# ${s.title || 'AI 对话记录'}\n\n`
    + s.messages.map(m =>
      `## ${m.role === 'user' ? '🧑 我' : '✨ 来古士'}（${m.time}）\n\n${m.content}\n\n---\n\n`
    ).join('')
  try {
    await (window as any).noteAPI.exportText(`${(s.title || '对话记录').slice(0, 30)}.md`, md)
  } catch (e) {
    errorMsg.value = '导出失败'
  }
}

// 联网搜索开关（默认开，localStorage 持久化）
const webSearchEnabled = ref(localStorage.getItem('aiWebSearch') !== '0')
watch(webSearchEnabled, v => localStorage.setItem('aiWebSearch', v ? '1' : '0'))
const webSearching = ref(false)
const expandedWebIndex = ref(-1)

// 打开联网来源链接
const openWebSource = async (url: string) => {
  try { await (window as any).noteAPI.openUrl(url) } catch (e) { /* ignore */ }
}

// 参考图加载失败时隐藏（防盗链/失效图）
const onImgError = (ev: Event) => {
  const el = ev.target as HTMLElement
  if (el) el.style.display = 'none'
}

// AI 生成示意图（免费 Pollinations）
const genAIFor = ref(-1)
const genAIImages = async (idx: number) => {
  if (genAIFor.value !== -1) return
  // 取该 AI 消息对应的问题作为生成 prompt
  let question = ''
  for (let i = idx - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') { question = messages.value[i].content; break }
  }
  genAIFor.value = idx
  try {
    const msg = messages.value[idx]
    if (!msg) return
    const [u1, u2] = await Promise.all([
      (window as any).noteAPI.generateImage(extractImageQuery(question)),
      (window as any).noteAPI.generateImage(extractImageQuery(question) + ' 3D render'),
    ])
    const newImgs = [u1, u2].filter(Boolean).map((u: string) => ({ localPath: '', directUrl: u, sourceUrl: u, title: '✨ AI 生成' }))
    if (newImgs.length) {
      messages.value[idx] = { ...msg, webImages: [...(msg.webImages || []), ...newImgs] }
    }
  } catch (e) { /* 生成失败静默 */ }
  finally { genAIFor.value = -1 }
}

// 提取图片搜索关键词（去掉疑问词/语气词，取核心短语）
const extractImageQuery = (text: string): string => {
  let q = text
    .replace(/[？?。！!，,、;；：:\s]+/g, ' ')
    .replace(/(吗|呢|吧|啊|呀|哦|什么|怎么|如何|为什么|有没有|是不是|能否|可以|给我|帮忙|请问|一下|参考图|效果图|图片|有哪些|介绍|讲讲|解释|详细|告诉)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (q.length < 2) {
    q = text.replace(/[？?。！!，,、]/g, ' ').trim().slice(0, 30)
  }
  return q.slice(0, 30)
}

const getCourseColor = (id: string) => courses.value.find(c => c.id === id)?.color || '#FF6B9D'
const getCourseName = (id: string) => courses.value.find(c => c.id === id)?.name || '未分类'

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const startNewChat = () => {
  messages.value = []
  currentSessionId.value = ''
  currentSessionTitle.value = ''
  errorMsg.value = ''
  resetStreamBuf()
  selectedContextNotes.value = []
}

const loadSession = (session: ChatSession) => {
  currentSessionId.value = session.id
  currentSessionTitle.value = session.title
  messages.value = [...(session.messages || [])]
  scrollToBottom()
}

const deleteSession = async (id: string) => {
  const ok = await showConfirm({
    title: '删除对话',
    message: '确定要删除这个对话吗？',
    danger: true,
  })
  if (ok) {
    await deleteChatSession(id)
    if (currentSessionId.value === id) {
      startNewChat()    }
  }
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || aiThinking.value) return

  errorMsg.value = ''
  resetStreamBuf()

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: text,
    time: getCurrentTime(),
  })
  inputText.value = ''
  scrollToBottom()

  // AI 思考中
  aiThinking.value = true
  scrollToBottom()

  try {
    // 先基于本地标题、课程与标签做检索，只向云端发送命中笔记的正文。
    const retrieval = retrieveRelevantNotes(text)
    selectedContextNotes.value = retrieval.matchedNotes
    let noteContext = retrieval.context
    let webSources: WebSearchResult[] = []

    // 联网搜索补充（开关开启时）：AI 直接基于网络资料总结，无需用户跳浏览器
    if (webSearchEnabled.value && (window as any).noteAPI?.searchWeb) {
      webSearching.value = true
      scrollToBottom()
      try {
        webSources = await (window as any).noteAPI.searchWeb(text)
        if (webSources.length) {
          noteContext += '\n\n【联网搜索到的网络资料（可能相关，请甄别使用；回答引用网络信息时请标注“网络资料”）】\n' +
            webSources.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n来源：${r.url}`).join('\n\n')
        }
      } catch (e) {
        webSources = []
      } finally {
        webSearching.value = false
      }
    }
    // 构建历史消息（排除当前刚发的）
    const history = messages.value.slice(0, -1)

    // 流式回调
    const reply = await chatWithAI(text, noteContext, history, (chunk) => {
      pushStreamChunk(chunk)
      scrollToBottom()
    }, chatMode.value)

    resetStreamBuf()

    messages.value.push({
      role: 'assistant',
      content: reply,
      time: getCurrentTime(),
      webSources: webSources.length ? webSources : undefined,
    })

    // 回答完成后异步搜索参考图（不阻塞回答；仅当联网开关开启）
    if (webSearchEnabled.value && (window as any).noteAPI?.searchWebImages) {
      const aiMsgIdx = messages.value.length - 1
      ;(async () => {
        try {
          // 图片搜索词 = 当前问题提取词 + 会话上下文关键词（前 3 条用户问题的提取词）
          // 解决追问"有没有参考图"时丢话题（只剩"参考图"）导致图不相关
          const cur = extractImageQuery(text)
          const prev = messages.value
            .filter(m => m.role === 'user')
            .slice(-3, -1)
            .map(m => extractImageQuery(m.content))
            .join(' ')
          const imgQuery = (cur + ' ' + prev).trim().slice(0, 40)
          const imgs = await (window as any).noteAPI.searchWebImages(imgQuery)
          if (imgs.length && messages.value[aiMsgIdx]) {
            messages.value[aiMsgIdx] = { ...messages.value[aiMsgIdx], webImages: imgs }
          }
        } catch (e) { /* 搜图失败静默 */ }
      })()
    }

    // 记录学习时间（每次对话记录2分钟）
    await addStudyTime(2)

    // 保存对话
    if (!currentSessionId.value) {
      // 第一轮，创建会话
      const session = await createChatSession(text.substring(0, 20))
      currentSessionId.value = session.id
      currentSessionTitle.value = session.title
      session.messages = [...messages.value]
      await saveChatSession(session)
    } else {
      const existing = chatSessions.value.find(s => s.id === currentSessionId.value)
      if (existing) {
        existing.messages = [...messages.value]
        await saveChatSession(existing)
      }
    }
  } catch (e: any) {
    errorMsg.value = e.message || 'AI 回复失败，请检查设置中的 API Key'
  } finally {
    aiThinking.value = false
    resetStreamBuf()
    scrollToBottom()
  }
}

const useSuggestion = (text: string) => {
  inputText.value = text
  sendMessage()
}

const copyMessage = (text: string) => {
  navigator.clipboard?.writeText(text)
}

// 联网兜底：打开浏览器搜索该回答对应的问题（Bing，中文友好）
const searchQuestion = async (index: number) => {
  const userMsg = messages.value.slice(0, index).reverse().find(m => m.role === 'user')
  if (!userMsg) return
  try {
    await (window as any).noteAPI.openSearch(userMsg.content.slice(0, 120))
  } catch (e) {
    errorMsg.value = '打开浏览器搜索失败'
  }
}

const clearMessages = async () => {
  const ok = await showConfirm({
    title: '清空对话',
    message: '确定要清空当前对话吗？',
    danger: true,
  })
  if (ok) {
    messages.value = []
    currentSessionId.value = ''
    currentSessionTitle.value = ''
    errorMsg.value = ''
  }
}

const regenerate = async (index: number) => {
  const userMsg = messages.value.slice(0, index).reverse().find(m => m.role === 'user')
  if (userMsg && !aiThinking.value) {
    messages.value.splice(index, 1)
    aiThinking.value = true
    resetStreamBuf()
    scrollToBottom()
    try {
      const retrieval = retrieveRelevantNotes(userMsg.content)
      selectedContextNotes.value = retrieval.matchedNotes
      const noteContext = retrieval.context
      const history = messages.value.slice(0, -1)
      const reply = await chatWithAI(userMsg.content, noteContext, history, (chunk) => {
        pushStreamChunk(chunk)
        scrollToBottom()
      }, chatMode.value)
      resetStreamBuf()
      messages.value.push({
        role: 'assistant',
        content: reply,
        time: getCurrentTime(),
      })
    } catch (e: any) {
      errorMsg.value = e.message || 'AI 回复失败'
    } finally {
      aiThinking.value = false
      resetStreamBuf()
      scrollToBottom()
    }
  }
}

// 从 Dashboard 跳转携带的问题
watch(() => route.query.q, (q) => {
  if (q && typeof q === 'string' && !aiThinking.value) {
    inputText.value = q
    sendMessage()
  }
}, { immediate: true })

onMounted(() => {
  // 检查 URL 是否携带问题
  if (route.query.q && typeof route.query.q === 'string') {
    inputText.value = route.query.q
  }
})
</script>

<style scoped>
.ai-page { width: 100%; height: 100%; position: relative; overflow: hidden; background: var(--color-bg); }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; }

/* 左侧对话历史 */
.history-panel { width: 220px; height: 100%; display: flex; flex-direction: column; background: rgba(255,255,255,0.5); border-right: 1px solid var(--color-border); flex-shrink: 0; overflow: hidden; }
.history-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--color-border); }
.history-title { font-size: 13px; font-weight: 700; color: var(--color-text); }
.new-chat-btn { height: 26px; padding: 0 10px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.new-chat-btn:hover { opacity: 0.9; }
.history-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.history-item { position: relative; padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; gap: 2px; }
.history-item:hover { background: rgba(255,255,255,0.6); }
.history-item.active { background: var(--color-pink-light); }
.history-item-title { font-size: 12px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 30px; }
.rename-input {
  width: 100%; font-size: 12px; font-weight: 600; color: var(--color-text);
  background: rgba(255,107,157,0.08); border: 1px solid var(--color-pink);
  border-radius: 6px; padding: 3px 6px; outline: none; margin-bottom: 2px;
}
.history-export {
  position: absolute; top: 8px; right: 28px; width: 18px; height: 18px;
  border: none; background: none; color: var(--color-text-muted); cursor: pointer;
  font-size: 13px; line-height: 1; border-radius: 4px; opacity: 0; transition: opacity 0.15s;
}
.history-item:hover .history-export { opacity: 1; }
.history-export:hover { background: rgba(183,148,246,0.15); color: var(--color-purple); }
.history-item-meta { font-size: 10px; color: var(--color-text-muted); }
.history-delete { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border: none; background: none; color: var(--color-text-muted); cursor: pointer; font-size: 14px; line-height: 1; border-radius: 4px; opacity: 0; transition: opacity 0.15s; }
.history-item:hover .history-delete { opacity: 1; }
.history-delete:hover { background: rgba(231,76,60,0.1); color: #e74c3c; }
.history-empty { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 20px 0; }

.chat-area { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 0 24px; height: 56px; background: var(--color-bg-soft); border-bottom: 1px solid var(--color-border); }
.chat-header-left { display: flex; align-items: center; gap: 10px; }
.ai-avatar-lg { width: 38px; height: 38px; border-radius: var(--radius-pill); background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(255,107,157,0.3); }
.chat-title-wrap { display: flex; flex-direction: column; gap: 1px; }
.chat-title { font-size: 14px; font-weight: 700; color: var(--color-text); }
.chat-subtitle { font-size: 11px; color: var(--color-text-tertiary); }
.chat-header-right { display: flex; gap: 8px; }
.header-btn { width: 34px; height: 34px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.85); border: 1px solid rgba(255,192,213,0.45); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
.header-btn:hover { background: var(--color-white); box-shadow: var(--shadow-sm); transform: translateY(-1px); }

.messages-area { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.message-row { display: flex; }
.message-row.user { justify-content: flex-end; }
.message-row.assistant { justify-content: flex-start; }

.user-msg { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: 60%; }
.user-bubble { padding: 12px 16px; background: var(--gradient-pink-purple); color: white; border-radius: 18px 18px 6px 18px; font-size: 13px; line-height: 1.6; box-shadow: 0 4px 14px rgba(255,107,157,0.3); }
.msg-time { font-size: 10px; color: var(--color-text-muted); }

.ai-msg { display: flex; gap: 10px; max-width: 70%; }
.ai-msg-avatar { width: 34px; height: 34px; border-radius: var(--radius-pill); background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(255,107,157,0.25); }
.ai-msg-body { display: flex; flex-direction: column; gap: 4px; }
.ai-msg-name { font-size: 12px; font-weight: 600; color: var(--color-text); }
.ai-bubble { padding: 14px 16px; background: rgba(255,255,255,0.95); border: 1px solid rgba(255,192,213,0.4); border-radius: 6px 18px 18px 18px; box-shadow: var(--shadow-sm); }
.ai-bubble.thinking { display: flex; gap: 6px; align-items: center; padding: 16px 20px; }
.typing-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-pink); opacity: 0.4; animation: typing 1.4s infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing { 0%, 60%, 100% { opacity: 0.4; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }

.cursor-blink { animation: blink 1s infinite; color: var(--color-pink); }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }

.ai-actions { display: flex; gap: 8px; margin-top: 4px; }
.ai-action-btn { font-size: 11px; color: var(--color-text-tertiary); background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.ai-action-btn:hover { background: var(--color-pink-light); color: var(--color-pink); }
/* 浏览器搜索按钮（联网兜底） */
.ai-action-btn.search { color: var(--color-purple); font-weight: 600; }
.ai-action-btn.search:hover { background: rgba(183, 148, 246, 0.15); color: var(--color-purple); }

/* 联网开关 */
.web-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 99px; cursor: pointer;
  background: rgba(255,255,255,0.06); border: 1px solid var(--color-border);
  transition: all 0.2s; user-select: none;
}

/* AI 模式切换 */
.ai-mode-switch {
  display: inline-flex; gap: 2px; padding: 2px; border-radius: 99px;
  background: rgba(255,255,255,0.05); border: 1px solid var(--color-border);
}
.ai-mode-btn {
  border: none; background: none; cursor: pointer; font-size: 11px; font-weight: 600;
  color: var(--color-text-muted); padding: 4px 10px; border-radius: 99px; transition: all 0.15s;
}
.ai-mode-btn:hover { color: var(--color-text); }
.ai-mode-btn.on { background: linear-gradient(120deg, rgba(255,107,157,0.2), rgba(183,148,246,0.2)); color: var(--color-purple); }

.web-toggle .wt-label { font-size: 11px; color: var(--color-text-muted); font-weight: 600; }
.web-toggle input { display: none; }
.web-toggle.on { background: rgba(183,148,246,0.15); border-color: var(--color-purple); }
.web-toggle.on .wt-label { color: var(--color-purple); }

/* 联网来源展示 */
.ai-web-sources { margin-top: 6px; }
.aws-toggle {
  display: inline-block; font-size: 11px; cursor: pointer;
  color: var(--color-purple); font-weight: 600; padding: 2px 6px; border-radius: 6px;
}
.aws-toggle:hover { background: rgba(183, 148, 246, 0.12); }
.aws-list { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
.aws-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 7px 10px; border-radius: 8px; cursor: pointer;
  background: rgba(183, 148, 246, 0.07); border: 1px solid rgba(183, 148, 246, 0.15);
  text-decoration: none;
}
.aws-item:hover { background: rgba(183, 148, 246, 0.14); }
.aws-title { font-size: 12px; font-weight: 600; color: var(--color-text); }
.aws-snippet { font-size: 11px; color: var(--color-text-muted); line-height: 1.5; }
.web-searching-hint { display: block; font-size: 11px; color: var(--color-purple); margin-top: 4px; animation: pulse 1.2s infinite; }

/* 网络参考图 */
.ai-web-images { margin-top: 8px; }
.awi-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.awi-label { font-size: 11px; color: var(--color-text-tertiary); }
.awi-gen {
  font-size: 10.5px; font-weight: 600; cursor: pointer;
  padding: 2px 10px; border-radius: 99px; border: none;
  background: linear-gradient(120deg, rgba(255,107,157,0.15), rgba(183,148,246,0.15));
  color: var(--color-purple);
}
.awi-gen:hover:not(:disabled) { background: linear-gradient(120deg, rgba(255,107,157,0.28), rgba(183,148,246,0.28)); }
.awi-gen:disabled { opacity: 0.6; cursor: wait; }
.awi-row { display: flex; gap: 8px; flex-wrap: wrap; }
.awi-item {
  width: 96px; height: 72px; border-radius: 10px; overflow: hidden; cursor: pointer;
  border: 1px solid rgba(183, 148, 246, 0.25); background: rgba(255,255,255,0.04);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.15s;
}
.awi-item:hover { transform: scale(1.04); border-color: var(--color-purple); }
.awi-item img { width: 100%; height: 100%; object-fit: cover; }
.awi-item.awi-loading {
  font-size: 10px; color: var(--color-purple); cursor: wait;
  animation: pulse 1.2s infinite;
}

.welcome-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px; }
.welcome-icon { margin-bottom: 8px; animation: anime-float 4s ease-in-out infinite; }
.welcome-title { font-size: 22px; font-weight: 700; color: var(--color-text); }
.welcome-desc { font-size: 14px; color: var(--color-text-secondary); text-align: center; }
.suggestion-grid { display: flex; flex-direction: column; gap: 8px; max-width: 400px; width: 100%; margin-top: 16px; }
.suggestion-card { padding: 12px 16px; border-radius: var(--radius-md); cursor: pointer; transition: all 0.15s; }
.suggestion-card:hover { transform: translateX(4px); }
.suggestion-card.pink { background: rgba(255,107,157,0.08); border: 1px solid rgba(255,107,157,0.2); }
.suggestion-card.purple { background: rgba(183,148,246,0.08); border: 1px solid rgba(183,148,246,0.2); }
.suggestion-card.blue { background: rgba(66,146,245,0.08); border: 1px solid rgba(66,146,245,0.2); }
.suggestion-text { font-size: 13px; color: var(--color-text); }

.input-area { padding: 16px 24px; }
.input-box { background: rgba(255,255,255,0.95); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
.input-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
.chat-input { flex: 1; height: 36px; background: transparent; border: none; outline: none; font-size: 14px; color: var(--color-text); }
.chat-input::placeholder { color: var(--color-text-muted); }
.chat-input:disabled { opacity: 0.6; }
.send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; flex-shrink: 0; }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.send-btn:not(:disabled):hover { transform: scale(1.05); }
.send-btn:not(:disabled):active { transform: scale(0.95); }
.input-footer { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 10px; color: var(--color-text-muted); }
.input-error { color: #e74c3c; }

.context-panel { width: 260px; height: 100%; display: flex; flex-direction: column; padding: 20px; background: rgba(255,255,255,0.8); border-left: 1px solid var(--color-border); flex-shrink: 0; overflow-y: auto; }
.context-header { margin-bottom: 16px; }
.context-title { font-size: 14px; font-weight: 700; color: var(--color-text); }
.context-sub { font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px; }
.context-notes { display: flex; flex-direction: column; gap: 8px; }
.context-note-card { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; background: var(--color-white); border: 1px solid var(--color-border); border-left: 3px solid var(--color-pink); border-radius: var(--radius-md); cursor: pointer; }
.context-note-card:hover { box-shadow: var(--shadow-sm); }
.cn-tag { font-size: 10px; font-weight: 600; }
.cn-title { font-size: 13px; font-weight: 600; color: var(--color-text); }
.cn-meta { font-size: 10px; color: var(--color-text-muted); }
.context-empty { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 16px; line-height: 1.7; }
.context-empty-hint { display: block; font-size: 11px; color: var(--color-text-tertiary); margin-top: 4px; }
</style>

<style>
/* Markdown 渲染全局样式 */
.markdown-body { font-size: 13px; line-height: 1.7; color: var(--color-text); }
.markdown-body h1 { font-size: 18px; font-weight: 700; margin: 12px 0 8px; }
.markdown-body h2 { font-size: 16px; font-weight: 700; margin: 10px 0 6px; }
.markdown-body h3 { font-size: 14px; font-weight: 600; margin: 8px 0 4px; }
.markdown-body h4 { font-size: 13px; font-weight: 600; margin: 6px 0 4px; }
.markdown-body p { margin: 6px 0; }
.markdown-body ul, .markdown-body ol { margin: 6px 0; padding-left: 20px; }
.markdown-body li { margin: 3px 0; }
.markdown-body ul li { list-style: disc; }
.markdown-body ol li { list-style: decimal; }
.markdown-body strong { font-weight: 700; color: var(--color-text); }
.markdown-body em { font-style: italic; }
.markdown-body code { font-family: 'Consolas', 'Monaco', monospace; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.markdown-body pre { background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
.markdown-body pre code { background: none; padding: 0; }
.markdown-body blockquote { border-left: 3px solid var(--color-pink); padding-left: 12px; margin: 8px 0; color: var(--color-text-secondary); }
.markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.markdown-body th, .markdown-body td { border: 1px solid var(--color-border); padding: 6px 10px; text-align: left; font-size: 12px; }
.markdown-body th { background: var(--color-bg-soft); font-weight: 600; }
.markdown-body hr { border: none; border-top: 1px solid var(--color-border); margin: 12px 0; }
.markdown-body a { color: var(--color-pink); text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
</style>
