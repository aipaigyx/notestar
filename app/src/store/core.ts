// ========== Store 核心层（叶子） ==========
// 职责：顶层响应式 refs、渲染工具(marked/katex)、Electron 桥接工具、数据加载、
// 卡片背景、设置/头像、文件导入、统计、数据管理、前端日志、模块级副作用。
// 依赖规则：core 只消费 refs + window.noteAPI，**不 import** notes/ai/quiz 任何函数（保证无环）。
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import katex from 'katex'
import type { Note, Course, ChatSession, Stats, Settings, ImportedFile, NoteAnalysis, LogLevel } from '../types'

// 配置 marked — 允许 data: URI 图片渲染
marked.setOptions({ breaks: true, gfm: true })
// 覆盖 renderer 以允许 data: URI 图片（默认 sanitizer 会过滤）
// 注意：必须用 marked.use({ renderer: { image: fn } }) 官方形式（marked v12+）。
// 用 new marked.Renderer() + 覆盖 .image 方法会损坏内部 parser，导致含图片的笔记
// 渲染时抛 "Cannot read properties of undefined (reading 'parseInline')"，
// 进而 Vue v-html 渲染异常中断 → 整页白屏（2026-08-14 定位修复）。
marked.use({
  renderer: {
    image: (token: any) => {
      const { href, title, text } = token
      // 允许 data:image/svg+xml 格式的图片
      if (typeof href === 'string' && href.startsWith('data:image/svg+xml')) {
        return `<img src="${href}" alt="${text || ''}" title="${title || ''}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin:12px 0;" />`
      }
      // 默认 <img> 渲染（手动实现，避免依赖 renderer 实例内部状态）
      // 加自适应样式：max-width:100% 防止大图超出预览区
      let out = `<img src="${href}" alt="${text || ''}" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:8px 0;"`
      if (title) out += ` title="${title}"`
      return out + '>'
    },
  },
})

// Markdown 渲染工具函数（支持 LaTeX 公式：$$块级$$ 与 $行内$，经 KaTeX 渲染）
export function renderMarkdown(text: string): string {
  if (!text) return ''
  try {
    return renderMarkdownInner(text)
  } catch (e) {
    // 兜底：任何 Markdown 渲染异常都不能导致页面白屏（v-html 绑定抛错会中断 Vue 渲染）
    console.error('[Markdown] 渲染失败，已降级为纯文本', e)
    return `<pre style="white-space:pre-wrap;color:#555">${String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
  }
}

function renderMarkdownInner(text: string): string {
  // 外置图片引用：images/xxx.png → notestar-img://xxx.png（Electron 下经自定义协议加载）
  let processed = text
  if (typeof window !== 'undefined' && window.noteAPI) {
    processed = processed.replace(/!\[([^\]]*)\]\((images\/[^)]+)\)/g, (_m, alt: string, src: string) =>
      `![${alt}](notestar-img://${src.replace('images/', '')})`
    )
  }
  // 先提取公式为占位符，避免 marked 破坏 LaTeX 语法；渲染后再还原为 KaTeX HTML
  const katexBlocks: { ph: string; html: string }[] = []
  let counter = 0
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_m, latex: string) => {
    const ph = `KATEXPH${counter++}K`
    let html: string
    try {
      html = katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false })
    } catch {
      html = `<code>${latex.trim()}</code>`
    }
    katexBlocks.push({ ph, html })
    return ph
  })
  processed = processed.replace(/(^|[^$])\$([^$\n]+?)\$(?![$])/g, (_m, pre: string, latex: string) => {
    const ph = `KATEXPH${counter++}K`
    let html: string
    try {
      html = katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false })
    } catch {
      html = `<code>${latex.trim()}</code>`
    }
    katexBlocks.push({ ph, html })
    return pre + ph
  })
  let html = marked.parse(processed) as string
  for (const { ph, html: katexHtml } of katexBlocks) {
    html = html.split(ph).join(katexHtml)
  }
  return html
}

// 检测是否在 Electron 环境中（原本为模块私有，拆分后供 notes/ai/quiz 引用）
export const hasElectron = typeof window !== 'undefined' && !!window.noteAPI

// 图片外置存储：base64 落盘为文件，返回相对引用 images/xxx.png；浏览器模式原样返回 dataUri
export async function saveImage(dataUri: string): Promise<string> {
  if (hasElectron) {
    return await window.noteAPI.saveImage(dataUri)
  }
  return dataUri
}

