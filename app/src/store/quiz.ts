// ========== Store - 出题 / 复习域 ==========
// 职责：题库 CRUD、AI 出题、错题本、间隔重复掌握度表、复习队列、薄弱点分析。
// 依赖：只 import core 的 hasElectron/frontendLogger（自包含，不读 notes.value，无环）。
import { ref, computed } from 'vue'
import type { QuizQuestion, QuizSession, QuizMistake, QuizMasteryMap, QuizMastery, QuizMasteryItem } from '../types'
import { hasElectron, frontendLogger } from './core'

// ========== 题库 ==========
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