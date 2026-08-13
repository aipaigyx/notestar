<template>
  <div class="log-page">
    <div class="glow-orb glow-pink" style="width: 400px; height: 400px; top: 40px; left: -80px;"></div>
    <div class="glow-orb glow-purple" style="width: 420px; height: 420px; bottom: -80px; right: 100px;"></div>

    <div class="content-layer">
      <!-- 左侧：日志文件列表 -->
      <div class="log-sidebar">
        <div class="log-sidebar-header">
          <h3>日志文件</h3>
          <button class="refresh-btn" @click="loadLogFiles" title="刷新">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V3 M7 11V13 M1 7H3 M11 7H13 M2.5 2.5L4 4 M10 10L11.5 11.5 M2.5 11.5L4 10 M10 4L11.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="log-file-list">
          <div
            v-for="f in logFiles"
            :key="f.name"
            class="log-file-item"
            :class="{ active: selectedFile === f.name }"
            @click="selectFile(f.name)"
          >
            <svg class="file-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 1.5C3 0.67 3.67 0 4.5 0H10L14 4V14.5C14 15.33 13.33 16 12.5 16H4.5C3.67 16 3 15.33 3 14.5V1.5Z" fill="currentColor" opacity="0.15"/>
              <path d="M3 1.5C3 0.67 3.67 0 4.5 0H10L14 4V14.5C14 15.33 13.33 16 12.5 16H4.5C3.67 16 3 15.33 3 14.5V1.5ZM9.5 1V4H13L9.5 1Z" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
            <div class="file-info">
              <span class="file-name">{{ f.name.replace('.log', '') }}</span>
              <span class="file-meta">{{ formatSize(f.size) }} · {{ formatDate(f.mtime) }}</span>
            </div>
          </div>
          <div v-if="logFiles.length === 0" class="empty-files">暂无日志文件</div>
        </div>

        <!-- 日志级别设置 -->
        <div class="log-level-section">
          <div class="section-label">日志级别</div>
          <div class="level-buttons">
            <button
              v-for="lv in ['DEBUG', 'INFO', 'WARN', 'ERROR']"
              :key="lv"
              class="level-btn"
              :class="{ active: currentLevel === lv, [lv.toLowerCase()]: true }"
              @click="setLogLevel(lv)"
            >{{ lv }}</button>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="log-actions">
          <button class="action-btn" @click="openLogDir">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3H5L6.5 4.5H13V12H1V3Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
            打开日志目录
          </button>
          <button class="action-btn danger" @click="clearCurrentLog" :disabled="!selectedFile">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4H12 M5 4V2H9V4 M3.5 4L4.5 12H9.5L10.5 4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>
            清空当前日志
          </button>
        </div>
      </div>

      <!-- 右侧：日志内容 -->
      <div class="log-main">
        <div class="log-toolbar">
          <div class="filter-group">
            <button
              v-for="lv in ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR']"
              :key="lv"
              class="filter-btn"
              :class="{ active: filterLevel === lv, [lv.toLowerCase()]: true }"
              @click="filterLevel = lv"
            >
              {{ lv }}
              <span class="filter-count" v-if="lv !== 'ALL'">{{ countByLevel(lv) }}</span>
            </button>
          </div>

          <div class="search-group">
            <input v-model="searchText" class="search-input" placeholder="搜索日志..." />
            <label class="auto-scroll-toggle">
              <input type="checkbox" v-model="autoScroll" />
              <span>自动滚动</span>
            </label>
          </div>
        </div>

        <div class="log-content" ref="logContentRef">
          <div v-if="loadingLogs" class="log-loading">
            <div class="loading-spinner"></div>
            <p>加载日志中...</p>
          </div>

          <div v-else-if="filteredLogs.length === 0" class="log-empty">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="3" stroke="#D0D0E0" stroke-width="2"/>
                <line x1="14" y1="16" x2="34" y2="16" stroke="#D0D0E0" stroke-width="2" stroke-linecap="round"/>
                <line x1="14" y1="24" x2="28" y2="24" stroke="#D0D0E0" stroke-width="2" stroke-linecap="round"/>
                <line x1="14" y1="32" x2="30" y2="32" stroke="#D0D0E0" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p>暂无日志记录</p>
          </div>

          <div v-else class="log-lines">
            <div
              v-for="(line, i) in filteredLogs"
              :key="i"
              class="log-line"
              :class="line.level.toLowerCase()"
            >
              <span class="log-time">{{ line.timestamp }}</span>
              <span class="log-level" :style="{ color: line.levelColor }">{{ line.level }}</span>
              <span class="log-source">{{ line.source }}</span>
              <span class="log-message">{{ line.message }}</span>
              <span class="log-data" v-if="line.data">{{ line.data }}</span>
            </div>
          </div>
        </div>

        <div class="log-footer">
          <span>{{ filteredLogs.length }} / {{ allLogs.length }} 条日志</span>
          <span v-if="selectedFile">文件：{{ selectedFile }}</span>
          <span v-if="liveCount > 0" class="live-indicator">
            <span class="live-dot"></span>
            实时：{{ liveCount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { isElectron } from '../store'
import type { LogEntry, LogFileInfo, LogLevel } from '../types'

const logFiles = ref<LogFileInfo[]>([])
const selectedFile = ref('')
const allLogs = ref<LogEntry[]>([])
const liveLogs = ref<LogEntry[]>([]) // 实时推送的日志
const loadingLogs = ref(false)
const filterLevel = ref('ALL')
const searchText = ref('')
const autoScroll = ref(true)
const currentLevel = ref('INFO')
const liveCount = ref(0)
const logContentRef = ref<HTMLElement | null>(null)

// 合并文件日志 + 实时日志
const combinedLogs = computed(() => {
  if (liveLogs.value.length > 0) {
    return [...allLogs.value, ...liveLogs.value]
  }
  return allLogs.value
})

const filteredLogs = computed(() => {
  let result = combinedLogs.value
  if (filterLevel.value !== 'ALL') {
    result = result.filter(l => l.level === filterLevel.value)
  }
  if (searchText.value.trim()) {
    const q = searchText.value.toLowerCase()
    result = result.filter(l =>
      l.message.toLowerCase().includes(q) ||
      l.source.toLowerCase().includes(q) ||
      (l.data && l.data.toLowerCase().includes(q))
    )
  }
  return result
})

const countByLevel = (level: string) => combinedLogs.value.filter(l => l.level === level).length

const loadLogFiles = async () => {
  if (!isElectron) return
  try {
    logFiles.value = await window.noteAPI.logGetFiles()
    // 自动选中今天的日志
    if (logFiles.value.length > 0 && !selectedFile.value) {
      selectedFile.value = logFiles.value[0].name
      await loadLogContent()
    }
  } catch (e) {
    console.error('加载日志文件列表失败:', e)
  }
}

const selectFile = async (fileName: string) => {
  selectedFile.value = fileName
  liveLogs.value = []
  liveCount.value = 0
  await loadLogContent()
}

const loadLogContent = async () => {
  if (!isElectron || !selectedFile.value) return
  loadingLogs.value = true
  try {
    const result = await window.noteAPI.logRead(selectedFile.value)
    allLogs.value = result.lines || []
  } catch (e) {
    console.error('加载日志内容失败:', e)
    allLogs.value = []
  } finally {
    loadingLogs.value = false
    if (autoScroll.value) {
      await nextTick()
      scrollToBottom()
    }
  }
}

const clearCurrentLog = async () => {
  if (!isElectron || !selectedFile.value) return
  const ok = await window.noteAPI.logClear(selectedFile.value)
  if (ok) {
    allLogs.value = []
    liveLogs.value = []
    liveCount.value = 0
  }
}

const setLogLevel = async (level: string) => {
  currentLevel.value = level
  if (isElectron) {
    await window.noteAPI.logSetLevel(level as LogLevel)
  }
}

const openLogDir = async () => {
  if (isElectron) await window.noteAPI.logOpenDir()
}

const scrollToBottom = () => {
  if (logContentRef.value) {
    logContentRef.value.scrollTop = logContentRef.value.scrollHeight
  }
}

// 实时日志监听
let logEntryCleanup: (() => void) | null = null

const setupLiveLog = () => {
  if (!isElectron) return
  logEntryCleanup = window.noteAPI.onLogEntry((entry: LogEntry) => {
    liveLogs.value.push(entry)
    liveCount.value++
    // 保持最多500条实时日志
    if (liveLogs.value.length > 500) {
      liveLogs.value = liveLogs.value.slice(-500)
    }
    if (autoScroll.value) {
      nextTick(() => scrollToBottom())
    }
  })
}

// 监听筛选变化时自动滚动
watch([filterLevel, searchText], () => {
  if (autoScroll.value) {
    nextTick(() => scrollToBottom())
  }
})

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  loadLogFiles()
  setupLiveLog()
})