// 图片相对引用 → 可直接用于 <img>/CSS 的 URL（Electron 走 notestar-img 协议，浏览器模式原样 dataUri）
export function resolveImageUrl(ref: string): string {
  if (!ref) return ''
  if (ref.startsWith('data:')) return ref
  if (ref.startsWith('http')) return ref
  if (hasElectron) {
    return 'notestar-img://' + ref.replace('images/', '')
  }
  return ref
}

// 实时屏幕截图：列出屏幕/窗口（截屏选择面板用）
export async function listScreenSources() {
  if (hasElectron) return await window.noteAPI.listScreenSources()
  return []
}
// 截取指定窗口或活动窗口画面
export async function captureScreen(opts: { sourceId?: string; mode?: 'source' | 'foreground' }) {
  if (hasElectron) return await window.noteAPI.captureScreen(opts)
  throw new Error('浏览器模式不支持截屏')
}

// 笔记导出（Markdown/HTML）：noteIds 单篇多篇，或 courseId 整课；HTML 模式可附 AI 分析结果
export async function exportNotes(opts: { noteIds?: string[]; courseId?: string; format?: 'md' | 'html'; analysisMap?: Record<string, NoteAnalysis> }): Promise<string | null> {
  if (hasElectron) {
    return await window.noteAPI.exportNotes(opts)
  }
  return null // 浏览器模式不支持本地导出
}

// 一键备份（自动命名，保留最近 7 份）
export async function backupData(): Promise<string | null> {
  if (hasElectron) return await window.noteAPI.backupData()
  return null
}
// 备份信息（含是否超过 7 天未备份）
export async function getBackupInfo(): Promise<{ lastBackupAt?: string; backupDir?: string; overdue: boolean }> {
  if (hasElectron) return await window.noteAPI.getBackupInfo()
  return { overdue: true }
}

// ========== 响应式状态 ==========
export const notes = ref<Note[]>([])
export const courses = ref<Course[]>([])
export const chatSessions = ref<ChatSession[]>([])
export const stats = ref<Stats | null>(null)
export const settings = ref<Settings>({ apiKey: '', model: 'deepseek-chat', provider: 'deepseek' })
export const currentNote = ref<Note | null>(null)
export const currentCourseId = ref<string>('')
export const currentChatSession = ref<ChatSession | null>(null)
export const isDataLoaded = ref(false)
export const isElectron = hasElectron
// 悬浮球/语音等后台创建新笔记后通知主窗口跳转的跨组件暂存：
// - App.vue 常驻，收到主进程 notes:open 把 id 存这里，并 router.push('/organize')
// - NoteOrganize 组件 watch 这个 ref（immediate:true），只要有值且组件挂载时就选中该笔记
//   （解决：用户在 /settings 等其他路由时，NoteOrganize 未挂载 → onNotesOpen 监听不存在导致跳转失效）
export const pendingNoteOpen = ref<string | null>(null)

// ========== P0-1 修复：浏览器模式 → 桌面版 数据迁移 ==========
// 说明：用户在浏览器模式（npm run dev）写了笔记后，切桌面版（Electron）看不到 → 以为"笔记全不见了"
// 这里检测 localStorage 是否有未迁移的浏览器数据，交由 Dashboard 弹确认框，用户确认后一键导入。
export const localStorageMigrationNeed = ref<null | { notes: number; courses: number; chats: number; statsMinutes: number }>(null)
const LS_MIGRATION_MARKER = 'notestar_migrated_to_electron_at'
const STATS_EMPTY: Stats = { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0, 0, 0, 0, 0, 0, 0], mastery: [] }

function safeLS<T = any>(key: string, def: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def }
}

// 仅在 Electron 模式下，数据加载完毕后触发一次检查
function checkLocalStorageMigration() {
  if (!hasElectron) return
  if (localStorage.getItem(LS_MIGRATION_MARKER)) return                     // 已迁移过，不再提示
  const lsNotes = safeLS<Note[]>('notes', [])
  const lsCourses = safeLS<Course[]>('courses', [])
  const lsChats = safeLS<ChatSession[]>('chatSessions', [])
  const lsStats = safeLS<Stats>('stats', STATS_EMPTY)
  if (lsNotes.length === 0 && lsCourses.length === 0 && lsChats.length === 0) return // 浏览器池本来空
  const fileNotesEmpty = notes.value.length === 0
  // 只要 localStorage 有数据，且文件笔记数 < 浏览器笔记数（或文件是空的），就提示迁移
  if (fileNotesEmpty || lsNotes.length > notes.value.length) {
    localStorageMigrationNeed.value = {
      notes: lsNotes.length,
      courses: lsCourses.length,
      chats: lsChats.length,
      statsMinutes: lsStats?.totalStudyMinutes || 0,
    }
  }
}

