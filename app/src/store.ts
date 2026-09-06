// 全局响应式数据 Store — 无假数据，全部走真实后端
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import type { Note, Course, ChatSession, ChatMessage, Stats, Settings, ImportedFile, AIProvider, NoteAnalysis, NoteExpansion, LogLevel, QuizQuestion, QuizSession, QuizMistake, QuizMasteryMap, QuizMastery, QuizMasteryItem } from './types'
import { AI_PLATFORMS } from './types'

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

// Markdown 渲染工具函数（支持 LaTeX 公式：$$块级$$ 与 $行内$，经 KaTeX 渲染）
import katex from 'katex'

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

// 检测是否在 Electron 环境中
const hasElectron = typeof window !== 'undefined' && !!window.noteAPI

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

// 调试日志已移至 frontendLogger 统一管理

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
if (hasElectron && window.noteAPI.onNotesChanged) {
  window.noteAPI.onNotesChanged(() => { loadAllData() })
}
// 双保险：任何时候 notes 数组变动（包括 NotesOrganize 本地保存替换、loadAllData 全量替换），
// 都把 currentNote.value 同步成新数组里的同 id 对象，保证编辑器永远显示最新内容。
watch(notes, () => { syncCurrentNoteToNotes() }, { flush: 'post' })


// ========== 设置 ==========
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

// ========== 笔记操作 ==========
export async function createNote(title: string, courseId: string, tags: string[], content: string): Promise<Note> {
  const note: Partial<Note> = {
    title, courseId, tags, content,
    paragraphs: content.split('\n').filter(l => l.trim()).length,
  }
  if (hasElectron) {
    try {
      const saved = await window.noteAPI.saveNote(note)
      notes.value.unshift(saved)
      return saved
    } catch (err) {
      frontendLogger.error('Store', '笔记创建失败', err)
      throw err
    }
  } else {
    const newNote: Note = {
      ...(note as Note),
      id: 'n' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    notes.value.unshift(newNote)
    localStorage.setItem('notes', JSON.stringify(notes.value))
    return newNote
  }
}

export async function updateNote(note: Note): Promise<Note> {
  note.paragraphs = note.content.split('\n').filter(l => l.trim()).length
  if (hasElectron) {
    // 深拷贝为纯对象，避免 Vue Proxy 无法被 IPC structuredClone
    const plainNote = JSON.parse(JSON.stringify(note))
    const saved = await window.noteAPI.saveNote(plainNote)
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx >= 0) notes.value[idx] = saved
    return saved
  } else {
    note.updatedAt = new Date().toISOString()
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx >= 0) notes.value[idx] = note
    localStorage.setItem('notes', JSON.stringify(notes.value))
    return note
  }
}

export async function removeNote(id: string) {
  if (hasElectron) {
    await window.noteAPI.deleteNote(id)
  } else {
    notes.value = notes.value.filter(n => n.id !== id)
    localStorage.setItem('notes', JSON.stringify(notes.value))
  }
  // 无论 Electron 还是浏览器模式，都必须同步更新内存列表，否则删除后界面不刷新
  notes.value = notes.value.filter(n => n.id !== id)
  if (currentNote.value?.id === id) currentNote.value = null
}

// ========== 回收站 ==========
// 已删除笔记列表
export async function getDeletedNotes(): Promise<Note[]> {
  if (hasElectron) {
    return await window.noteAPI.getDeletedNotes()
  } else {
    return notes.value.filter(n => (n as any).deletedAt)
  }
}

// 恢复笔记
export async function restoreNote(id: string): Promise<boolean> {
  if (hasElectron) {
    await window.noteAPI.restoreNote(id)
  } else {
    const note = notes.value.find(n => n.id === id)
    if (note) { delete (note as any).deletedAt; localStorage.setItem('notes', JSON.stringify(notes.value)) }
  }
  // 同步内存：从回收站恢复（若在内存中则清除标记）
  const note = notes.value.find(n => n.id === id)
  if (note) delete (note as any).deletedAt
  return true
}

// 永久删除（不可恢复）
export async function purgeNote(id: string): Promise<boolean> {
  if (hasElectron) {
    await window.noteAPI.purgeNote(id)
  } else {
    notes.value = notes.value.filter(n => n.id !== id)
    localStorage.setItem('notes', JSON.stringify(notes.value))
  }
  notes.value = notes.value.filter(n => n.id !== id)
  if (currentNote.value?.id === id) currentNote.value = null
  return true
}

// ========== 课程操作 ==========
export async function createCourse(name: string, color: string): Promise<Course> {
  const course: Partial<Course> = { name, color }
  if (hasElectron) {
    try {
      const saved = await window.noteAPI.saveCourse(course)
      courses.value.push(saved)
      return saved
    } catch (err) {
      frontendLogger.error('Store', '课程创建失败', err)
      throw err
    }
  } else {
    const newCourse: Course = {
      ...(course as Course),
      id: 'c' + Date.now(),
      noteCount: 0,
      active: false,
    }
    courses.value.push(newCourse)
    localStorage.setItem('courses', JSON.stringify(courses.value))
    return newCourse
  }
}