onUnmounted(() => {
  logEntryCleanup?.()
})
</script>

<style scoped>
.log-page { width: 100%; height: 100%; position: relative; overflow: hidden; background: var(--color-bg); }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; }

/* 左侧侧边栏 */
.log-sidebar { width: 260px; height: 100%; display: flex; flex-direction: column; background: rgba(255,255,255,0.6); border-right: 1px solid var(--color-border); flex-shrink: 0; }
.log-sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 16px 12px; }
.log-sidebar-header h3 { font-size: 15px; font-weight: 700; color: var(--color-text); }
.refresh-btn { width: 28px; height: 28px; border: 1px solid var(--color-border); border-radius: 6px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary); }
.refresh-btn:hover { background: var(--color-bg-soft); color: var(--color-pink); }

.log-file-list { flex: 1; overflow-y: auto; padding: 0 12px; display: flex; flex-direction: column; gap: 4px; }
.log-file-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.15s; color: var(--color-text-muted); }
.log-file-item:hover { background: var(--color-bg-soft); color: var(--color-text-secondary); }
.log-file-item.active { background: var(--color-pink-light); color: var(--color-pink); }
.log-file-item.active .file-icon { color: var(--color-pink); }
.file-icon { flex-shrink: 0; color: var(--color-text-muted); }
.file-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.file-name { font-size: 12px; font-weight: 600; }
.file-meta { font-size: 10px; color: var(--color-text-muted); }
.empty-files { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 20px 0; }