// 执行迁移：把 localStorage 的浏览器数据逐条写入 Electron JSON 文件
// 策略：按 id 去重（相同 id 保留最新 updatedAt）；新增的课程 id/courseId 关联不丢失
export async function migrateFromLocalStorageAndClear(): Promise<{ added: number; skipped: number }> {
  if (!hasElectron) return { added: 0, skipped: 0 }
  const api = window.noteAPI
  const lsNotes = safeLS<Note[]>('notes', [])
  const lsCourses = safeLS<Course[]>('courses', [])
  const lsChats = safeLS<ChatSession[]>('chatSessions', [])
  const lsStats = safeLS<Stats>('stats', STATS_EMPTY)

  const existingNoteIds = new Set((await api.getNotes()).map(n => n.id))
  const existingCourseIds = new Set((await api.getCourses()).map(c => c.id))
  let added = 0, skipped = 0

  // 1. 先写课程（因为笔记的 courseId 关联课程）
  for (const c of lsCourses) {
    if (existingCourseIds.has(c.id)) { skipped++; continue }
    await api.saveCourse(c)
    added++
  }

  // 2. 再写笔记
  for (const n of lsNotes) {
    if (existingNoteIds.has(n.id)) { skipped++; continue }
    await api.saveNote(n)
    added++
  }

  // 3. 再写对话
  const existingChatIds = new Set((await api.getChatSessions()).map(s => s.id))
  for (const cs of lsChats) {
    if (existingChatIds.has(cs.id)) { skipped++; continue }
    await api.saveChatSession(cs)
    added++
  }

  // 4. 统计时长：若主进程统计总时长 < 浏览器，累加差异
  if (lsStats?.totalStudyMinutes) {
    const curStats = await api.getStats()
    const diff = lsStats.totalStudyMinutes - (curStats?.totalStudyMinutes || 0)
    if (diff > 0) await api.addStudyTime(diff)
  }

  // 标记已迁移，不删浏览器数据（留一份兜底，防止用户还开着 Vite 模式）
  localStorage.setItem(LS_MIGRATION_MARKER, new Date().toISOString())
  localStorageMigrationNeed.value = null

  // 全量刷新前端内存，让 Dashboard 立即看到迁移后的数据
  await loadAllData()
  return { added, skipped }
}

// 每次 notes 数组整体刷新后（loadAllData / notes:changed 广播），
// 把 currentNote.value 同步成新数组里的同 id 对象——否则编辑器 v-model 绑定的仍是旧对象，
// 导致悬浮球 appendEntry 后台追加的图片/标记段写入 notes.json 了，但编辑器显示不出来。
function syncCurrentNoteToNotes() {
  if (!currentNote.value?.id) return
  const fresh = (notes.value || []).find(n => n.id === currentNote.value!.id)
  if (fresh && fresh !== currentNote.value) {
    currentNote.value = fresh
  }
}

