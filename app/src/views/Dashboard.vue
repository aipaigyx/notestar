<template>
  <div class="dashboard">
    <div class="glow-orb glow-pink" style="width: 520px; height: 520px; top: 80px; left: -80px;"></div>
    <div class="glow-orb glow-blue" style="width: 620px; height: 620px; top: 380px; right: -100px;"></div>
    <div class="glow-orb glow-purple" style="width: 480px; height: 480px; top: -60px; left: 40%;"></div>

    <div class="content-layer">
      <div class="main-area">
        <!-- Day 3 P1-V4：录屏占用超阈值告警（主进程 recGetUsage / 定时检查后推送） -->
        <div v-if="recQuotaAlert.visible" class="quota-alert">
          <div class="quota-left">
            <span class="quota-ico">⚠️</span>
            <div>
              <div class="quota-title">录屏占用空间已达 <b>{{ recQuotaAlert.usedGB }} GB</b>，超过阈值 <b>{{ recQuotaAlert.thresholdGB }} GB</b></div>
              <div class="quota-desc">为避免磁盘占用持续增长，建议清理几天前不再需要的录屏会话。</div>
            </div>
          </div>
          <div class="quota-actions">
            <button class="quota-btn primary" @click="goToSettings('#rec-cleanup')">前往清理</button>
            <button class="quota-btn ghost" @click="recQuotaAlert.visible = false">知道了</button>
          </div>
        </div>
        <!-- 顶部搜索栏 -->
        <div class="top-bar">
          <div class="search-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#B8B8CC" stroke-width="1.5"/>
              <path d="M11 11L14 14" stroke="#B8B8CC" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input v-model="searchQuery" class="search-input" placeholder="搜索笔记、知识点..." @keyup.enter="handleSearch" />
          </div>
          <div class="top-actions">
            <button type="button" class="icon-btn" aria-label="导入转写文本" title="导入转写文本" @click="goToNotes">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 1V11 M5 7L9 11L13 7 M2 14H16" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="icon-btn" aria-label="新建笔记" title="新建笔记" @click="newNote">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 1V17 M1 9H17" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="content-area">
          <!-- 空状态引导 -->
          <div v-if="notes.length === 0" class="empty-dashboard">
            <div class="empty-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <path d="M14 6C14 4.9 14.9 4 16 4H36L50 18V58C50 59.1 49.1 60 48 60H16C14.9 60 14 59.1 14 58V6Z" stroke="#D0D0E0" stroke-width="2"/>
                <path d="M36 4V18H50" stroke="#D0D0E0" stroke-width="2"/>
                <path d="M24 28H40 M24 34H40 M24 40H34" stroke="#D0D0E0" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <h2 class="empty-title">你的逐火之旅，由此启程</h2>
            <p class="empty-desc">奉上你的录音转写，AI 将为你点燃第一颗知识火种</p>
            <button class="empty-start-btn" @click="goToNotes">点燃第一颗火种</button>
          </div>

          <!-- 有数据时的正常展示 -->
          <template v-else>
            <!-- 统计卡片 -->
            <div class="stats-row">
              <div class="stat-card pink" @click="goToNotes">
                <div class="stat-icon-wrap" style="background: rgba(255,107,157,0.12);">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 1.5C3 0.67 3.67 0 4.5 0H10L15 5V18.5C15 19.33 14.33 20 13.5 20H4.5C3.67 20 3 19.33 3 18.5V1.5Z" fill="#FF6B9D"/></svg>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ notes.length }}</span>
                  <span class="stat-label">笔记总数</span>
                </div>
              </div>
              <div class="stat-card purple" @click="goToGraph">
                <div class="stat-icon-wrap" style="background: rgba(183,148,246,0.12);">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" fill="#B794F6"/><circle cx="4" cy="4" r="2" fill="#B794F6" opacity="0.6"/><circle cx="16" cy="5" r="2" fill="#B794F6" opacity="0.6"/><circle cx="5" cy="16" r="2" fill="#B794F6" opacity="0.6"/><circle cx="16" cy="16" r="2" fill="#B794F6" opacity="0.6"/></svg>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ knowledgePoints }}</span>
                  <span class="stat-label">知识点</span>
                </div>
              </div>
              <div class="stat-card blue">
                <div class="stat-icon-wrap" style="background: rgba(66,146,245,0.12);">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 18C5.59 18 2 14.41 2 10C2 5.59 5.59 2 10 2C14.41 2 18 5.59 18 10C18 14.41 14.41 18 10 18Z" fill="#4292F5"/><path d="M10 5V10L13 12" stroke="#4292F5" stroke-width="1.5" stroke-linecap="round"/></svg>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ studyHours }}h</span>
                  <span class="stat-label">学习时长</span>
                </div>
                <span v-if="streakDays > 0" class="streak-badge" title="连续打卡">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 0C8 0 4 4 4 8C4 10.21 5.79 12 8 12C10.21 12 12 10.21 12 8C12 4 8 0 8 0Z" fill="#FF9948"/></svg>
                  {{ streakDays }}天
                </span>
              </div>
              <div class="stat-card green">
                <div class="stat-icon-wrap" style="background: rgba(38,208,168,0.12);">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 1L3 5V11C3 14.5 6 18 10 19C14 18 17 14.5 17 11V5L10 1Z" fill="#26D0A8"/></svg>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ courses.length }}</span>
                  <span class="stat-label">课程数</span>
                </div>
              </div>
            </div>

            <!-- 学习管理：计划 + 番茄钟 + 复习 -->
            <div class="learn-row">
              <div class="chart-card plan-card">
                <div class="card-header">
                  <h3 class="card-title">🎯 今日学习计划</h3>
                  <span class="card-subtitle">目标 {{ planMinutes }} 分钟</span>
                </div>
                <div class="plan-progress">
                  <div class="plan-fill" :style="{ width: planPercent + '%' }"></div>
                </div>
                <div class="plan-info">
                  <span>今日已学 <b>{{ todayMinutes }}</b> 分钟</span>
                  <span v-if="planPercent >= 100" class="plan-done">✅ 达成目标！</span>
                  <span v-else>还差 {{ Math.max(0, planMinutes - todayMinutes) }} 分钟</span>
                </div>
                <div class="plan-edit">
                  <input v-model.number="planInput" type="number" min="10" max="600" step="10" class="plan-input" placeholder="每日目标(分钟)" />
                  <button class="plan-save" @click="savePlan">设置目标</button>
                </div>
              </div>

              <div class="chart-card focus-card">
                <div class="card-header">
                  <h3 class="card-title">🍅 番茄专注</h3>
                  <span class="card-subtitle">{{ focusRunning ? '专注中，完成后自动记录 25 分钟' : '25 分钟专注学习' }}</span>
                </div>
                <div class="focus-time" :class="{ running: focusRunning }">{{ focusDisplay }}</div>
                <div class="focus-actions">
                  <button class="focus-btn primary" @click="toggleFocus">{{ focusRunning ? '⏸ 暂停' : '▶ 开始' }}</button>
                  <button class="focus-btn ghost" @click="resetFocus">重置</button>
                </div>
              </div>

              <div class="chart-card review-card">
                <div class="card-header">
                  <h3 class="card-title">📖 今日待复习</h3>
                  <span class="card-subtitle">间隔重复提醒（1/3/7 天）</span>
                </div>
                <div v-if="dueReviews.length === 0" class="review-empty">今天没有待复习的笔记 🎉</div>
                <div v-for="note in dueReviews" :key="note.id" class="review-item" @click="openNote(note.id)">
                  <span class="review-title">{{ note.title }}</span>
                  <span class="review-days">{{ note.daysSince }} 天前学习</span>
                </div>
              </div>
            </div>

            <!-- 学习周报 -->
            <div class="chart-card report-card">
              <div class="card-header">
                <h3 class="card-title">📊 学习周报</h3>
                <button class="link-btn" @click="generateReport" :disabled="reportBusy">{{ reportBusy ? '生成中…' : '✨ 生成周报' }}</button>
              </div>
              <div class="report-stats">
                <span class="report-stat">📝 本周 {{ weekNoteCount }} 篇笔记</span>
                <span class="report-dot">·</span>
                <span class="report-stat">⏱ 学习 {{ weekMinutes }} 分钟</span>
                <span class="report-dot">·</span>
                <span class="report-stat">🔥 打卡 {{ stats?.streakDays || 0 }} 天</span>
              </div>
              <div v-if="reportText" class="report-body" v-html="reportHtml"></div>
              <div v-else class="report-hint">AI 根据本周学习数据生成总结、薄弱点与下周建议</div>
            </div>

            <!-- 近期笔记 -->
            <div class="section-block">
              <div class="section-header">
                <h3 class="section-title">近期笔记</h3>
                <button class="link-btn" @click="goToNotes">查看全部</button>
              </div>
              <div class="notes-list">
                <div v-for="note in recentNotes" :key="note.id" class="note-item" @click="openNote(note.id)">
                  <div class="note-color-bar" :style="{ background: getCourseColor(note.courseId) }"></div>
                  <div class="note-content">
                    <div class="note-top">
                      <span class="note-tag" :style="{ color: getCourseColor(note.courseId), background: getCourseColor(note.courseId) + '1A' }">{{ getCourseName(note.courseId) }}</span>
                      <span class="note-date">{{ formatDate(note.updatedAt) }}</span>
                    </div>
                    <span class="note-title">{{ note.title }}</span>
                    <span class="note-desc">{{ note.content.substring(0, 50) }}...</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部图表区 -->
            <div class="bottom-row">
              <div class="chart-card">
                <div class="card-header">
                  <h3 class="card-title">本周学习</h3>
                  <span class="card-subtitle">学习时长（小时）</span>
                </div>
                <div class="bar-chart">
                  <div v-for="(d, i) in weeklyData" :key="i" class="bar-col">
                    <div class="bar-fill" :style="{ height: (d / maxHours * 100) + '%', background: i === todayIndex ? 'var(--gradient-pink-purple)' : 'rgba(183,148,246,0.25)' }"></div>
                    <span class="bar-label">{{ weekDays[i] }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- AI 面板 -->
      <div class="ai-panel">
        <div class="ai-header">
          <div class="ai-avatar">
            <!-- 来古士 · 智械紫瞳 -->
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 10C4.2 6.2 7 5.4 10 5.4C13 5.4 15.8 6.2 18 10C15.8 13.8 13 14.6 10 14.6C7 14.6 4.2 13.8 2 10Z" fill="white" opacity="0.95"/>
              <circle cx="10" cy="10" r="3.1" fill="#5E2B91"/>
              <circle cx="8.9" cy="8.9" r="1.1" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div class="ai-title-wrap">
            <span class="ai-title">来古士</span>
            <span class="ai-subtitle">{{ hasApiKey ? '随时为你答疑' : '未配置 API Key' }}</span>
          </div>
        </div>

        <div v-if="!hasApiKey" class="api-warn-card" @click="() => goToSettings()">
          <span class="api-warn-text">点击此处配置 AI API Key</span>
        </div>

        <div v-if="notes.length > 0" class="summary-card">
          <span class="summary-label">学习概览</span>
          <p class="summary-text">共 {{ notes.length }} 篇笔记，{{ courses.length }} 门课程。{{ notes.length > 5 ? '继续保持！' : '继续导入更多笔记吧！' }}</p>
        </div>

        <div class="actions-list">
          <div class="action-item" @click="goToNotes">
            <div class="action-icon pink"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 0V14 M0 7H14" stroke="#FF6B9D" stroke-width="1.5"/></svg></div>
            <span class="action-label">导入笔记</span>
          </div>
          <div class="action-item" @click="goToAssistant">
            <div class="action-icon blue"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#4292F5" stroke-width="1.5"/><path d="M7 4V7L9 8.5" stroke="#4292F5" stroke-width="1.5" stroke-linecap="round"/></svg></div>
            <span class="action-label">AI 问答</span>
          </div>
        </div>

        <div class="chat-section">
          <span class="chat-label">最近提问</span>
          <div v-for="s in recentChatSessions" :key="s.id" class="chat-item" @click="goToAssistant">
            <span class="chat-q">{{ s.title }}</span>
          </div>
          <div v-if="recentChatSessions.length === 0" class="empty-hint-sm">还没有提问记录</div>
        </div>

        <div class="ai-input">
          <input v-model="quickQuestion" class="ai-input-field" placeholder="输入问题..." @keyup.enter="askQuick" />
          <button class="ai-send-btn" @click="askQuick">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7H13 M8 2L13 7L8 12" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { notes, courses, stats, chatSessions, currentNote, settings, setPlan, addStudyTime, renderMarkdown, localStorageMigrationNeed, migrateFromLocalStorageAndClear, refreshDashboardData } from '../store'
import { showToast, showConfirm, showAlert } from '../composables/useDialog'

const router = useRouter()
const searchQuery = ref('')
const quickQuestion = ref('')

// ========== 学习周报 ==========
const reportBusy = ref(false)
const reportText = ref('')
const reportHtml = computed(() => reportText.value ? renderMarkdown(reportText.value) : '')
const weekNoteCount = computed(() => {
  const weekAgo = Date.now() - 7 * 86400000
  return notes.value.filter(n => new Date(n.createdAt).getTime() > weekAgo).length
})
const weekMinutes = computed(() => (stats.value?.weeklyMinutes || []).reduce((a, b) => a + b, 0))
const generateReport = async () => {
  if (reportBusy.value) return
  reportBusy.value = true
  try {
    const data = {
      weekNotes: weekNoteCount.value,
      weekMinutes: weekMinutes.value,
      streakDays: stats.value?.streakDays || 0,
      totalNotes: notes.value.length,
      courseCount: courses.value.length,
      dueReviews: dueReviews.value.length,
      weekTrend: stats.value?.weeklyMinutes || [],
      recentNoteTitles: notes.value.slice(0, 8).map(n => n.title),
    }
    reportText.value = await window.noteAPI.weeklyReport(data)
  } catch (e: any) {
    showToast((e && e.message) || '周报生成失败', 'error')
  } finally {
    reportBusy.value = false
  }
}

const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

// ========== 学习计划 ==========
const planMinutes = computed(() => stats.value?.plan?.dailyMinutes || 30)
const todayMinutes = computed(() => stats.value?.weeklyMinutes?.[todayIndex] || 0)
const planPercent = computed(() => Math.min(100, Math.round((todayMinutes.value / planMinutes.value) * 100)))
const planInput = ref(planMinutes.value)
const savePlan = async () => {
  const v = Number(planInput.value) || 30
  await setPlan(v)
  planInput.value = v
  showToast(`每日学习目标已设为 ${v} 分钟`, 'success')
}

// ========== 番茄钟（25 分钟） ==========
const FOCUS_SECONDS = 25 * 60
const focusSeconds = ref(FOCUS_SECONDS)
const focusRunning = ref(false)
let focusTimer: ReturnType<typeof setInterval> | null = null
const focusDisplay = computed(() => {
  const m = Math.floor(focusSeconds.value / 60)
  const s = focusSeconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
const toggleFocus = () => {
  if (focusRunning.value) {
    focusRunning.value = false
    if (focusTimer) { clearInterval(focusTimer); focusTimer = null }
  } else {
    focusRunning.value = true
    focusTimer = setInterval(() => {
      focusSeconds.value -= 1
      if (focusSeconds.value <= 0) {
        focusSeconds.value = FOCUS_SECONDS
        focusRunning.value = false
        if (focusTimer) { clearInterval(focusTimer); focusTimer = null }
        addStudyTime(25)
        showToast('🍅 番茄完成！已记录 25 分钟学习时长', 'success')
      }
    }, 1000)
  }
}
const resetFocus = () => {
  focusRunning.value = false
  if (focusTimer) { clearInterval(focusTimer); focusTimer = null }
  focusSeconds.value = FOCUS_SECONDS
}
onUnmounted(() => {
  if (focusTimer) { clearInterval(focusTimer); focusTimer = null }
})

// ========== 今日待复习（1/3/7 天间隔） ==========
const dueReviews = computed(() => {
  const now = Date.now()
  const DAY = 86400000
  return notes.value
    .map(n => ({ id: n.id, title: n.title, daysSince: Math.floor((now - new Date(n.updatedAt).getTime()) / DAY) }))
    .filter(x => [1, 3, 7].includes(x.daysSince))
    .slice(0, 5)
})

const hasApiKey = computed(() => !!settings.value.apiKey)
const streakDays = computed(() => stats.value?.streakDays || 0)
const knowledgePoints = computed(() => {
  const tags = new Set<string>()
  notes.value.forEach(n => n.tags?.forEach(t => tags.add(t)))
  return tags.size
})
const studyHours = computed(() => stats.value ? Math.round(stats.value.totalStudyMinutes / 60) : 0)
const recentNotes = computed(() => notes.value.slice(0, 4))
const recentChatSessions = computed(() => chatSessions.value.slice(0, 3))
const weeklyData = computed(() => {
  if (stats.value?.weeklyMinutes) {
    return stats.value.weeklyMinutes.map(m => Math.round(m / 60 * 10) / 10)
  }
  return [0, 0, 0, 0, 0, 0, 0]
})
const maxHours = computed(() => Math.max(...weeklyData.value, 1))

const getCourseColor = (id: string) => courses.value.find(c => c.id === id)?.color || '#FF6B9D'
const getCourseName = (id: string) => courses.value.find(c => c.id === id)?.name || '未分类'

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const goToNotes = () => router.push('/notes')
const goToGraph = () => router.push('/graph')
const goToAssistant = () => router.push('/assistant')
// 支持传 hash 锚点（如 '#rec-cleanup'）→ 跳 Settings 后自动滚到对应区域
const goToSettings = (hash?: string) => {
  router.push(hash ? { path: '/settings', hash } : '/settings')
  if (hash) setTimeout(() => {
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 150)
}

// Day 3 P1-V4：录屏超阈值告警（主进程 recGetUsage / 定时检查后推送）
const recQuotaAlert = reactive({ visible: false, usedGB: 0, thresholdGB: 2 })
let offRecOverQuota: (() => void) | null = null
function bindRecOverQuota() {
  const api = window.noteAPI
  if (!api || typeof api.onRecOverQuota !== 'function') return
  offRecOverQuota = api.onRecOverQuota((payload: any) => {
    const used = Number(payload?.bytes || 0)
    const threshold = Number(payload?.thresholdGB || 2)
    recQuotaAlert.usedGB = Math.max(0.01, +(used / 1024 / 1024 / 1024).toFixed(2))
    recQuotaAlert.thresholdGB = Math.max(0.2, threshold)
    recQuotaAlert.visible = true
  })
}
onUnmounted(() => { try { offRecOverQuota && offRecOverQuota() } catch (_) {} })

const openNote = (id: string) => {
  currentNote.value = notes.value.find(n => n.id === id) || null
  router.push('/notes')
}

const newNote = () => {
  currentNote.value = null
  router.push('/notes')
}

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    router.push({ path: '/notes', query: { q: searchQuery.value.trim() } })
  }
}

const askQuick = () => {
  if (quickQuestion.value.trim()) {
    router.push({ path: '/assistant', query: { q: quickQuestion.value.trim() } })
    quickQuestion.value = ''
  }
}

// ========== P0-1 修复：检测浏览器模式 → 桌面版 一键迁移弹窗 ==========
let migrationPromptShown = false
watch(
  () => localStorageMigrationNeed.value,
  async (need) => {
    if (!need || migrationPromptShown) return
    migrationPromptShown = true
    const summary = []
    if (need.notes > 0) summary.push(`${need.notes} 条笔记`)
    if (need.courses > 0) summary.push(`${need.courses} 个课程`)
    if (need.chats > 0) summary.push(`${need.chats} 个对话`)
    if (need.statsMinutes > 0) summary.push(`${need.statsMinutes} 分钟学习时长`)
    const ok = await showConfirm({
      title: '检测到未迁移的笔记',
      message:
        `你之前在浏览器模式下写过 ${summary.join('、')}，` +
        '这些数据和桌面版是分开存放的，所以在桌面版看不到它们。\n\n' +
        '是否现在把它们一键合并到桌面版里？（按 id 去重，不会覆盖现有数据；浏览器模式下的原数据仍会保留一份兜底）',
      confirmText: '立即合并',
      cancelText: '暂不处理',
    })
    if (!ok) { migrationPromptShown = false; return }
    try {
      showToast('正在迁移，请稍候...', 'info')
      const { added, skipped } = await migrateFromLocalStorageAndClear()
      showToast(`迁移完成：新增 ${added} 条，跳过重复 ${skipped} 条`, 'success')
    } catch (e: any) {
      migrationPromptShown = false
      showAlert('迁移失败', e?.message || String(e))
    }
  },
  { immediate: true }
)

// 录屏超阈值监听放到 onMounted（window.noteAPI 挂载后注册）
onMounted(() => { bindRecOverQuota() })

// ✅ 数据保鲜：每次进入 Dashboard 轻量刷新 stats/notes/courses，
// 确保统计卡/打卡/近期笔记与最新数据一致（修复"改完笔记回主页面数字不更新"）
onMounted(() => { refreshDashboardData() })
</script>

<style scoped>
.dashboard { width: 100%; height: 100%; position: relative; overflow: hidden; background: var(--color-bg); }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; }
.main-area { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; }

.top-bar { display: flex; justify-content: space-between; align-items: center; padding: 0 24px; height: 56px; background: var(--color-bg-soft); border-bottom: 1px solid var(--color-border); }
.search-wrap { display: flex; align-items: center; gap: 8px; width: 300px; height: 36px; padding: 0 14px; background: rgba(255, 255, 255, 0.85); border: 1.5px solid rgba(255, 192, 213, 0.5); border-radius: var(--radius-pill); transition: all 0.2s; }
.search-wrap:focus-within { border-color: var(--color-pink); box-shadow: var(--shadow-glow); }
.search-input { flex: 1; height: 100%; font-size: 13px; color: var(--color-text); background: transparent; border: none; outline: none; }
.search-input::placeholder { color: var(--color-text-muted); }
.top-actions { display: flex; gap: 8px; }
.icon-btn { width: 36px; height: 36px; border-radius: var(--radius-pill); background: rgba(255, 255, 255, 0.85); border: 1px solid rgba(255, 192, 213, 0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
.icon-btn:hover { background: var(--color-white); box-shadow: var(--shadow-sm); transform: translateY(-1px); }

.content-area { flex: 1; padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }

/* 空状态 */
.empty-dashboard { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
.empty-icon { margin-bottom: 8px; animation: anime-float 4s ease-in-out infinite; }
.empty-title { font-size: 22px; font-weight: 700; color: var(--color-text-secondary); }
.empty-desc { font-size: 14px; color: var(--color-text-muted); text-align: center; }
.empty-start-btn { margin-top: 12px; padding: 12px 28px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: var(--radius-pill); font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(255,107,157,0.3); }
.empty-start-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,107,157,0.4); }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-card { display: flex; align-items: center; gap: 12px; padding: 18px; background: var(--color-white); border: 1px solid rgba(255, 192, 213, 0.4); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); cursor: pointer; transition: all 0.25s; position: relative; overflow: hidden; }
.stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--gradient-pink-purple); opacity: 0; transition: opacity 0.25s; }
.stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-3px); }
.stat-card:hover::before { opacity: 1; }
.stat-icon-wrap { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-info { display: flex; flex-direction: column; gap: 2px; }
.stat-value { font-size: 22px; font-weight: 700; color: var(--color-text); }
.stat-label { font-size: 11px; color: var(--color-text-tertiary); }
.streak-badge { display: flex; align-items: center; gap: 3px; padding: 3px 8px; background: linear-gradient(135deg, rgba(255,153,72,0.12), rgba(255,107,157,0.12)); border: 1px solid rgba(255,153,72,0.25); border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; color: #FF9948; flex-shrink: 0; }

.section-block { display: flex; flex-direction: column; gap: 12px; }
.section-header { display: flex; justify-content: space-between; align-items: center; }
.section-title { font-size: 16px; font-weight: 700; color: var(--color-text); position: relative; padding-left: 12px; }
.section-title::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 4px; height: 16px; border-radius: 2px; background: var(--gradient-pink-purple); }
.link-btn { font-size: 12px; color: var(--color-pink); font-weight: 500; cursor: pointer; background: none; border: none; padding: 4px 10px; border-radius: var(--radius-pill); transition: all 0.15s; }
.link-btn:hover { background: var(--color-pink-light); text-decoration: none; }

.notes-list { display: flex; flex-direction: column; gap: 8px; }
.note-item { display: flex; align-items: stretch; gap: 12px; padding: 14px 16px; background: var(--color-white); border: 1px solid rgba(255, 192, 213, 0.35); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); cursor: pointer; transition: all 0.2s; }
.note-item:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); border-color: rgba(255, 107, 157, 0.4); }
.note-color-bar { width: 4px; border-radius: var(--radius-pill); flex-shrink: 0; }
.note-content { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.note-top { display: flex; justify-content: space-between; align-items: center; }
.note-tag { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-pill); }
.note-date { font-size: 11px; color: var(--color-text-muted); }
.note-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.note-desc { font-size: 12px; color: var(--color-text-secondary); }