export async function deleteCourse(id: string) {
  if (hasElectron) {
    await window.noteAPI.deleteCourse(id)
  } else {
    courses.value = courses.value.filter(c => c.id !== id)
    localStorage.setItem('courses', JSON.stringify(courses.value))
  }
  // 同步更新内存列表，避免界面不刷新
  courses.value = courses.value.filter(c => c.id !== id)
}

export function getCourseById(id: string): Course | undefined {
  return courses.value.find(c => c.id === id)
}

export function getNotesByCourse(courseId: string): Note[] {
  return notes.value.filter(n => n.courseId === courseId)
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

// ========== 对话删除 ==========
export async function deleteChatSession(id: string) {
  if (hasElectron) {
    await window.noteAPI.deleteChatSession(id)
  } else {
    chatSessions.value = chatSessions.value.filter(s => s.id !== id)
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions.value))
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

// ========== 知识点复习（Quiz） ==========
export const quizSessions = ref<QuizSession[]>([])
export const quizMistakes = ref<QuizMistake[]>([])

export async function loadQuizData() {
  if (!hasElectron) return
  try {
    const [sessions, mistakes, mastery] = await Promise.all([
      window.noteAPI.quizGetSessions(),
      window.noteAPI.quizGetMistakes(),
      window.noteAPI.quizGetMastery(),
    ])
    quizSessions.value = sessions || []
    quizMistakes.value = mistakes || []
    quizMasteryMap.value = mastery || {}
  } catch (e) { frontendLogger.warn('Quiz', '加载题库失败', { err: String(e) }) }
}

export async function persistQuizSessions() {
  if (!hasElectron) return
  try { await window.noteAPI.quizSaveSessions(JSON.parse(JSON.stringify(quizSessions.value))) }
  catch (e) { frontendLogger.warn('Quiz', '保存题库失败', { err: String(e) }) }
}

export async function persistQuizMistakes() {
  if (!hasElectron) return
  try { await window.noteAPI.quizSaveMistakes(JSON.parse(JSON.stringify(quizMistakes.value))) }
  catch (e) { frontendLogger.warn('Quiz', '保存错题本失败', { err: String(e) }) }
}

// AI 生成题目（云端优先，主进程内自动回退本地 qwen）
export async function generateQuiz(opts: { noteIds?: string[]; courseIds?: string[]; count?: number; mock?: boolean; provider?: 'auto' | 'cloud' | 'local'; extendRatio?: number }): Promise<QuizQuestion[]> {
  if (opts.mock) return buildMockQuiz(opts.count || 5)
  if (hasElectron) {
    // 关键：Vue 响应式 ref 的 .value 是 reactive Proxy，contextBridge 无法克隆（报 "An object could not be cloned"）
    // 必须在渲染进程先把 Proxy 序列化为纯数据
    const payload = JSON.parse(JSON.stringify({ ...opts, count: opts.count || 10 }))
    const res = await window.noteAPI.quizGenerate(payload)
    return res.questions || []
  }
  throw new Error('浏览器模式不支持 AI 出题')
}

// 预置题目（测试/演示用，跳过 AI 出题）
function buildMockQuiz(count: number): QuizQuestion[] {
  const base = Date.now().toString(36)
  const out: QuizQuestion[] = []
  const types: ('choice' | 'multi' | 'judge' | 'blank' | 'match' | 'sort')[] = ['choice', 'choice', 'multi', 'judge', 'blank', 'match', 'sort']
  for (let i = 0; i < count; i++) {
    const t = types[i % types.length]
    if (t === 'choice') out.push({ id: `${base}-${i}`, type: 'choice', question: `示例选择题 #${i + 1}：在 Blender 中，"挤压"工具的快捷键是？`, options: ['A. E 键', 'B. G 键', 'C. S 键', 'D. R 键'], answer: 'A', difficulty: 'easy', explanation: '在编辑模式下按 E 进入 Edit Mode 后可选中顶点/边/面并挤出。', source: '《Blender 基础实操课》1. 基础快捷键', sourceNoteId: 'demo' })
    else if (t === 'multi') out.push({ id: `${base}-${i}`, type: 'multi', question: `示例多选题 #${i + 1}：以下哪些是 Blender 中的常用变换快捷键？`, options: ['A. G（移动）', 'B. S（缩放）', 'C. R（旋转）', 'D. T（倾斜）'], answer: 'ABC', difficulty: 'medium', explanation: 'G/S/R 是三大基础变换快捷键；T 用于倾斜变换。', source: '《Blender 基础实操课》2. 物体变换', sourceNoteId: 'demo' })
    else if (t === 'judge') out.push({ id: `${base}-${i}`, type: 'judge', question: `示例判断题 #${i + 1}：Blender 是开源 3D 软件。`, answer: '对', difficulty: 'easy', explanation: 'Blender 确实是开源软件，遵循 GPL 协议。', source: '《Blender 基础实操课》0. 简介', sourceNoteId: 'demo' })
    else if (t === 'blank') out.push({ id: `${base}-${i}`, type: 'blank', question: `示例填空题 #${i + 1}：Blender 中切换透视图与正交视图的常用数字键是数字键 _________。`, answer: '5', difficulty: 'hard', explanation: '小键盘 5 切换透视/正交视图。', source: '《Blender 基础实操课》3. 视图切换', sourceNoteId: 'demo' })
    else if (t === 'match') out.push({ id: `${base}-${i}`, type: 'match', question: `示例匹配题 #${i + 1}：将工具与功能配对`, options: ['A. 移动', 'B. 旋转', 'C. 缩放', 'D. 挤出'], answer: '1-2,2-3,3-1,4-4', difficulty: 'medium', explanation: 'G/R/S/E 分别对应移动/旋转/缩放/挤出。', source: '《Blender 基础实操课》4. 工具速查', sourceNoteId: 'demo', pairs: [{ left: '移动', right: 'G' }, { left: '旋转', right: 'R' }, { left: '缩放', right: 'S' }, { left: '挤出', right: 'E' }] })
    else out.push({ id: `${base}-${i}`, type: 'sort', question: `示例排序题 #${i + 1}：请按正确顺序排列新建 Blender 项目的基本步骤`, answer: '打开软件>新建项目>添加物体>渲染', difficulty: 'medium', explanation: '先启动软件再新建项目，添加物体后即可渲染。', source: '《Blender 基础实操课》5. 工作流程', sourceNoteId: 'demo', pairs: [{ left: '打开软件', right: '1' }, { left: '新建项目', right: '2' }, { left: '添加物体', right: '3' }, { left: '渲染', right: '4' }] })
  }
  return out
}

// 提交一次答题：更新题库 + 自动收集错题
export async function finishQuizSession(session: QuizSession) {
  const idx = quizSessions.value.findIndex(s => s.id === session.id)
  if (idx >= 0) quizSessions.value[idx] = session
  else quizSessions.value.unshift(session)
  if (quizSessions.value.length > 100) quizSessions.value.length = 100 // 只保留最近 100 次
  await persistQuizSessions()

  // 收集错题（去重：同题已存在则更新）——必须用统一判分，否则多选/匹配/排序会误收
  const wrong = session.questions.filter((q, i) => session.answers[i] != null && !isQuizAnswerCorrect(q, session.answers[i]))
  for (const q of wrong) {
    const i = session.questions.indexOf(q)
    const mi = quizMistakes.value.findIndex(m => m.question.id === q.id)
    const entry: QuizMistake = { question: q, myAnswer: session.answers[i] || '', sessionId: session.id, createdAt: new Date().toISOString() }
    if (mi >= 0) quizMistakes.value[mi] = entry
    else quizMistakes.value.unshift(entry)
  }
  if (quizMistakes.value.length > 300) quizMistakes.value.length = 300
  await persistQuizMistakes()

  // 间隔重复：更新掌握度表
  await applySessionMastery(session)
}

// 移除错题（已掌握）
export async function removeQuizMistake(questionId: string) {
  quizMistakes.value = quizMistakes.value.filter(m => m.question.id !== questionId)
  await persistQuizMistakes()
}

// 从错题本生成重练会话（错题即题库）
export function buildMistakeSession(mistakes: QuizMistake[]): QuizSession {
  const now = new Date().toISOString()
  return {
    id: `mistake-${Date.now()}`,
    title: `错题重练 · ${mistakes.length} 题`,
    createdAt: now,
    scope: { noteIds: [], courseIds: [], count: mistakes.length },
    questions: mistakes.map(m => m.question),
    answers: new Array(mistakes.length).fill(null),
    correct: 0,
    total: mistakes.length,
  }
}

// ========== 统一判分 ==========
// 前后端共享的判分规则：与 QuizReview.vue 的 isCorrectAt 保持一致。
// 注意：不能简单用 answer 字符串相等比较——多选答案字母顺序、匹配/排序的
// 格式都与用户输入不同（详见各分支）。
export function isQuizAnswerCorrect(q: QuizQuestion, myAnswer: string | null | undefined): boolean {
  if (myAnswer == null) return false
  const my = String(myAnswer)
  if (q.type === 'multi') {
    const norm = (s: string) => [...s.toUpperCase()].filter(c => 'ABCD'.includes(c)).sort().join('')
    return norm(my) === norm(q.answer)
  }
  if (q.type === 'match') {
    return my === q.pairs?.map(p => p.right).join('|')
  }
  if (q.type === 'sort') {
    const norm = (s: string) => s.replace(/\s+/g, '')
    return norm(my) === norm(q.answer)
  }
  return my === q.answer
}

// ========== 间隔重复（艾宾浩斯记忆曲线） ==========
export const quizMasteryMap = ref<QuizMasteryMap>({})

export async function loadQuizMastery() {
  if (!hasElectron) return
  try { quizMasteryMap.value = await window.noteAPI.quizGetMastery() || {} }
  catch (e) { frontendLogger.warn('Quiz', '加载掌握度失败', { err: String(e) }) }
}

export async function persistQuizMastery() {
  if (!hasElectron) return
  try { await window.noteAPI.quizSaveMastery(JSON.parse(JSON.stringify(quizMasteryMap.value))) }
  catch (e) { frontendLogger.warn('Quiz', '保存掌握度失败', { err: String(e) }) }
}

// 单题掌握度推进：答错→weak(1天)；答对连续1-2次→medium(3天)；连续3次→mastered(7天)
export function applyAnswerToMastery(item: QuizMasteryItem | undefined, q: QuizQuestion, correct: boolean): QuizMasteryItem {
  const streak = correct ? (item?.correctStreak || 0) + 1 : 0
  let mastery: QuizMastery
  let days: number
  if (!correct) { mastery = 'weak'; days = 1 }
  else if (streak >= 3) { mastery = 'mastered'; days = 7 }
  else if (streak >= 2) { mastery = 'medium'; days = 3 }
  else { mastery = (item?.mastery === 'mastered') ? 'mastered' : 'medium'; days = 3 }
  const nextReviewAt = new Date(Date.now() + days * 86400000).toISOString()
  return {
    mastery,
    reviewCount: (item?.reviewCount || 0) + 1,
    correctStreak: streak,
    lastResult: correct,
    nextReviewAt,
    question: q,
  }
}

// 答题完成后批量更新掌握度表（用统一判分）
export async function applySessionMastery(session: QuizSession) {
  for (let i = 0; i < session.questions.length; i++) {
    const q = session.questions[i]
    const correct = isQuizAnswerCorrect(q, session.answers[i])
    quizMasteryMap.value[q.id] = applyAnswerToMastery(quizMasteryMap.value[q.id], q, correct)
  }
  await persistQuizMastery()
}

// 今日待复习队列：nextReviewAt 已到期
export const dueReviewCount = computed(() =>
  Object.values(quizMasteryMap.value).filter(s => s.nextReviewAt && s.nextReviewAt <= new Date().toISOString()).length
)

// 待复习题目列表（按到期时间排序）
export const dueReviewQuestions = computed(() =>
  Object.values(quizMasteryMap.value)
    .filter(s => s.nextReviewAt && s.nextReviewAt <= new Date().toISOString())
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt))
    .map(s => s.question)
)