// ========== 前端日志工具 ==========
// 将前端日志通过 IPC 转发到主进程统一记录到文件
// 注意：IPC 数据必须可被 structuredClone，Vue Proxy / Error 对象不可克隆
// 统一用 try-catch + JSON 序列化确保 data 为纯对象
function safeSerialize(data?: any): string | null {
  if (data === undefined || data === null) return null
  try {
    // 对 Error 对象特殊处理
    if (data instanceof Error) {
      return JSON.stringify({ message: data.message, stack: data.stack, name: data.name })
    }
    // 尝试 JSON 序列化（会自动剥离 Vue Proxy）
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

export const frontendLogger = {
  debug: (source: string, message: string, data?: any) => {
    console.debug(`[${source}] ${message}`, data || '')
    if (hasElectron) window.noteAPI.logWrite('DEBUG', source, message, safeSerialize(data))
  },
  info: (source: string, message: string, data?: any) => {
    console.log(`[${source}] ${message}`, data || '')
    if (hasElectron) window.noteAPI.logWrite('INFO', source, message, safeSerialize(data))
  },
  warn: (source: string, message: string, data?: any) => {
    console.warn(`[${source}] ${message}`, data || '')
    if (hasElectron) window.noteAPI.logWrite('WARN', source, message, safeSerialize(data))
  },
  error: (source: string, message: string, data?: any) => {
    console.error(`[${source}] ${message}`, data || '')
    if (hasElectron) window.noteAPI.logWrite('ERROR', source, message, safeSerialize(data))
  },
}

// ========== 数据加载 ==========
export async function loadAllData() {
  if (hasElectron) {
    try {
      const [n, c, s, st] = await Promise.all([
        window.noteAPI.getNotes(),
        window.noteAPI.getCourses(),
        window.noteAPI.getChatSessions(),
        window.noteAPI.getStats(),
      ])
      notes.value = n
      courses.value = c
      chatSessions.value = s
      stats.value = st
      settings.value = await window.noteAPI.getSettings()
      syncCurrentNoteToNotes() // ✅ 重载后立刻刷新当前编辑对象
    } catch (err) {
      frontendLogger.error('Store', '数据加载失败', err)
    }
  } else {
    // 浏览器模式：从 localStorage 读取，没有就是空
    notes.value = JSON.parse(localStorage.getItem('notes') || '[]')
    courses.value = JSON.parse(localStorage.getItem('courses') || '[]')
    chatSessions.value = JSON.parse(localStorage.getItem('chatSessions') || '[]')
    stats.value = JSON.parse(localStorage.getItem('stats') || '{"totalStudyMinutes":0,"streakDays":0,"lastStudyDate":"","weeklyMinutes":[0,0,0,0,0,0,0],"mastery":[]}')
    settings.value = JSON.parse(localStorage.getItem('settings') || '{"apiKey":"","model":"deepseek-chat","provider":"deepseek"}')
    // 归一化：apiKey 恒 = 当前 provider 的独立 key（兼容旧单 key 数据）
    const s0 = settings.value
    const k0 = (s0.apiKeys && s0.apiKeys[s0.provider]) || s0.apiKey || ''
    settings.value = { ...s0, apiKey: k0 }
    syncCurrentNoteToNotes()
  }
  applyCardBackgroundVar(settings.value)
  isDataLoaded.value = true
  // ✅ P0-1：在 isDataLoaded 置 true 后检查（确保 notes/courses 已更新，避免误判迁移）
  checkLocalStorageMigration()
}

// ========== 轻量数据保鲜 ==========
// 只刷新 stats / notes / courses，不重设 settings、不打断编辑器当前对象。
// 供各页面 onMounted 时调用，解决"笔记/时长改动后主页面统计卡不跟新"。
export async function refreshDashboardData(): Promise<void> {
  if (!hasElectron) {
    // 浏览器模式：stats 已在 localStorage，仅确保 ref 非空
    if (!stats.value) {
      stats.value = JSON.parse(localStorage.getItem('stats') || '{"totalStudyMinutes":0,"streakDays":0,"lastStudyDate":"","weeklyMinutes":[0,0,0,0,0,0,0],"mastery":[]}')
    }
    return
  }
  try {
    const [n, c, st] = await Promise.all([
      window.noteAPI.getNotes(),
      window.noteAPI.getCourses(),
      window.noteAPI.getStats(),
    ])
    notes.value = n
    courses.value = c
    stats.value = st
    syncCurrentNoteToNotes()
  } catch (err) {
    frontendLogger.error('Store', '轻量数据刷新失败', err)
  }
}

// 全局快捷键/悬浮球在后台创建笔记后，自动刷新数据（notes:changed 事件）
// 注意：模块级副作用，必须在 core 首次加载时执行（barrel 中 core 排第一）。
if (hasElectron && window.noteAPI.onNotesChanged) {
  window.noteAPI.onNotesChanged(() => { loadAllData() })
}
// 双保险：任何时候 notes 数组变动（包括 NotesOrganize 本地保存替换、loadAllData 全量替换），
// 都把 currentNote.value 同步成新数组里的同 id 对象，保证编辑器永远显示最新内容。
watch(notes, () => { syncCurrentNoteToNotes() }, { flush: 'post' })

// ========== 设置（卡片背景） ==========
// 卡片背景分组键（卡片区域）
export type CardBgGroup = 'all' | 'dashboard' | 'notes'
// 规范化的分组结构（所有键必填非空）
export interface CardBgState {
  all: string | null
  dashboard: string | null
  notes: string | null
  veil: number
}

// 内置背景预设（id → 名称 + CSS 渐变/图案，零资产成本）
// 每种同时给出深色系配色，保证与 omphalos 紫金底色协调
export const CARD_BG_PRESETS: { id: string; name: string; css: string }[] = [
  { id: 'ochema-dawn',  name: '奥赫玛黎明', css: 'radial-gradient(120% 90% at 85% 0%, rgba(245,199,106,0.50) 0%, rgba(196,68,31,0.10) 45%, transparent 70%), linear-gradient(150deg, #241A4A 0%, #3A2B22 100%)' },
  { id: 'eternal-night', name: '永夜星空', css: 'radial-gradient(90% 70% at 20% 10%, rgba(139,92,246,0.42) 0%, transparent 60%), linear-gradient(150deg, #141031 0%, #0B1230 100%)' },
  { id: 'blood-oath',   name: '神血红誓', css: 'radial-gradient(110% 80% at 15% 100%, rgba(196,68,31,0.45) 0%, transparent 62%), linear-gradient(150deg, #2A1220 0%, #241A4A 100%)' },
  { id: 'golden-meadow', name: '金穗原野', css: 'radial-gradient(100% 75% at 80% 90%, rgba(245,199,106,0.35) 0%, transparent 58%), linear-gradient(150deg, #1E1440 0%, #3A2A18 100%)' },
  { id: 'violet-abyss', name: '紫渊深谷', css: 'radial-gradient(120% 100% at 50% 0%, rgba(139,92,246,0.35) 0%, transparent 55%), linear-gradient(160deg, #1A1140 0%, #241A4A 100%)' },
  { id: 'ivory-temple', name: '象牙神殿', css: 'radial-gradient(110% 80% at 90% 10%, rgba(245,199,106,0.28) 0%, transparent 60%), linear-gradient(150deg, #33281A 0%, #241A3A 100%)' },
]

// 默认 veil（遮罩强度）
export const CARD_BG_DEFAULT_VEIL = 0.62

// 兼容迁移：旧版 cardBackground 字段 → cardBackgrounds.all；同时补默认 veil
export function normalizeCardBackgrounds(s: Settings): CardBgState {
  const old = s.cardBackground
  const cur = (s.cardBackgrounds && typeof s.cardBackgrounds === 'object') ? s.cardBackgrounds : {}
  const out: CardBgState = {
    all: (cur.all !== undefined ? cur.all : null),
    dashboard: (cur.dashboard !== undefined ? cur.dashboard : null),
    notes: (cur.notes !== undefined ? cur.notes : null),
    veil: (typeof cur.veil === 'number' ? cur.veil : CARD_BG_DEFAULT_VEIL),
  }
  // 旧单图字段尚未迁移到 all，且 all 目前为空 → 迁入
  if (old && !out.all) {
    out.all = old
  }
  return out
}

// 取某个分组生效的背景引用（分组未设 → 回落 all；all 未设 → 无）
export function resolveCardBgRef(s: Settings, group: CardBgGroup): string {
  const c = normalizeCardBackgrounds(s)
  if (group !== 'all' && c[group]) return c[group] as string
  if (c.all) return c.all as string
  return ''
}

// 设置某分组背景图（选图上传）
export async function setCardBackground(group: CardBgGroup = 'all'): Promise<{ ok: boolean; ref?: string; error?: string }> {
  try {
    const picked = await selectImage()
    if (!picked) return { ok: false, error: 'cancelled' }
    const ref = await saveImage(picked.dataUri)
    const c = normalizeCardBackgrounds(settings.value)
    c[group] = ref
    const next = { ...settings.value, cardBackground: undefined, cardBackgrounds: c }
    delete (next as any).cardBackground // 迁移完成后清掉旧字段（保持 JSON 干净）
    await saveSettings(next)
    return { ok: true, ref }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}
// 清除某分组背景
export async function clearCardBackground(group: CardBgGroup = 'all'): Promise<boolean> {
  const c = normalizeCardBackgrounds(settings.value)
  c[group] = null
  await saveSettings({ ...settings.value, cardBackgrounds: c })
  return true
}
// 设为内置预设（group 传 'preset' 表示应用到当前编辑分组——由调用方先 resolve 好 group）
export async function applyCardBgPreset(group: CardBgGroup, presetId: string): Promise<boolean> {
  const c = normalizeCardBackgrounds(settings.value)
  c[group] = presetId // 存的是内置预设 id，由 resolveImageUrl 无法识别 → 用单独函数识别
  await saveSettings({ ...settings.value, cardBackgrounds: c })
  return true
}
// 遮罩强度滑块
export async function setCardBgVeil(v: number): Promise<boolean> {
  const c = normalizeCardBackgrounds(settings.value)
  c.veil = Math.min(0.85, Math.max(0.3, v))
  await saveSettings({ ...settings.value, cardBackgrounds: c })
  return true
}
// 判断引用是内置预设 id 还是图片引用
export function isPresetRef(ref: string): boolean {
  return CARD_BG_PRESETS.some(p => p.id === ref)
}
// 把任意引用转成可显示的 URL（内置预设 → '' 表示用 CSS 渐变，图片 → resolveImageUrl）
export function cardBgToCssValue(ref: string): string {
  if (!ref) return 'none'
  if (isPresetRef(ref)) {
    const p = CARD_BG_PRESETS.find(x => x.id === ref)
    return p ? p.css : 'none'
  }
  const url = resolveImageUrl(ref)
  return url ? `url("${url}")` : 'none'
}

// 把卡片背景分组同步成 CSS 变量：每组一个 enabled 标志 + 背景值，veil 全局
// 变量形如 --om-card-bg-<group> / --om-card-bg-<group>-enabled / --om-card-veil
// 每组取"最终生效值"（resolveCardBgRef 已做 分组未设→回落 all），保证 CSS 单规则即可
function applyCardBackgroundVar(s: Settings) {
  if (typeof document === 'undefined') return
  const c = normalizeCardBackgrounds(s)
  const groups: { key: CardBgGroup; g: 'all' | 'dashboard' | 'notes' }[] = [
    { key: 'all', g: 'all' },
    { key: 'dashboard', g: 'dashboard' },
    { key: 'notes', g: 'notes' },
  ]
  for (const { key, g } of groups) {
    const ref = (g === 'all' ? (c.all || '') : resolveCardBgRef(s, g))
    const val = cardBgToCssValue(ref)
    document.documentElement.style.setProperty(`--om-card-bg-${key}`, val)
    document.documentElement.style.setProperty(`--om-card-bg-${key}-enabled`, ref ? '1' : '0')
  }
  // 遮罩强度（0.3~0.85）作为 alpha 传 CSS：顶部 hi，底部 lo = hi - 0.12
  const veil = (typeof c.veil === 'number' ? c.veil : CARD_BG_DEFAULT_VEIL)
  document.documentElement.style.setProperty('--om-card-veil', String(veil))
  document.documentElement.style.setProperty('--om-card-veil-hi', String(veil))
  document.documentElement.style.setProperty('--om-card-veil-lo', String(Math.max(0.25, veil - 0.12)))
  // 兼容：旧变量也同步一份（all 组），旧 CSS 若仍引用不失效
  const allVal = cardBgToCssValue(c.all || '')
  document.documentElement.style.setProperty('--om-card-bg', allVal)
  document.documentElement.style.setProperty('--om-card-bg-enabled', (c.all || '') ? '1' : '0')
}

export async function saveSettings(s: Settings) {
  settings.value = s
  applyCardBackgroundVar(s)
  if (hasElectron) {
    // 深拷贝为纯对象，避免 Vue Proxy 无法被 IPC structuredClone
    const plainSettings = JSON.parse(JSON.stringify(s))
    await window.noteAPI.saveSettings(plainSettings)
  } else {
    localStorage.setItem('settings', JSON.stringify(s))
  }
}

// ========== 用户资料（侧栏头像/昵称） ==========
// 默认昵称（用户未自定义时使用）
export const DEFAULT_USER_NAME = '开拓者'
// 昵称 → settings.userProfile.name
export async function setUserName(name: string): Promise<void> {
  const clean = (name || '').trim().slice(0, 12) || DEFAULT_USER_NAME
  await saveSettings({
    ...settings.value,
    userProfile: { ...(settings.value.userProfile || {}), name: clean },
  })
}
// 选择并保存头像 → settings.userProfile.avatar
export async function setUserAvatar(): Promise<{ ok: boolean; ref?: string; error?: string }> {
  try {
    const picked = await selectImage()
    if (!picked) return { ok: false, error: 'cancelled' }
    const ref = await saveImage(picked.dataUri)
    await saveSettings({
      ...settings.value,
      userProfile: { ...(settings.value.userProfile || {}), avatar: ref },
    })
    return { ok: true, ref }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}
// 移除自定义头像 → 回落到默认首字 / public 图
export async function clearUserAvatar(): Promise<void> {
  await saveSettings({
    ...settings.value,
    userProfile: { ...(settings.value.userProfile || {}), avatar: null },
  })
}

// ========== 文件导入 ==========
export async function importFiles(): Promise<ImportedFile[] | null> {
  if (hasElectron) {
    return await window.noteAPI.importFiles()
  }
  return null
}

// ========== 图片选择（返回 data URI） ==========
export async function selectImage(): Promise<{ name: string; dataUri: string; size: number } | null> {
  if (hasElectron) {
    return await window.noteAPI.selectImage()
  }
  return null
}

// ========== 读取剪贴板图片 ==========
export async function readClipboardImage(): Promise<{ name: string; dataUri: string; size: number } | null> {
  if (hasElectron) {
    return await window.noteAPI.readClipboardImage()
  }
  return null
}

// ========== 工具函数 ==========
export function getCurrentTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ========== 学习时间记录 ==========
export async function addStudyTime(minutes: number) {
  if (hasElectron) {
    try {
      stats.value = await window.noteAPI.addStudyTime(minutes)
    } catch (err) {
      frontendLogger.error('Store', '学习时间记录失败', err)
    }
  } else {
    if (!stats.value) stats.value = { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] }
    stats.value.totalStudyMinutes += minutes
    const today = new Date().getDay()
    const dayIndex = today === 0 ? 6 : today - 1
    stats.value.weeklyMinutes[dayIndex] = (stats.value.weeklyMinutes[dayIndex] || 0) + minutes
    // 连续打卡（本地时区，与主进程逻辑一致）
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const todayStr = fmtLocal(new Date())
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const yStr = fmtLocal(yesterday)
    if (stats.value.lastStudyDate !== todayStr) {
      if (stats.value.lastStudyDate === yStr) {
        stats.value.streakDays = (stats.value.streakDays || 0) + 1
      } else {
        stats.value.streakDays = 1
      }
      stats.value.lastStudyDate = todayStr
    }
    localStorage.setItem('stats', JSON.stringify(stats.value))
  }
}

// ========== 学习计划：设置每日目标（分钟） ==========
export async function setPlan(dailyMinutes: number) {
  if (hasElectron) {
    stats.value = await window.noteAPI.setPlan(dailyMinutes)
  } else {
    if (!stats.value) stats.value = { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] }
    stats.value.plan = { dailyMinutes: Math.max(10, Math.min(600, dailyMinutes)) }
    localStorage.setItem('stats', JSON.stringify(stats.value))
  }
}

// ========== 数据导出/导入/清空 ==========
export async function exportData(): Promise<string | null> {
  if (hasElectron) {
    return await window.noteAPI.exportData()
  } else {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      notes: notes.value,
      courses: courses.value,
      chatSessions: chatSessions.value,
      stats: stats.value,
      settings: settings.value,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notestar-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    return 'downloaded'
  }
}

export async function importData(): Promise<{ success: boolean; notes: number; courses: number } | null> {
  if (hasElectron) {
    const result = await window.noteAPI.importData()
    if (result) {
      await loadAllData()
    }
    return result
  }
  return null
}

export async function clearData(type: 'all' | 'notes' | 'chat' | 'stats' | 'courses') {
  if (hasElectron) {
    await window.noteAPI.clearData(type)
    await loadAllData()
  } else {
    if (type === 'all' || type === 'notes') { notes.value = []; localStorage.setItem('notes', '[]') }
    if (type === 'all' || type === 'courses') { courses.value = []; localStorage.setItem('courses', '[]') }
    if (type === 'all' || type === 'chat') { chatSessions.value = []; localStorage.setItem('chatSessions', '[]') }
    if (type === 'all' || type === 'stats') { stats.value = { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] }; localStorage.setItem('stats', JSON.stringify(stats.value)) }
  }
}