.bottom-row { display: grid; grid-template-columns: 1fr; gap: 16px; flex: 1; min-height: 0; }

/* 学习管理三卡片 */
.learn-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.plan-card, .focus-card, .review-card { min-height: 170px; }

/* 学习周报 */
.report-card { min-height: 170px; }
.report-stats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.report-stat { font-size: 12px; color: var(--color-text-secondary); }
.report-dot { color: var(--color-text-muted); }
.report-body {
  margin-top: 10px; padding: 12px 14px; border-radius: 12px;
  background: var(--color-bg-soft); border: 1px solid var(--color-border);
  font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.75; max-height: 260px; overflow-y: auto;
}
.report-body :deep(h2) { font-size: 13px; margin: 8px 0 4px; color: var(--color-pink); }
.report-body :deep(h3) { font-size: 12.5px; margin: 6px 0 3px; color: var(--color-purple); }
.report-body :deep(li) { margin-left: 16px; }
.report-hint { margin-top: 10px; font-size: 11.5px; color: var(--color-text-muted); }
.plan-progress { height: 10px; border-radius: var(--radius-pill); background: rgba(183,148,246,0.15); overflow: hidden; margin: 8px 0; }
.plan-fill { height: 100%; border-radius: var(--radius-pill); background: var(--gradient-pink-purple); transition: width 0.6s ease; box-shadow: 0 0 8px rgba(255,107,157,0.4); }
.plan-info { display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 10px; }
.plan-done { color: #26D0A8; font-weight: 700; }
.plan-edit { display: flex; gap: 6px; }
.plan-input { flex: 1; height: 30px; padding: 0 10px; border: 1.5px solid rgba(255,192,213,0.5); border-radius: var(--radius-pill); font-size: 12px; background: var(--color-white); color: var(--color-text); outline: none; }
.plan-input:focus { border-color: var(--color-pink); box-shadow: var(--shadow-glow); }
.plan-save { height: 30px; padding: 0 14px; border-radius: var(--radius-pill); background: var(--gradient-pink-purple); color: white; font-size: 12px; font-weight: 600; cursor: pointer; border: none; }
.focus-time { font-size: 40px; font-weight: 800; text-align: center; color: var(--color-text); font-variant-numeric: tabular-nums; margin: 8px 0 4px; background: linear-gradient(135deg, #FF6B9D, #B794F6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.focus-time.running { animation: anime-pulse 2s ease-in-out infinite; }
.focus-actions { display: flex; justify-content: center; gap: 8px; }
.focus-btn { height: 30px; padding: 0 16px; border-radius: var(--radius-pill); font-size: 12px; font-weight: 600; cursor: pointer; border: none; }
.focus-btn.primary { background: var(--gradient-pink-purple); color: white; box-shadow: 0 3px 10px rgba(255,107,157,0.3); }
.focus-btn.ghost { background: rgba(255,255,255,0.8); border: 1.5px solid rgba(255,192,213,0.5); color: var(--color-text-secondary); }
.review-empty { font-size: 13px; color: var(--color-text-muted); text-align: center; padding: 28px 0; }
.review-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-radius: var(--radius-md); background: var(--color-bg-soft); border: 1px solid rgba(255,192,213,0.3); cursor: pointer; margin-bottom: 6px; transition: all 0.15s; }
.review-item:hover { background: var(--color-pink-light); transform: translateX(2px); }
.review-title { font-size: 12.5px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.review-days { font-size: 10.5px; color: var(--color-pink); flex-shrink: 0; }
.chart-card { display: flex; flex-direction: column; gap: 16px; padding: 18px; background: var(--color-white); border: 1px solid rgba(255, 192, 213, 0.35); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }
.card-header { display: flex; flex-direction: column; gap: 2px; }
.card-title { font-size: 14px; font-weight: 700; color: var(--color-text); }
.card-subtitle { font-size: 11px; color: var(--color-text-tertiary); }
.bar-chart { flex: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; padding-bottom: 4px; min-height: 120px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
.bar-fill { width: 100%; max-width: 32px; border-radius: 8px 8px 3px 3px; min-height: 4px; transition: height 0.5s ease; background: var(--gradient-pink-purple); box-shadow: 0 2px 8px rgba(255, 107, 157, 0.25); }
.bar-label { font-size: 10px; color: var(--color-text-muted); font-weight: 500; }

.ai-panel { width: 300px; height: 100%; display: flex; flex-direction: column; padding: 20px; gap: 16px; background: var(--color-bg-soft); border-left: 1px solid var(--color-border); flex-shrink: 0; }
.ai-header { display: flex; align-items: center; gap: 10px; }
.ai-avatar { width: 38px; height: 38px; border-radius: var(--radius-pill); background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(255, 107, 157, 0.3); }
.ai-avatar span { color: white; font-size: 12px; font-weight: 700; }
.ai-title-wrap { display: flex; flex-direction: column; gap: 1px; }
.ai-title { font-size: 14px; font-weight: 700; color: var(--color-text); }
.ai-subtitle { font-size: 11px; color: var(--color-text-tertiary); }

.api-warn-card { padding: 12px 14px; border-radius: var(--radius-md); background: rgba(231,76,60,0.08); border: 1px solid rgba(231,76,60,0.2); cursor: pointer; transition: all 0.15s; }
.api-warn-card:hover { background: rgba(231,76,60,0.12); }
.api-warn-text { font-size: 12px; color: #e74c3c; font-weight: 600; }

.summary-card { padding: 14px 16px; border-radius: var(--radius-lg); background: linear-gradient(135deg, rgba(255,107,157,0.1) 0%, rgba(183,148,246,0.1) 100%); border: 1px solid rgba(255, 192, 213, 0.5); }
.summary-label { font-size: 11px; font-weight: 600; color: var(--color-text-secondary); display: block; margin-bottom: 6px; }
.summary-text { font-size: 12px; line-height: 1.5; color: var(--color-text); }

.actions-list { display: flex; flex-direction: column; gap: 8px; }
.action-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--color-bg-soft); border: 1px solid transparent; cursor: pointer; transition: all 0.15s; }
.action-item:hover { background: var(--color-pink-light); border-color: rgba(255, 192, 213, 0.4); transform: translateX(3px); }
.action-icon { width: 28px; height: 28px; border-radius: var(--radius-pill); display: flex; align-items: center; justify-content: center; }
.action-icon.pink { background: rgba(255,107,157,0.12); }
.action-icon.blue { background: rgba(66,146,245,0.12); }
.action-label { font-size: 12px; font-weight: 500; color: var(--color-text); }

.chat-section { flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.chat-label { font-size: 11px; font-weight: 600; color: var(--color-text-tertiary); letter-spacing: 0.5px; }
.chat-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--color-bg-soft); border: 1px solid transparent; cursor: pointer; transition: all 0.15s; }
.chat-item:hover { background: var(--color-pink-light); border-color: rgba(255, 192, 213, 0.4); }
.chat-q { font-size: 12px; color: var(--color-text); line-height: 1.4; }
.empty-hint-sm { font-size: 11px; color: var(--color-text-muted); padding: 8px 12px; }

.ai-input { display: flex; align-items: center; gap: 8px; padding: 0 4px; }
.ai-input-field { flex: 1; height: 40px; padding: 0 16px; background: var(--color-white); border: 1.5px solid rgba(255, 192, 213, 0.5); border-radius: var(--radius-pill); font-size: 13px; color: var(--color-text); outline: none; transition: all 0.2s; }
.ai-input-field:focus { border-color: var(--color-pink); box-shadow: var(--shadow-glow); }
.ai-input-field::placeholder { color: var(--color-text-muted); }
.ai-send-btn { width: 40px; height: 40px; border-radius: 50%; background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-pink); flex-shrink: 0; cursor: pointer; border: none; transition: all 0.15s; }
.ai-send-btn:hover { transform: scale(1.08); box-shadow: 0 6px 16px rgba(255, 107, 157, 0.4); }
.ai-send-btn:active { transform: scale(0.95); }

/* Day 3 P1-V4：录屏超阈值告警 banner */
.quota-alert {
  margin: 10px 20px 0 20px; padding: 12px 16px; border-radius: 14px;
  background: linear-gradient(135deg, rgba(255,150,50,0.12), rgba(255,107,157,0.10));
  border: 1px solid rgba(255,150,50,0.35);
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}
.quota-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.quota-ico { font-size: 22px; flex-shrink: 0; }
.quota-title { font-size: 13px; font-weight: 700; color: var(--color-text); line-height: 1.5; }
.quota-title b { color: var(--color-pink); }
.quota-desc { font-size: 11.5px; color: var(--color-text-secondary); margin-top: 2px; line-height: 1.5; }
.quota-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.quota-btn { padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
.quota-btn.primary { background: var(--gradient-pink-purple); color: white; box-shadow: 0 3px 10px rgba(255,107,157,0.25); }
.quota-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(255,107,157,0.35); }
.quota-btn.ghost { background: rgba(255,255,255,0.7); color: var(--color-text-secondary); border-color: var(--color-border); }
.quota-btn.ghost:hover { color: var(--color-pink); border-color: var(--color-pink); }
</style>
