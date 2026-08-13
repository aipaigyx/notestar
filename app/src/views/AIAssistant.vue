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
          >
            <span class="history-item-title">{{ s.title || '未命名对话' }}</span>
            <span class="history-item-meta">{{ formatDate(s.createdAt) }}</span>
            <button class="history-delete" @click.stop="deleteSession(s.id)">×</button>
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
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8L10 0Z" fill="white"/>
              </svg>
            </div>
            <div class="chat-title-wrap">
              <span class="chat-title">{{ currentSessionTitle || 'AI 助手' }}</span>
              <span class="chat-subtitle">本地目录检索 · 仅按需读取相关笔记</span>
            </div>
          </div>
          <div class="chat-header-right">
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
                    <path d="M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4L8 0Z" fill="white"/>
                  </svg>
                </div>
                <div class="ai-msg-body">
                  <span class="ai-msg-name">星图 AI</span>
                  <div class="ai-bubble markdown-body" v-html="renderMarkdown(msg.content)"></div>
                  <div class="ai-actions">
                    <button class="ai-action-btn" @click="copyMessage(msg.content)">复制</button>
                    <button class="ai-action-btn" @click="regenerate(i)">重新生成</button>
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
                  <path d="M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4L8 0Z" fill="white"/>
                </svg>
              </div>
              <div class="ai-msg-body">
                <span class="ai-msg-name">星图 AI</span>
                <div class="ai-bubble" v-if="streamingText">
                  <div class="markdown-body" v-html="renderMarkdown(streamingText)"></div>
                  <span class="cursor-blink">▊</span>
                </div>
                <div class="ai-bubble thinking" v-else>
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                </div>
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
            <h2 class="welcome-title">你好！我是星图 AI</h2>
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
import type { ChatMessage, ChatSession, Note } from '../types'
import { showConfirm } from '../composables/useDialog'

const route = useRoute()
const inputText = ref('')
const messages = ref<ChatMessage[]>([])
const aiThinking = ref(false)
const errorMsg = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const streamingText = ref('')
const currentSessionId = ref<string>('')
const currentSessionTitle = ref('')

const selectedContextNotes = ref<Note[]>([])
const contextNotes = computed(() => selectedContextNotes.value)

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
  streamingText.value = ''
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
      startNewChat()
    }
  }
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || aiThinking.value) return

  errorMsg.value = ''
  streamingText.value = ''

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
    const noteContext = retrieval.context
    // 构建历史消息（排除当前刚发的）
    const history = messages.value.slice(0, -1)

    // 流式回调
    const reply = await chatWithAI(text, noteContext, history, (chunk) => {
      streamingText.value += chunk
      scrollToBottom()
    })

    streamingText.value = ''

    messages.value.push({
      role: 'assistant',
      content: reply,
      time: getCurrentTime(),
    })

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
    streamingText.value = ''
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
    streamingText.value = ''
    scrollToBottom()
    try {
      const retrieval = retrieveRelevantNotes(userMsg.content)
      selectedContextNotes.value = retrieval.matchedNotes
      const noteContext = retrieval.context
      const history = messages.value.slice(0, -1)
      const reply = await chatWithAI(userMsg.content, noteContext, history, (chunk) => {
        streamingText.value += chunk
        scrollToBottom()
      })
      streamingText.value = ''
      messages.value.push({
        role: 'assistant',
        content: reply,
        time: getCurrentTime(),
      })
    } catch (e: any) {
      errorMsg.value = e.message || 'AI 回复失败'
    } finally {
      aiThinking.value = false
      streamingText.value = ''
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
.history-item-title { font-size: 12px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 16px; }
.history-item-meta { font-size: 10px; color: var(--color-text-muted); }
.history-delete { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border: none; background: none; color: var(--color-text-muted); cursor: pointer; font-size: 14px; line-height: 1; border-radius: 4px; opacity: 0; transition: opacity 0.15s; }
.history-item:hover .history-delete { opacity: 1; }
.history-delete:hover { background: rgba(231,76,60,0.1); color: #e74c3c; }
.history-empty { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 20px 0; }

.chat-area { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 0 24px; height: 56px; background: rgba(255,255,255,0.55); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,192,213,0.35); }
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
.context-empty { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 16px; }
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