/* 日志级别设置 */
.log-level-section { padding: 16px; border-top: 1px solid var(--color-border); }
.section-label { font-size: 11px; font-weight: 600; color: var(--color-text-tertiary); margin-bottom: 8px; }
.level-buttons { display: flex; gap: 4px; flex-wrap: wrap; }
.level-btn { height: 26px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 11px; font-weight: 600; background: transparent; cursor: pointer; color: var(--color-text-muted); transition: all 0.15s; }
.level-btn:hover { opacity: 0.8; }
.level-btn.active.debug { background: rgba(155,155,181,0.15); border-color: #9B9BB5; color: #6B6B8A; }
.level-btn.active.info { background: rgba(66,146,245,0.12); border-color: #4292F5; color: #4292F5; }
.level-btn.active.warn { background: rgba(243,156,18,0.12); border-color: #F39C12; color: #F39C12; }
.level-btn.active.error { background: rgba(231,76,60,0.12); border-color: #E74C3C; color: #E74C3C; }

/* 操作按钮 */
.log-actions { padding: 12px 16px; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 8px; }
.action-btn { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 12px; background: transparent; cursor: pointer; color: var(--color-text-secondary); transition: all 0.15s; }
.action-btn:hover { background: var(--color-bg-soft); }
.action-btn.danger:hover { border-color: #e74c3c; color: #e74c3c; background: rgba(231,76,60,0.06); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 右侧主区域 */
.log-main { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; }

/* 工具栏 */
.log-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid rgba(255,192,213,0.35); flex-shrink: 0; }
.filter-group { display: flex; gap: 4px; }
.filter-btn { height: 28px; padding: 0 12px; border: 1px solid rgba(255,192,213,0.45); border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; background: transparent; cursor: pointer; color: var(--color-text-muted); transition: all 0.15s; display: flex; align-items: center; gap: 4px; }
.filter-btn:hover { border-color: var(--color-pink); color: var(--color-pink); }
.filter-btn.active { border-color: var(--color-pink); color: var(--color-pink); background: var(--color-pink-light); }
.filter-btn.active.debug { border-color: #9B9BB5; color: #6B6B8A; background: rgba(155,155,181,0.15); }
.filter-btn.active.info { border-color: #4292F5; color: #4292F5; background: rgba(66,146,245,0.12); }
.filter-btn.active.warn { border-color: #F39C12; color: #F39C12; background: rgba(243,156,18,0.12); }
.filter-btn.active.error { border-color: #E74C3C; color: #E74C3C; background: rgba(231,76,60,0.12); }
.filter-count { font-size: 10px; background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: var(--radius-pill); }

.search-group { display: flex; align-items: center; gap: 12px; }
.search-input { width: 240px; height: 30px; padding: 0 12px; background: rgba(255,255,255,0.85); border: 1.5px solid rgba(255,192,213,0.5); border-radius: var(--radius-pill); font-size: 12px; color: var(--color-text); outline: none; transition: all 0.15s; }
.search-input:focus { border-color: var(--color-pink); box-shadow: var(--shadow-glow); }
.auto-scroll-toggle { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-secondary); cursor: pointer; white-space: nowrap; }
.auto-scroll-toggle input { cursor: pointer; }

/* 日志内容区 */
.log-content { flex: 1; overflow-y: auto; padding: 12px 20px; font-family: 'JetBrains Mono', 'Consolas', 'Monaco', 'Microsoft YaHei', monospace; }
.log-loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0; }
.log-loading p { font-size: 12px; color: var(--color-text-muted); }
.loading-spinner { width: 28px; height: 28px; border: 3px solid rgba(255,192,213,0.4); border-top-color: var(--color-pink); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.log-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 0; }
.log-empty p { font-size: 13px; color: var(--color-text-muted); }

.log-lines { display: flex; flex-direction: column; gap: 2px; }
.log-line { display: flex; align-items: flex-start; gap: 8px; padding: 4px 8px; border-radius: 6px; font-size: 12px; line-height: 1.6; transition: background 0.1s; }
.log-line:hover { background: rgba(0,0,0,0.02); }
.log-line.error { background: rgba(231,76,60,0.04); }
.log-line.error:hover { background: rgba(231,76,60,0.08); }
.log-line.warn { background: rgba(243,156,18,0.03); }

.log-time { color: var(--color-text-muted); flex-shrink: 0; min-width: 170px; }
.log-level { font-weight: 700; flex-shrink: 0; min-width: 50px; }
.log-source { color: #9B59B6; flex-shrink: 0; min-width: 60px; font-weight: 600; }
.log-message { color: var(--color-text); flex: 1; word-break: break-word; }
.log-data { color: var(--color-text-muted); font-size: 11px; word-break: break-word; max-width: 400px; }

/* 底部状态栏 */
.log-footer { display: flex; align-items: center; gap: 16px; padding: 8px 20px; border-top: 1px solid var(--color-border); font-size: 11px; color: var(--color-text-muted); flex-shrink: 0; }
.live-indicator { display: flex; align-items: center; gap: 6px; color: #26D0A8; font-weight: 600; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: #26D0A8; animation: pulse-green 1.5s infinite; }
@keyframes pulse-green { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