// ========== 薄弱点分析（错题聚类） ==========
export const weakPoints = computed(() => {
  const map = new Map<string, { title: string; count: number }>()
  for (const m of quizMistakes.value) {
    const key = m.question.sourceNoteId || m.question.source || '未知来源'
    const title = m.question.source?.split('》')[0].replace('《', '') || '未知'
    const cur = map.get(key)
    if (cur) cur.count++
    else map.set(key, { title, count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 3)
})

// ========== 复习热力图（最近 35 天） ==========
export const dailyActivity = computed(() => {
  const map: Record<string, number> = {}
  for (const s of quizSessions.value) {
    const day = s.createdAt.slice(0, 10)
    map[day] = (map[day] || 0) + s.total
  }
  const out: { date: string; count: number }[] = []
  for (let i = 34; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    out.push({ date: d, count: map[d] || 0 })
  }
  return out
})

// 掌握度分布（各状态题目数）
export const masteryStats = computed(() => {
  const out = { new: 0, weak: 0, medium: 0, mastered: 0 }
  for (const s of Object.values(quizMasteryMap.value)) out[s.mastery] = (out[s.mastery] || 0) + 1
  return out
})

// 按来源笔记聚合掌握度（供知识图谱着色）
export const masteryByNote = computed(() => {
  const map: Record<string, { weak: number; medium: number; mastered: number; total: number }> = {}
  for (const s of Object.values(quizMasteryMap.value)) {
    const nid = s.question.sourceNoteId || ''
    if (!nid) continue
    const cur = map[nid] || { weak: 0, medium: 0, mastered: 0, total: 0 }
    cur.total++
    if (s.mastery === 'weak') cur.weak++
    else if (s.mastery === 'medium') cur.medium++
    else if (s.mastery === 'mastered') cur.mastered++
    map[nid] = cur
  }
  return map
})
