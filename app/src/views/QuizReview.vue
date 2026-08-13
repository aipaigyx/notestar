<template>
  <div class="quiz-page">
    <!-- 背景装饰：渐变光晕 + 星星 -->
    <div class="bg-deco">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <svg class="bg-stars" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
        <circle cx="120" cy="160" r="1.5" fill="#FF6B9D" opacity=".55"/>
        <circle cx="280" cy="80"  r="1"   fill="#B794F6" opacity=".7"/>
        <circle cx="430" cy="220" r="1.2" fill="#FF6B9D" opacity=".45"/>
        <circle cx="600" cy="60"  r="1"   fill="#fff"    opacity=".5"/>
        <circle cx="760" cy="180" r="1.4" fill="#B794F6" opacity=".55"/>
        <circle cx="940" cy="120" r="1"   fill="#FF6B9D" opacity=".6"/>
        <circle cx="1080" cy="260" r="1.2" fill="#fff"    opacity=".4"/>
        <circle cx="180" cy="540" r="1"   fill="#B794F6" opacity=".5"/>
        <circle cx="420" cy="620" r="1.4" fill="#FF6B9D" opacity=".45"/>
        <circle cx="720" cy="700" r="1"   fill="#fff"    opacity=".55"/>
        <circle cx="980" cy="580" r="1.2" fill="#B794F6" opacity=".5"/>
      </svg>
    </div>

    <div class="quiz-shell">
      <!-- =============== 顶栏 =============== -->
      <header class="hero">
        <div class="hero-text">
          <div class="hero-title">
            <span class="hero-emoji">📖</span>
            <h1>知识点复习</h1>
            <span class="hero-badge">Smart Review</span>
          </div>
          <p class="hero-sub">基于艾宾浩斯曲线 · 答案可溯源 · 智能薄弱点分析</p>
        </div>
        <div class="hero-stats">
          <button class="stat-card review" :class="{ hot: dueReviewCount > 0 }" @click="startDueReview" :title="dueReviewCount ? '点击开始今日复习' : '今日无到期题目'">
            <span class="stat-icon">⏰</span>
            <div class="stat-body"><small>待复习</small><strong>{{ dueReviewCount }}</strong></div>
          </button>
          <div class="stat-card"><span class="stat-icon">📚</span><div class="stat-body"><small>今日</small><strong>{{ todayCount }}</strong></div></div>
          <div class="stat-card"><span class="stat-icon">🎯</span><div class="stat-body"><small>正确率</small><strong>{{ accuracy }}%</strong></div></div>
          <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-body"><small>连续</small><strong>{{ studyDays }}</strong><small>天</small></div></div>
        </div>
      </header>

      <!-- =============== 选择态 =============== -->
      <div v-if="phase === 'setup'" class="view-setup">
        <!-- 仪表盘三卡 -->
        <section class="dash-grid">
          <!-- 环形掌握度 -->
          <article class="dash-card mastery-card">
            <header class="dash-header">
              <span class="dash-title">🎯 掌握度</span>
              <span class="dash-tag">总 {{ totalTracked }}</span>
            </header>
            <div class="mastery-wrap">
              <div class="ring-box">
                <svg viewBox="0 0 140 140" class="mastery-ring">
                  <circle cx="70" cy="70" r="54" class="ring-bg"/>
                  <circle cx="70" cy="70" r="54" class="ring-new"  :stroke-dasharray="segDash.new"     transform="rotate(-90 70 70)"/>
                  <circle cx="70" cy="70" r="54" class="ring-weak"  :stroke-dasharray="segDash.weak"    transform="rotate(-90 70 70)"/>
                  <circle cx="70" cy="70" r="54" class="ring-med"   :stroke-dasharray="segDash.medium"  transform="rotate(-90 70 70)"/>
                  <circle cx="70" cy="70" r="54" class="ring-mast"  :stroke-dasharray="segDash.mastered" transform="rotate(-90 70 70)"/>
                </svg>
                <div class="ring-center">
                  <strong>{{ masteredPct }}<small>%</small></strong>
                  <span>掌握率</span>
                </div>
              </div>
              <ul class="mastery-legend">
                <li><i class="d-new"></i><span>未练</span><b>{{ masteryStats.new }}</b></li>
                <li><i class="d-weak"></i><span>生疏</span><b>{{ masteryStats.weak }}</b></li>
                <li><i class="d-medium"></i><span>一般</span><b>{{ masteryStats.medium }}</b></li>
                <li><i class="d-mastered"></i><span>掌握</span><b>{{ masteryStats.mastered }}</b></li>
              </ul>
            </div>
          </article>

          <!-- 薄弱环节 -->
          <article class="dash-card weak-card">
            <header class="dash-header">
              <span class="dash-title">🔥 薄弱环节</span>
              <span v-if="weakPoints.length" class="dash-tag danger">{{ weakPoints.length }} 处</span>
            </header>
            <div v-if="!weakPoints.length" class="weak-empty">
              <div class="weak-emoji">🎉</div>
              <p>暂无错题记录</p>
              <small>刷一组开启你的学习地图</small>
            </div>
            <ul v-else class="weak-list">
              <li v-for="(w, i) in weakPoints" :key="i">
                <span class="weak-rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
                <div class="weak-info">
                  <span class="weak-title">{{ w.title }}</span>
                  <span class="weak-bar"><i :style="{ width: (w.count / weakPoints[0].count * 100) + '%' }"></i></span>
                </div>
                <span class="weak-count">{{ w.count }} 错</span>
              </li>
            </ul>
          </article>

          <!-- 热力图 -->
          <article class="dash-card heat-card">
            <header class="dash-header">
              <span class="dash-title">📅 复习足迹</span>
              <span class="dash-tag">近 35 天</span>
            </header>
            <div class="heatmap">
              <div v-for="(d, i) in dailyActivity" :key="i" class="hc" :class="heatClass(d.count)" :title="`${d.date}: ${d.count} 题`"></div>
            </div>
            <div class="heat-foot">
              <div class="heat-legend"><span>少</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><span>多</span></div>
              <span class="heat-total">共 {{ totalSessionQuestions }} 题</span>
            </div>
          </article>
        </section>

        <!-- 主配置卡 -->
        <section class="config-card">
          <h3 class="config-title"><span>✨</span>开始新一轮复习</h3>

          <div class="step">
            <span class="step-num">1</span>
            <div class="step-body">
              <div class="step-label">选择复习范围</div>
              <div class="course-grid">
                <button v-for="c in courses" :key="c.id" class="course-tile" :class="{ active: selectedCourses.includes(c.id) }" @click="toggleCourse(c.id)">
                  <span class="course-dot" :style="{ background: c.color }"></span>
                  <span class="course-name">{{ c.name }}</span>
                  <span class="course-count">{{ c.noteCount }}</span>
                  <span class="course-tick">✓</span>
                </button>
                <button v-if="courses.length" class="course-tile all" :class="{ active: selectAll }" @click="toggleAll">
                  <span class="course-dot all-dot">★</span>
                  <span class="course-name">全部笔记</span>
                  <span class="course-count">{{ notes.length }}</span>
                  <span class="course-tick">✓</span>
                </button>
              </div>
              <div v-if="!courses.length" class="empty-hint">还没有课程，先去「笔记整理」创建吧</div>
            </div>
          </div>

          <div class="step">
            <span class="step-num">2</span>
            <div class="step-body">
              <div class="step-label">题目数量</div>
              <div class="count-segments">
                <button v-for="n in [5, 10, 15, 20]" :key="n" class="seg-btn" :class="{ active: qCount === n }" @click="qCount = n">
                  <strong>{{ n }}</strong><small>题</small>
                </button>
              </div>
            </div>
          </div>

          <div class="step">
            <span class="step-num">3</span>
            <div class="step-body">
              <div class="step-label">出题来源</div>
              <div class="provider-row">
                <button class="provider-btn" :class="{ active: quizProvider === 'auto' }" @click="quizProvider = 'auto'">
                  <span class="p-icon">⚡</span><span class="p-name">自动</span><span class="p-desc">云端优先，失败自动回退本地</span>
                </button>
                <button class="provider-btn" :class="{ active: quizProvider === 'cloud' }" @click="quizProvider = 'cloud'">
                  <span class="p-icon">☁️</span><span class="p-name">云端</span><span class="p-desc">DeepSeek 等，快但需网络</span>
                </button>
                <button class="provider-btn" :class="{ active: quizProvider === 'local' }" @click="quizProvider = 'local'">
                  <span class="p-icon">💻</span><span class="p-name">本地</span><span class="p-desc">qwen 本地模型，免费不卡</span>
                </button>
              </div>
              <div class="toggle-row" style="margin-top: 12px;">
                <label class="toggle-switch">
                  <input type="checkbox" v-model="shuffleEnabled" />
                  <span class="track"><span class="thumb"></span></span>
                  <span class="t-label">🔄 随机顺序</span>
                </label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="dedupEnabled" />
                  <span class="track"><span class="thumb"></span></span>
                  <span class="t-label">⏭ 跳过已掌握</span>
                </label>
              </div>
              <p class="hint">题型自动混合：单选 · 多选 · 填空 · 判断 · 匹配</p>
            </div>
          </div>

          <button class="launch-btn" :disabled="generating || !canGenerate" @click="doGenerate">
            <span v-if="generating" class="spin"></span>
            <span class="launch-text">{{ generating ? 'AI 正在为你出题…' : '✨ 开始复习' }}</span>
            <span v-if="!generating" class="launch-arrow">→</span>
          </button>
          <p v-if="generateMsg" class="generate-msg" :class="{ err: generateErr }">{{ generateMsg }}</p>
        </section>

        <!-- 右侧栏 -->
        <aside class="side-stack">
          <article class="side-card">
            <h3>📕 错题本 <em v-if="quizMistakes.length" class="badge">{{ quizMistakes.length }}</em></h3>
            <div v-if="!quizMistakes.length" class="side-empty">
              <div class="se-emoji">🥳</div>
              <p>暂无错题</p>
            </div>
            <template v-else>
              <button class="side-action" @click="retryMistakes"><span class="sa-emoji">🔁</span><span class="sa-text">重练错题</span><strong class="sa-n">{{ quizMistakes.length }}</strong></button>
              <button class="side-action alt" @click="exportMistakes"><span class="sa-emoji">📤</span><span class="sa-text">导出错题</span><strong class="sa-n">HTML</strong></button>
            </template>
          </article>
          <article class="side-card">
            <h3>🕘 历史刷题</h3>
            <div v-if="!quizSessions.length" class="side-empty"><p>还没有刷题记录</p></div>
            <ul v-else class="history-list">
              <li v-for="s in quizSessions.slice(0, 5)" :key="s.id" @click="reviewSession(s)">
                <span class="h-title">{{ s.title }}</span>
                <span class="h-score" :class="{ good: s.total > 0 && s.correct / s.total >= 0.8 }">{{ s.correct }}/{{ s.total }}</span>
              </li>
            </ul>
          </article>
        </aside>
      </div>

      <!-- =============== 答题态 =============== -->
      <div v-else-if="phase === 'quiz'" class="view-quiz">
        <div class="progress-bar">
          <div class="progress-info">
            <span class="prog-label">第 {{ currentIdx + 1 }} / {{ questions.length }} 题</span>
            <span v-if="currentQ" class="prog-timer" :class="{ slow: currentQTime > 30 }">⏱ {{ formatTime(currentQTime) }}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" :style="{ width: progress + '%' }"></div></div>
        </div>

        <article class="q-card">
          <div class="q-head">
            <div class="q-tags">
              <span class="q-type" :class="currentQ.type">{{ typeLabel }}</span>
              <span v-if="currentQ.difficulty" class="q-diff" :class="currentQ.difficulty">{{ diffLabel }}度</span>
              <span class="q-from" @click="gotoSource" title="点击查看原文">📄 {{ shortSource }}</span>
            </div>
          </div>

          <h2 class="q-text">{{ currentQ.question }}</h2>

          <!-- 单选 -->
          <div v-if="currentQ.type === 'choice'" class="opt-stack">
            <button v-for="(opt, i) in currentQ.options" :key="i" class="opt-card" :class="optionClass(i)" @click="pickOption(i)" :disabled="answered">
              <span class="opt-letter">{{ 'ABCD'[i] }}</span>
              <span class="opt-text">{{ opt }}</span>
              <span class="opt-mark" v-if="answered && currentQ.answer === 'ABCD'[i]">✓</span>
              <span class="opt-mark wrong" v-else-if="answered && userAnswer === 'ABCD'[i]">✕</span>
            </button>
          </div>

          <!-- 多选 -->
          <div v-else-if="currentQ.type === 'multi'" class="opt-stack">
            <button v-for="(opt, i) in currentQ.options" :key="i" class="opt-card multi" :class="multiOptionClass(i)" @click="toggleMulti(i)" :disabled="answered">
              <span class="opt-letter">{{ 'ABCD'[i] }}</span>
              <span class="opt-text">{{ opt }}</span>
              <span class="opt-mark" v-if="multiPicked.includes('ABCD'[i]) && !answered">✓</span>
            </button>
            <button v-if="!answered" class="submit-pill" @click="submitMulti">提交答案</button>
          </div>

          <!-- 填空 -->
          <div v-else-if="currentQ.type === 'blank'" class="blank-box">
            <input v-model="blankInput" placeholder="输入答案关键词…" @keyup.enter="submitBlank" :disabled="answered" />
            <button class="submit-pill" @click="submitBlank" :disabled="answered">提交</button>
          </div>

          <!-- 判断 -->
          <div v-else-if="currentQ.type === 'judge'" class="judge-stack">
            <button class="judge-card yes" :class="judgeClass('对')" @click="pickJudge('对')" :disabled="answered"><span class="j-emoji">✅</span><strong>对</strong></button>
            <button class="judge-card no"  :class="judgeClass('错')" @click="pickJudge('错')" :disabled="answered"><span class="j-emoji">❌</span><strong>错</strong></button>
          </div>

          <!-- 匹配 -->
          <div v-else-if="currentQ.type === 'match'" class="match-stack">
            <div v-for="(pair, i) in currentQ.pairs" :key="i" class="match-row">
              <span class="match-left">{{ pair.left }}</span>
              <span class="match-arrow">⇢</span>
              <select class="match-select" v-model="matchAnswers[i]" :disabled="answered" :class="{ right: answered && matchAnswers[i] === pair.right, wrong: answered && matchAnswers[i] !== pair.right }">
                <option value="" disabled>选择配对…</option>
                <option v-for="(r, ri) in matchRightOptions" :key="ri" :value="r">{{ 'ABCD'[ri] }}. {{ r }}</option>
              </select>
            </div>
            <button v-if="!answered" class="submit-pill" @click="submitMatch" :disabled="matchIncomplete">提交答案</button>
          </div>

          <!-- 反馈 -->
          <transition name="fb">
            <div v-if="answered" class="q-feedback" :class="isCorrect ? 'fb-right' : 'fb-wrong'">
              <div class="fb-title">
                <span class="fb-icon">{{ isCorrect ? '✓' : '✕' }}</span>
                {{ isCorrect ? '答对了，太棒了！' : '答错了，再来一次' }}
              </div>
              <div v-if="currentQ.type === 'multi' && !isCorrect" class="fb-mine">你的答案：<b>{{ userAnswer || '未选' }}</b> · 正确答案：<b>{{ currentQ.answer }}</b></div>
              <div v-if="currentQ.type === 'match' && !isCorrect" class="fb-mine">正确答案：<b>{{ correctMatchHint }}</b></div>
              <div class="fb-explain"><span>解析</span>{{ currentQ.explanation }}</div>
              <div class="fb-source"><span>出处</span>{{ currentQ.source }}</div>
            </div>
          </transition>

          <div class="q-nav">
            <button v-if="currentIdx > 0" class="nav-btn ghost" @click="prevQ">‹ 上一题</button>
            <button v-if="currentIdx < questions.length - 1" class="nav-btn primary" @click="nextQ" :disabled="!answered">下一题 ›</button>
            <button v-else class="nav-btn finish" @click="finishQuiz" :disabled="!answered">完成答题 🎉</button>
          </div>
        </article>
      </div>

      <!-- =============== 结果态 =============== -->
      <div v-else class="view-result">
        <article class="result-card">
          <div class="result-ring-wrap">
            <svg viewBox="0 0 160 160" class="result-ring">
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#FF6B9D"/>
                  <stop offset="100%" stop-color="#B794F6"/>
                </linearGradient>
              </defs>
              <circle cx="80" cy="80" r="68" class="r-bg"/>
              <circle cx="80" cy="80" r="68" class="r-fg" :style="{ strokeDashoffset: ringOffset, stroke: 'url(#ringGrad)' }"/>
            </svg>
            <div class="result-score">
              <strong>{{ score }}</strong>
              <small>/ {{ questions.length }}</small>
            </div>
          </div>
          <h2 class="result-title">{{ resultTitle }}</h2>
          <p class="result-sub">正确率 {{ accuracy }}%<span v-if="providerMsg"> · {{ providerMsg }}</span><span v-if="totalSec"> · 用时 {{ formatTime(totalSec) }}</span></p>
          <div v-if="diffStats.any" class="diff-stats">
            <span v-for="d in diffStats.items" :key="d.key" class="diff-stat" :class="d.key">
              <i></i>{{ d.label }}度 <b>{{ d.correct }}/{{ d.total }}</b>
            </span>
          </div>
          <div class="result-actions">
            <button class="action-btn primary" @click="restartQuiz"><span>🔁</span> 再刷一组</button>
            <button class="action-btn" @click="exportCurrent"><span>📤</span> 导出本次</button>
            <button class="action-btn ghost" @click="backToSetup"><span>←</span> 返回选择</button>
          </div>
        </article>

        <article class="review-list-card">
          <h3 class="review-title">📋 题目回顾 <small>共 {{ questions.length }} 题</small></h3>
          <ul class="review-items">
            <li v-for="(q, i) in questions" :key="q.id" :class="{ wrong: !isCorrectAt(i) }">
              <span class="r-idx">{{ i + 1 }}</span>
              <div class="r-body">
                <div class="r-q">
                  <span class="q-pill-mini" :class="q.type">{{ typeLabelAt(i) }}</span>
                  {{ q.question }}
                  <em class="r-time" v-if="perQuestionSec[i]">⏱ {{ formatTime(perQuestionSec[i]) }}</em>
                </div>
                <div class="r-meta">
                  我的答案：<b>{{ answers[i] || '未答' }}</b>
                  <span v-if="!isCorrectAt(i)" class="r-correct">正确答案：<b>{{ q.answer }}</b></span>
                  <span v-else class="r-ok">✓</span>
                </div>
                <div class="r-src">📄 {{ q.source }}</div>
              </div>
            </li>
          </ul>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  notes, courses, quizSessions, quizMistakes, quizMasteryMap,
  loadQuizData, loadQuizMastery, generateQuiz, finishQuizSession, buildMistakeSession,
  removeQuizMistake, dueReviewCount, dueReviewQuestions, weakPoints, dailyActivity,
  masteryStats, applySessionMastery,
} from '../store'
import { showToast, showAlert } from '../composables/useDialog'
import type { QuizQuestion, QuizSession } from '../types'

const router = useRouter()

// ---------- 状态 ----------
const phase = ref<'setup' | 'quiz' | 'result'>('setup')
const selectedCourses = ref<string[]>([])
const qCount = ref(10)
const shuffleEnabled = ref(false)
const dedupEnabled = ref(false)
const quizProvider = ref<'auto' | 'cloud' | 'local'>('auto')
const generating = ref(false)
const generateMsg = ref('')
const generateErr = ref(false)

const questions = ref<QuizQuestion[]>([])
const answers = ref<(string | null)[]>([])
const currentIdx = ref(0)
const blankInput = ref('')
const multiPicked = ref<string[]>([])
const matchAnswers = ref<string[]>([])
const sessionTitle = ref('')
const usedProvider = ref('')
const fromMistakes = ref(false)

const sessionStart = ref(0)
const qStart = ref(0)
const totalSec = ref(0)
const perQuestionSec = ref<number[]>([])
const nowTick = ref(Date.now())
let timerHandle: number | null = null

// ---------- 派生 ----------
const selectAll = computed(() => courses.value.length > 0 && selectedCourses.value.length === courses.value.length)
const canGenerate = computed(() => selectedCourses.value.length > 0)

const currentQ = computed(() => questions.value[currentIdx.value] || null)
const answered = computed(() => answers.value[currentIdx.value] != null)
const userAnswer = computed(() => answers.value[currentIdx.value] || '')
const isCorrect = computed(() => isCorrectAt(currentIdx.value))
const progress = computed(() => questions.value.length ? ((currentIdx.value + (answered.value ? 1 : 0)) / questions.value.length) * 100 : 0)
const typeLabel = computed(() => ({ choice: '单选', blank: '填空', judge: '判断', multi: '多选', match: '匹配' } as any)[currentQ.value?.type || 'choice'])
const diffLabel = computed(() => ({ easy: '易', medium: '中', hard: '难' } as any)[currentQ.value?.difficulty || 'medium'])
const shortSource = computed(() => {
  const s = currentQ.value?.source || ''
  return s.length > 50 ? s.slice(0, 50) + '…' : s
})
const matchRightOptions = computed(() => {
  const q = currentQ.value
  if (!q?.pairs) return []
  return [...q.pairs.map(p => p.right)].sort((a, b) => a.localeCompare(b))
})
const matchIncomplete = computed(() => currentQ.value?.pairs?.some((_, i) => !matchAnswers.value[i]) ?? true)
const correctMatchHint = computed(() => {
  const q = currentQ.value
  if (!q?.pairs) return ''
  return q.pairs.map((p, i) => `${i + 1}→${matchRightOptions.value.indexOf(p.right) + 1}`).join('  ')
})
const currentQTime = computed(() => answered.value ? (perQuestionSec.value[currentIdx.value] || 0) : Math.max(0, Math.floor((nowTick.value - qStart.value) / 1000)))

const todayCount = computed(() => quizSessions.value.filter(s => s.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((acc, s) => acc + s.total, 0))
const studyDays = computed(() => new Set(quizSessions.value.map(s => s.createdAt.slice(0, 10))).size)
const accuracy = computed(() => {
  const total = quizSessions.value.reduce((a, s) => a + s.total, 0)
  const correct = quizSessions.value.reduce((a, s) => a + s.correct, 0)
  return total ? Math.round((correct / total) * 100) : 0
})
const score = computed(() => questions.value.reduce((acc, q, i) => acc + (isCorrectAt(i) ? 1 : 0), 0))
const resultTitle = computed(() => {
  const r = questions.value.length ? score.value / questions.value.length : 0
  if (r >= 0.9) return '🏆 太棒了，全掌握！'
  if (r >= 0.7) return '🌟 很不错，继续巩固'
  if (r >= 0.5) return '💪 及格了，再看看错题'
  return '📖 还需要复习，加油！'
})
const ringOffset = computed(() => {
  const r = questions.value.length ? score.value / questions.value.length : 0
  return 427 - 427 * r // 2π * 68 ≈ 427
})
const providerMsg = computed(() => usedProvider.value === 'local' ? '本地模型出题' : usedProvider.value ? '云端出题' : '')
const diffStats = computed(() => {
  const items = ['easy', 'medium', 'hard'].map(key => {
    const idxs = questions.value.map((q, i) => (q.difficulty || 'medium') === key ? i : -1).filter(i => i >= 0)
    return { key, label: key === 'easy' ? '易' : key === 'hard' ? '难' : '中', correct: idxs.filter(i => isCorrectAt(i)).length, total: idxs.length }
  }).filter(d => d.total > 0)
  return { any: items.length > 0, items }
})

// 环形掌握度
const totalTracked = computed(() => masteryStats.value.new + masteryStats.value.weak + masteryStats.value.medium + masteryStats.value.mastered)
const masteredPct = computed(() => {
  const t = totalTracked.value
  if (!t) return 0
  return Math.round((masteryStats.value.mastered / t) * 100)
})
// 圆弧分段（每段是 circ/2 = 339.29 长度对应 100%）
const segDash = computed(() => {
  const t = totalTracked.value
  const C = 339.29 // 2π * 54
  if (!t) return { new: `0 0`, weak: `0 0`, medium: `0 0`, mastered: `0 0` }
  const len = (n: number) => {
    const v = (n / t) * C
    return `${v.toFixed(2)} ${(C - v).toFixed(2)}`
  }
  return {
    new: len(masteryStats.value.new),
    weak: len(masteryStats.value.weak),
    medium: len(masteryStats.value.medium),
    mastered: len(masteryStats.value.mastered),
  }
})
const totalSessionQuestions = computed(() => quizSessions.value.reduce((a, s) => a + s.total, 0))

// ---------- 判分 ----------
const isCorrectAt = (i: number) => {
  const q = questions.value[i]
  const my = answers.value[i]
  if (my == null) return false
  if (q.type === 'multi') {
    const norm = (s: string) => [...s.toUpperCase()].filter(c => 'ABCD'.includes(c)).sort().join('')
    return norm(my) === norm(q.answer)
  }
  if (q.type === 'match') {
    return my === q.pairs?.map(p => p.right).join('|')
  }
  return my === q.answer
}

// ---------- 工具 ----------
const typeLabelAt = (i: number) => {
  const map: any = { choice: '单选', blank: '填空', judge: '判断', multi: '多选', match: '匹配' }
  return map[questions.value[i]?.type] || ''
}
const heatClass = (n: number) => (n === 0 ? 'l0' : n <= 3 ? 'l1' : n <= 8 ? 'l2' : 'l3')
const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60), s = sec % 60
  return m ? `${m}m${s.toString().padStart(2, '0')}s` : `${s}s`
}
const shortDate = (iso: string) => (iso || '').slice(5, 16).replace('T', ' ')
const startTimer = () => {
  sessionStart.value = Date.now(); qStart.value = Date.now(); nowTick.value = Date.now()
  if (timerHandle) clearInterval(timerHandle)
  timerHandle = window.setInterval(() => { nowTick.value = Date.now() }, 1000)
}
const advanceTimer = () => {
  if (qStart.value) perQuestionSec.value[currentIdx.value] = Math.floor((Date.now() - qStart.value) / 1000)
  qStart.value = Date.now()
}
const stopTimer = () => {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null }
  totalSec.value = Math.floor((Date.now() - sessionStart.value) / 1000)
}
const toggleCourse = (id: string) => {
  selectedCourses.value = selectedCourses.value.includes(id)
    ? selectedCourses.value.filter(x => x !== id)
    : [...selectedCourses.value, id]
}
const toggleAll = () => { selectedCourses.value = selectAll.value ? [] : courses.value.map(c => c.id) }

// ---------- 出题 ----------
const doGenerate = async () => {
  if (!selectedCourses.value.length) { showToast('请先选择复习范围', 'warn'); return }
  generating.value = true; generateMsg.value = ''; generateErr.value = false
  try {
    console.log('[Quiz] 调用前', JSON.stringify({ courseIds: selectedCourses.value, count: qCount.value, hasElectron: !!window.noteAPI }))
    let qs = await generateQuiz({ courseIds: selectedCourses.value, count: qCount.value, provider: quizProvider.value })
    console.log('[Quiz] 调用成功', qs.length, '题')
    if (!qs.length) throw new Error('没有生成到题目')
    if (dedupEnabled.value) {
      const masteredIds = new Set(Object.entries(quizMasteryMap.value).filter(([, s]) => s.mastery === 'mastered' && s.nextReviewAt && s.nextReviewAt > new Date().toISOString()).map(([id]) => id))
      qs = qs.filter(q => !masteredIds.has(q.id))
      if (!qs.length) throw new Error('范围内题目都已掌握 🎉 换个范围或关掉「跳过已掌握」')
    }
    if (shuffleEnabled.value) qs = [...qs].sort(() => Math.random() - 0.5)
    questions.value = qs; resetAnswers()
    const courseName = courses.value.find(c => c.id === selectedCourses.value[0])?.name || '全部笔记'
    sessionTitle.value = `${courseName} · ${qs.length} 题`
    usedProvider.value = ''; fromMistakes.value = false
    phase.value = 'quiz'; startTimer()
  } catch (e: any) {
    console.error('[Quiz] doGenerate error:', e?.message, '|name:', e?.name, '|stack:', (e?.stack || '').slice(0, 600))
    generateErr.value = true
    generateMsg.value = e?.message || '出题失败，请重试'
  } finally { generating.value = false }
}

const resetAnswers = () => {
  answers.value = new Array(questions.value.length).fill(null)
  currentIdx.value = 0; blankInput.value = ''; multiPicked.value = []; matchAnswers.value = []; perQuestionSec.value = []
}

const startDueReview = () => {
  const due = dueReviewQuestions.value
  if (!due.length) { showToast('今日没有到期的题目 🎉', 'success'); return }
  questions.value = due; resetAnswers()
  sessionTitle.value = `今日复习 · ${due.length} 题`
  phase.value = 'quiz'; startTimer()
}

// ---------- 答题 ----------
const pickOption = (i: number) => { answers.value[currentIdx.value] = 'ABCD'[i] }
const pickJudge = (v: '对' | '错') => { answers.value[currentIdx.value] = v }
const toggleMulti = (i: number) => {
  const l = 'ABCD'[i]
  multiPicked.value = multiPicked.value.includes(l) ? multiPicked.value.filter(x => x !== l) : [...multiPicked.value, l]
}
const submitMulti = () => {
  if (!multiPicked.value.length) { showToast('请至少选择一个选项', 'warn'); return }
  answers.value[currentIdx.value] = [...multiPicked.value].sort().join('')
}
const submitBlank = () => {
  if (!blankInput.value.trim()) { showToast('请先输入答案', 'warn'); return }
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')
  const mine = norm(blankInput.value); const ans = norm(currentQ.value?.answer || '')
  answers.value[currentIdx.value] = mine.includes(ans) || ans.includes(mine) ? (currentQ.value?.answer || '') : mine
}
const submitMatch = () => {
  const pairs = currentQ.value?.pairs || []
  const correctSeq = pairs.map(p => p.right)
  const mySeq = pairs.map((_, i) => matchAnswers.value[i] || '')
  answers.value[currentIdx.value] = mySeq.join('|')
}
const nextQ = () => {
  if (currentIdx.value < questions.value.length - 1) {
    advanceTimer(); currentIdx.value++
    blankInput.value = ''; multiPicked.value = []; matchAnswers.value = []
  }
}
const prevQ = () => {
  if (currentIdx.value > 0) {
    advanceTimer(); currentIdx.value--
    blankInput.value = ''; multiPicked.value = []; matchAnswers.value = []
  }
}

const finishQuiz = async () => {
  stopTimer(); advanceTimer()
  const total = questions.value.length
  const correct = questions.value.reduce((acc, q, i) => acc + (isCorrectAt(i) ? 1 : 0), 0)
  const session: QuizSession = {
    id: `quiz-${Date.now()}`, title: sessionTitle.value || '知识点复习',
    createdAt: new Date().toISOString(),
    scope: { noteIds: [], courseIds: selectedCourses.value, count: total },
    questions: questions.value, answers: [...answers.value], correct, total,
    durationSec: totalSec.value, perQuestionSec: [...perQuestionSec.value],
  }
  await finishQuizSession(session)
  await applySessionMastery(session)
  if (fromMistakes.value) {
    const masteredIds = questions.value.filter((q, i) => isCorrectAt(i)).map(q => q.id)
    for (const id of masteredIds) await removeQuizMistake(id)
    fromMistakes.value = false
  }
  phase.value = 'result'
}

const restartQuiz = () => { resetAnswers(); phase.value = 'quiz'; startTimer() }
const backToSetup = () => { phase.value = 'setup'; questions.value = []; answers.value = []; currentIdx.value = 0; generateMsg.value = ''; totalSec.value = 0 }

const reviewSession = (s: QuizSession) => {
  questions.value = s.questions; answers.value = [...s.answers]; perQuestionSec.value = s.perQuestionSec || []
  totalSec.value = s.durationSec || 0; currentIdx.value = 0; sessionTitle.value = s.title; phase.value = 'result'
}

const retryMistakes = async () => {
  if (!quizMistakes.value.length) return
  questions.value = quizMistakes.value.map(m => m.question); resetAnswers()
  sessionTitle.value = '错题重练'; fromMistakes.value = true; phase.value = 'quiz'; startTimer()
}

// ---------- 导出 ----------
const exportItems = () => {
  const typeL: any = { choice: '单选题', blank: '填空题', judge: '判断题', multi: '多选题', match: '匹配题' }
  return questions.value.map((q, i) => ({
    question: q.question, answer: q.answer, myAnswer: answers.value[i] || '未答',
    explanation: q.explanation, source: q.source, typeLabel: typeL[q.type],
    difficulty: q.difficulty === 'easy' ? '易' : q.difficulty === 'hard' ? '难' : '中',
    correct: isCorrectAt(i),
  }))
}
const exportCurrent = async () => {
  try {
    const path = await window.noteAPI.quizExportHtml({ title: sessionTitle.value || '复习记录', items: exportItems() })
    if (path) showToast('已导出：' + path.split(/[\\/]/).pop(), 'success')
  } catch (e: any) { showAlert('导出失败', e?.message || String(e)) }
}
const exportMistakes = async () => {
  const items = quizMistakes.value.map(m => ({
    question: m.question.question, answer: m.question.answer, myAnswer: m.myAnswer || '未答',
    explanation: m.question.explanation, source: m.question.source,
    typeLabel: '', difficulty: '', correct: false,
  }))
  try {
    const path = await window.noteAPI.quizExportHtml({ title: `错题本 · ${items.length} 题`, items })
    if (path) showToast('错题本已导出', 'success')
  } catch (e: any) { showAlert('导出失败', e?.message || String(e)) }
}

const gotoSource = () => {
  const nid = currentQ.value?.sourceNoteId
  if (nid) { showToast('已打开笔记整理页，可查看原文', 'info'); router.push('/notes') }
}
const optionClass = (i: number) => {
  const letter = 'ABCD'[i]
  const isPicked = userAnswer.value === letter
  if (!answered.value) return { picked: isPicked }
  const isRight = currentQ.value?.answer === letter
  if (isRight) return { right: true }
  if (isPicked) return { wrong: true }
  return {}
}
const multiOptionClass = (i: number) => {
  const letter = 'ABCD'[i]
  const picked = multiPicked.value.includes(letter)
  if (!answered.value) return { picked }
  const ansLetters = [...(currentQ.value?.answer || '').toUpperCase()]
  if (ansLetters.includes(letter)) return { right: true }
  if (picked) return { wrong: true }
  return {}
}
const judgeClass = (v: '对' | '错') => {
  const isPicked = userAnswer.value === v
  if (!answered.value) return { picked: isPicked }
  const isRight = currentQ.value?.answer === v
  if (isRight) return { right: true }
  if (isPicked) return { wrong: true }
  return {}
}

onMounted(() => { loadQuizData(); loadQuizMastery() })
onUnmounted(() => { if (timerHandle) clearInterval(timerHandle) })
</script>

<style scoped>
/* ============================================================
   知识点复习 · UI 重设计
   风格：粉紫二次元 · Soft Pastel Blur Marketing + Bento
   ============================================================ */

.quiz-page {
  width: 100%; height: 100%; position: relative;
  overflow-y: auto; overflow-x: hidden;
  background:
    radial-gradient(ellipse at top left, rgba(255, 192, 213, 0.18), transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(183, 148, 246, 0.16), transparent 50%),
    #F8F4FE;
}

/* 背景装饰 */
.bg-deco { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.55; }
.orb-1 { width: 520px; height: 520px; top: -180px; right: -120px; background: radial-gradient(circle, #FFB8D1, transparent 70%); }
.orb-2 { width: 460px; height: 460px; bottom: -160px; left: -100px; background: radial-gradient(circle, #C9B8FF, transparent 70%); }
.orb-3 { width: 320px; height: 320px; top: 35%; left: 45%; background: radial-gradient(circle, rgba(110, 138, 255, 0.35), transparent 70%); }
.bg-stars { position: absolute; inset: 0; width: 100%; height: 100%; }

.quiz-shell {
  position: relative; z-index: 1;
  max-width: 1180px; margin: 0 auto;
  padding: 32px 32px 80px;
  display: flex; flex-direction: column; gap: 26px;
}

/* =============== 顶栏 Hero =============== */
.hero {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 20px; flex-wrap: wrap;
  padding: 4px 4px 6px;
}
.hero-text { min-width: 280px; }
.hero-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.hero-emoji { font-size: 30px; filter: drop-shadow(0 4px 8px rgba(255,107,157,0.35)); }
.hero h1 { font-size: 30px; font-weight: 800; color: #2D2541; margin: 0; letter-spacing: -0.5px; }
.hero-badge {
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 700; letter-spacing: 1px;
  padding: 4px 10px; border-radius: 99px;
  background: linear-gradient(120deg, rgba(255,107,157,0.18), rgba(183,148,246,0.18));
  color: #B794F6;
  border: 1px solid rgba(183,148,246,0.3);
  text-transform: uppercase;
}
.hero-sub { font-size: 13px; color: #6B6580; margin: 0; }

.hero-stats { display: flex; gap: 10px; flex-wrap: wrap; }
.stat-card {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
  border: 1px solid rgba(235,229,244,0.9);
  border-radius: 16px; padding: 10px 16px;
  cursor: default;
  box-shadow: 0 4px 12px rgba(183,148,246,0.06);
  transition: all 0.2s;
}
.stat-card.review { cursor: pointer; }
.stat-card.review:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(255,107,157,0.22); }
.stat-card.review.hot {
  border-color: rgba(229,72,77,0.5);
  background: linear-gradient(120deg, rgba(255,107,157,0.08), rgba(229,72,77,0.08));
  animation: pulse-hot 2.2s infinite;
}
@keyframes pulse-hot {
  0%,100% { box-shadow: 0 0 0 0 rgba(229,72,77,0.25), 0 4px 12px rgba(183,148,246,0.06); }
  50%     { box-shadow: 0 0 0 8px rgba(229,72,77,0), 0 4px 12px rgba(183,148,246,0.06); }
}
.stat-icon { font-size: 18px; line-height: 1; }
.stat-body { display: flex; align-items: baseline; gap: 4px; }
.stat-body small { font-size: 11px; color: #9088A8; }
.stat-body strong { font-size: 18px; color: #2D2541; font-weight: 700; }
.stat-card.review.hot .stat-body strong { color: #e5484d; }

/* =============== 选择态 =============== */
.view-setup {
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-rows: auto auto;
  gap: 20px;
}
.dash-grid { grid-column: 1 / -1; display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 16px; }

.dash-card {
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(235,229,244,0.9);
  border-radius: 20px;
  padding: 20px 22px;
  box-shadow: 0 10px 28px rgba(183,148,246,0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}
.dash-card:hover { transform: translateY(-2px); box-shadow: 0 14px 34px rgba(183,148,246,0.12); }
.dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.dash-title { font-size: 14px; font-weight: 700; color: #2D2541; }
.dash-tag { font-size: 11px; padding: 2px 10px; border-radius: 99px; background: rgba(183,148,246,0.12); color: #8B7AB8; font-weight: 600; }
.dash-tag.danger { background: rgba(229,72,77,0.12); color: #e5484d; }

/* 掌握度环 */
.mastery-wrap { display: flex; gap: 20px; align-items: center; }
.ring-box { position: relative; width: 140px; height: 140px; flex-shrink: 0; }
.mastery-ring { width: 140px; height: 140px; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: rgba(183,148,246,0.12); stroke-width: 12; }
.ring-new     { fill: none; stroke: #C9C2D8; stroke-width: 12; stroke-linecap: butt; transition: stroke-dasharray 0.6s; }
.ring-weak    { fill: none; stroke: #F87171; stroke-width: 12; stroke-linecap: butt; transition: stroke-dasharray 0.6s; }
.ring-med     { fill: none; stroke: #FBBF24; stroke-width: 12; stroke-linecap: butt; transition: stroke-dasharray 0.6s; }
.ring-mast    { fill: none; stroke: #34D399; stroke-width: 12; stroke-linecap: butt; transition: stroke-dasharray 0.6s; }
.ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-center strong { font-size: 28px; color: #2D2541; font-weight: 800; line-height: 1; }
.ring-center strong small { font-size: 13px; color: #9088A8; font-weight: 500; }
.ring-center span { font-size: 11px; color: #9088A8; margin-top: 2px; }
.mastery-legend { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.mastery-legend li { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.mastery-legend li i { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.mastery-legend .d-new { background: #C9C2D8; }
.mastery-legend .d-weak { background: #F87171; }
.mastery-legend .d-medium { background: #FBBF24; }
.mastery-legend .d-mastered { background: #34D399; }
.mastery-legend li span { flex: 1; color: #6B6580; }
.mastery-legend li b { color: #2D2541; font-weight: 700; }

/* 薄弱环节 */
.weak-empty { text-align: center; padding: 18px 0; }
.weak-emoji { font-size: 40px; margin-bottom: 4px; }
.weak-empty p { margin: 0 0 4px; font-size: 14px; color: #2D2541; font-weight: 600; }
.weak-empty small { font-size: 11px; color: #9088A8; }
.weak-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.weak-list li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,247,237,0.7); border-radius: 12px; border: 1px solid rgba(251,191,36,0.18); }
.weak-rank { width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.weak-rank.r1 { background: linear-gradient(135deg, #F87171, #EF4444); }
.weak-rank.r2 { background: linear-gradient(135deg, #FB923C, #F87171); }
.weak-rank.r3 { background: linear-gradient(135deg, #FBBF24, #FB923C); }
.weak-info { flex: 1; min-width: 0; }
.weak-title { display: block; font-size: 12px; color: #2D2541; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.weak-bar { display: block; height: 4px; background: rgba(251,191,36,0.15); border-radius: 99px; overflow: hidden; margin-top: 4px; }
.weak-bar i { display: block; height: 100%; background: linear-gradient(90deg, #F87171, #FBBF24); border-radius: 99px; }
.weak-count { font-size: 11px; font-weight: 700; color: #e5484d; background: rgba(229,72,77,0.1); border-radius: 99px; padding: 2px 9px; flex-shrink: 0; }

/* 热力图 */
.heatmap {
  display: grid; grid-template-columns: repeat(35, 1fr); gap: 3px;
  padding: 4px 0;
}
.hc { height: 16px; border-radius: 4px; background: rgba(183,148,246,0.08); transition: transform 0.15s; }
.hc:hover { transform: scale(1.4); }
.hc.l1 { background: rgba(255,107,157,0.25); }
.hc.l2 { background: rgba(255,107,157,0.55); }
.hc.l3 { background: linear-gradient(135deg, #FF6B9D, #B794F6); }
.heat-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 10px; color: #9088A8; }
.heat-legend { display: flex; align-items: center; gap: 4px; }
.heat-legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.heat-legend i.l0 { background: rgba(183,148,246,0.08); }
.heat-legend i.l1 { background: rgba(255,107,157,0.25); }
.heat-legend i.l2 { background: rgba(255,107,157,0.55); }
.heat-legend i.l3 { background: linear-gradient(135deg, #FF6B9D, #B794F6); }
.heat-total { font-weight: 600; }

/* 配置卡 */
.config-card {
  background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
  border: 1px solid rgba(235,229,244,0.9);
  border-radius: 24px; padding: 24px 28px;
  box-shadow: 0 14px 36px rgba(183,148,246,0.10);
  grid-column: 1 / 2;
}
.config-title { font-size: 18px; font-weight: 800; color: #2D2541; margin: 0 0 22px; display: flex; align-items: center; gap: 10px; }

.step { display: flex; gap: 16px; margin-bottom: 20px; }
.step-num {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #FF6B9D, #B794F6);
  color: #fff; font-size: 13px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 10px rgba(255,107,157,0.3);
}
.step-body { flex: 1; min-width: 0; }
.step-label { font-size: 12px; color: #9088A8; margin-bottom: 8px; font-weight: 600; }

.course-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.course-tile {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: #fff; border: 1.5px solid #EBE5F4; border-radius: 12px;
  cursor: pointer; text-align: left;
  transition: all 0.18s;
  position: relative;
}
.course-tile:hover { border-color: #FF6B9D; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,107,157,0.12); }
.course-tile.active {
  border-color: #FF6B9D; background: linear-gradient(135deg, rgba(255,107,157,0.08), rgba(183,148,246,0.08));
  box-shadow: 0 6px 18px rgba(255,107,157,0.18);
}
.course-dot { width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0; }
.course-dot.all-dot {
  background: linear-gradient(135deg, #FF6B9D, #B794F6); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 9px;
}
.course-name { flex: 1; font-size: 13px; color: #2D2541; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.course-count { font-size: 11px; color: #9088A8; background: #F4EEFB; border-radius: 99px; padding: 1px 8px; flex-shrink: 0; }
.course-tick {
  width: 18px; height: 18px; border-radius: 50%;
  background: #FF6B9D; color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: scale(0.5); transition: all 0.18s;
}
.course-tile.active .course-tick { opacity: 1; transform: scale(1); }
.empty-hint { font-size: 12px; color: #9088A8; padding: 14px 0; }

.count-segments { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.seg-btn {
  padding: 10px 8px; border: 1.5px solid #EBE5F4; border-radius: 12px;
  background: #fff; cursor: pointer; text-align: center;
  transition: all 0.18s;
}
.seg-btn:hover { border-color: #FF6B9D; transform: translateY(-1px); }
.seg-btn strong { display: block; font-size: 18px; color: #2D2541; font-weight: 700; line-height: 1.2; }
.seg-btn small { font-size: 10px; color: #9088A8; }
.seg-btn.active {
  border-color: transparent;
  background: linear-gradient(135deg, #FF6B9D, #B794F6);
  box-shadow: 0 6px 18px rgba(255,107,157,0.3);
}
.seg-btn.active strong, .seg-btn.active small { color: #fff; }

.toggle-row { display: flex; gap: 18px; flex-wrap: wrap; }
.provider-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 2px; }
.provider-btn {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 12px 14px; background: #fff;
  border: 1.5px solid #EBE5F4; border-radius: 14px;
  cursor: pointer; text-align: left;
  transition: all 0.18s;
}
.provider-btn:hover { border-color: #B794F6; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(183,148,246,0.14); }
.provider-btn.active {
  border-color: transparent;
  background: linear-gradient(135deg, rgba(255,107,157,0.1), rgba(183,148,246,0.1));
  box-shadow: 0 0 0 2px #FF6B9D inset;
}
.p-icon { font-size: 16px; line-height: 1.3; }
.p-name { font-size: 13px; font-weight: 700; color: #2D2541; }
.p-desc { font-size: 10px; color: #9088A8; line-height: 1.4; }
.provider-btn.active .p-name { color: #FF6B9D; }
.toggle-switch { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #2D2541; }
.toggle-switch input { display: none; }
.toggle-switch .track {
  width: 36px; height: 20px; background: #DDD6E8; border-radius: 99px;
  position: relative; transition: background 0.2s;
}
.toggle-switch .thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.2s;
}
.toggle-switch input:checked + .track { background: linear-gradient(135deg, #FF6B9D, #B794F6); }
.toggle-switch input:checked + .track .thumb { transform: translateX(16px); }
.t-label { font-weight: 600; }

.hint { font-size: 11px; color: #9088A8; margin: 8px 0 0; }

.launch-btn {
  width: 100%; margin-top: 22px; padding: 16px;
  border: none; border-radius: 16px;
  background: linear-gradient(120deg, #FF6B9D 0%, #B794F6 100%);
  color: #fff; font-size: 16px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(255,107,157,0.35);
  position: relative; overflow: hidden;
  transition: transform 0.18s, box-shadow 0.18s;
}
.launch-btn::before {
  content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shine 3s infinite;
}
@keyframes shine { to { left: 150%; } }
.launch-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(255,107,157,0.42); }
.launch-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.launch-text { letter-spacing: 0.5px; }
.launch-arrow { font-size: 18px; transition: transform 0.2s; }
.launch-btn:hover:not(:disabled) .launch-arrow { transform: translateX(4px); }
.spin { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.generate-msg { margin-top: 12px; font-size: 12px; color: #B794F6; text-align: center; }
.generate-msg.err { color: #e5484d; }

/* 侧栏 */
.side-stack { display: flex; flex-direction: column; gap: 16px; grid-column: 2; grid-row: 2; }
.side-card {
  background: rgba(255,255,255,0.92); backdrop-filter: blur(10px);
  border: 1px solid rgba(235,229,244,0.9);
  border-radius: 18px; padding: 16px 18px;
  box-shadow: 0 8px 24px rgba(183,148,246,0.08);
}
.side-card h3 { font-size: 14px; font-weight: 700; color: #2D2541; margin: 0 0 12px; display: flex; align-items: center; gap: 6px; }
.side-card .badge { font-style: normal; background: linear-gradient(135deg, #FF6B9D, #B794F6); color: #fff; border-radius: 99px; font-size: 10px; padding: 2px 8px; font-weight: 700; margin-left: auto; }
.side-empty { text-align: center; padding: 14px 0; color: #9088A8; }
.side-empty .se-emoji { font-size: 30px; margin-bottom: 4px; }
.side-empty p { margin: 0; font-size: 12px; }
.side-action {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 12px 14px; margin-top: 6px;
  background: linear-gradient(135deg, rgba(255,107,157,0.1), rgba(183,148,246,0.1));
  border: 1.5px dashed rgba(255,107,157,0.4); border-radius: 12px;
  cursor: pointer; transition: all 0.18s;
  font-size: 13px; color: #2D2541; font-weight: 600;
}
.side-action.alt { background: rgba(110,138,255,0.06); border-color: rgba(110,138,255,0.3); }
.side-action:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,107,157,0.18); }
.sa-emoji { font-size: 16px; }
.sa-text { flex: 1; }
.sa-n { background: rgba(255,255,255,0.8); padding: 2px 9px; border-radius: 99px; font-size: 11px; color: #B794F6; font-weight: 700; }
.history-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.history-list li {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border-radius: 10px; cursor: pointer; transition: background 0.18s;
  font-size: 12px;
}
.history-list li:hover { background: rgba(183,148,246,0.08); }
.h-title { flex: 1; color: #2D2541; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h-score { font-size: 11px; font-weight: 700; color: #9088A8; background: #F4EEFB; padding: 1px 7px; border-radius: 99px; }
.h-score.good { color: #34D399; background: rgba(52,211,153,0.1); }

/* =============== 答题态 =============== */
.view-quiz { max-width: 760px; margin: 0 auto; width: 100%; }

.progress-bar {
  background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
  border-radius: 18px; padding: 14px 20px; margin-bottom: 18px;
  border: 1px solid rgba(235,229,244,0.7);
  box-shadow: 0 6px 20px rgba(183,148,246,0.06);
}
.progress-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.prog-label { font-size: 13px; color: #2D2541; font-weight: 600; }
.prog-timer { font-size: 12px; color: #6B6580; background: rgba(255,107,157,0.06); padding: 3px 12px; border-radius: 99px; font-weight: 600; }
.prog-timer.slow { color: #e5484d; background: rgba(229,72,77,0.1); animation: pulse-timer 1.2s infinite; }
@keyframes pulse-timer { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.progress-track { height: 6px; background: rgba(183,148,246,0.15); border-radius: 99px; overflow: hidden; }
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF6B9D, #B794F6);
  border-radius: 99px;
  transition: width 0.5s cubic-bezier(.4,1.4,.6,1);
  box-shadow: 0 0 12px rgba(255,107,157,0.5);
}

.q-card {
  background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
  border: 1px solid rgba(235,229,244,0.7);
  border-radius: 28px; padding: 32px 36px;
  box-shadow: 0 20px 50px rgba(183,148,246,0.14);
}
.q-head { margin-bottom: 20px; }
.q-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.q-type { font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 99px; }
.q-type.choice { background: rgba(255,107,157,0.14); color: #FF6B9D; }
.q-type.blank { background: rgba(183,148,246,0.16); color: #B794F6; }
.q-type.judge { background: rgba(110,138,255,0.14); color: #6E8AFF; }
.q-type.multi { background: rgba(251,191,36,0.16); color: #FB923C; }
.q-type.match { background: rgba(52,211,153,0.14); color: #34D399; }
.q-diff { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
.q-diff.easy { background: rgba(52,211,153,0.14); color: #34D399; }
.q-diff.medium { background: rgba(251,191,36,0.14); color: #FB923C; }
.q-diff.hard { background: rgba(248,113,113,0.14); color: #F87171; }
.q-from { margin-left: auto; font-size: 11px; color: #9088A8; cursor: pointer; max-width: 50%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-from:hover { color: #FF6B9D; }
.q-text { font-size: 21px; line-height: 1.65; color: #2D2541; margin: 0 0 24px; font-weight: 600; letter-spacing: -0.2px; }

.opt-stack { display: flex; flex-direction: column; gap: 10px; }
.opt-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px;
  background: rgba(255,255,255,0.8);
  border: 1.5px solid #EBE5F4; border-radius: 14px;
  cursor: pointer; text-align: left;
  font-size: 14px; color: #2D2541;
  transition: all 0.18s;
  position: relative; overflow: hidden;
}
.opt-card:not(:disabled):hover {
  border-color: #FF6B9D; background: #fff;
  transform: translateX(4px);
  box-shadow: 0 6px 16px rgba(255,107,157,0.12);
}
.opt-letter {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(255,107,157,0.12), rgba(183,148,246,0.12));
  color: #B794F6; font-size: 13px; font-weight: 800;
  transition: all 0.2s;
}
.opt-text { flex: 1; }
.opt-mark {
  position: absolute; right: 16px;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff;
  animation: pop 0.3s cubic-bezier(.4,1.6,.6,1);
}
.opt-mark.wrong { background: #F87171; }
.opt-card.right .opt-mark { background: #34D399; }
@keyframes pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
.opt-card.picked { border-color: #FF6B9D; background: linear-gradient(135deg, rgba(255,107,157,0.06), rgba(183,148,246,0.06)); }
.opt-card.picked .opt-letter { background: linear-gradient(135deg, #FF6B9D, #B794F6); color: #fff; }
.opt-card.right {
  border-color: #34D399; background: linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.06));
  animation: pulse-right 0.6s ease-out;
}
.opt-card.right .opt-letter { background: #34D399; color: #fff; }
@keyframes pulse-right {
  0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.6); }
  100% { box-shadow: 0 0 0 12px rgba(52,211,153,0); }
}
.opt-card.wrong {
  border-color: #F87171; background: rgba(248,113,113,0.08);
  animation: shake 0.4s ease-in-out;
}
.opt-card.wrong .opt-letter { background: #F87171; color: #fff; }
@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
.opt-card.multi { cursor: pointer; }

.submit-pill {
  margin-top: 14px; padding: 12px 28px; align-self: flex-end;
  border: none; border-radius: 14px;
  background: linear-gradient(135deg, #FF6B9D, #B794F6);
  color: #fff; font-size: 14px; font-weight: 700;
  cursor: pointer; box-shadow: 0 6px 18px rgba(255,107,157,0.3);
  transition: all 0.18s;
}
.submit-pill:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(255,107,157,0.42); }
.submit-pill:disabled { opacity: 0.5; cursor: not-allowed; }

.blank-box { display: flex; gap: 10px; }
.blank-box input {
  flex: 1; padding: 14px 18px;
  border: 1.5px solid #EBE5F4; border-radius: 14px;
  font-size: 14px; background: rgba(255,255,255,0.8); color: #2D2541; outline: none;
  transition: all 0.18s;
}
.blank-box input:focus { border-color: #B794F6; box-shadow: 0 0 0 4px rgba(183,148,246,0.15); }

.judge-stack { display: flex; gap: 16px; }
.judge-card {
  flex: 1; padding: 22px;
  background: rgba(255,255,255,0.8); border: 1.5px solid #EBE5F4; border-radius: 16px;
  cursor: pointer; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  font-size: 15px; font-weight: 700; color: #2D2541;
  transition: all 0.18s;
}
.judge-card .j-emoji { font-size: 26px; }
.judge-card.yes:hover:not(:disabled) { border-color: #34D399; background: rgba(52,211,153,0.06); transform: translateY(-2px); }
.judge-card.no:hover:not(:disabled) { border-color: #F87171; background: rgba(248,113,113,0.06); transform: translateY(-2px); }
.judge-card.right { border-color: #34D399; background: rgba(52,211,153,0.1); animation: pulse-right 0.6s; }
.judge-card.wrong { border-color: #F87171; background: rgba(248,113,113,0.1); animation: shake 0.4s; }

.match-stack { display: flex; flex-direction: column; gap: 12px; }
.match-row { display: flex; align-items: center; gap: 12px; }
.match-left { flex: 1; padding: 13px 18px; background: rgba(255,255,255,0.8); border: 1.5px solid #EBE5F4; border-radius: 12px; font-size: 14px; color: #2D2541; font-weight: 500; }
.match-arrow { color: #B794F6; font-size: 18px; }
.match-select {
  width: 45%; padding: 12px 14px;
  border: 1.5px solid #EBE5F4; border-radius: 12px;
  background: #fff; font-size: 13px; color: #2D2541; cursor: pointer; outline: none;
  transition: all 0.18s;
}
.match-select:focus { border-color: #B794F6; box-shadow: 0 0 0 4px rgba(183,148,246,0.15); }
.match-select.right { border-color: #34D399; background: rgba(52,211,153,0.06); }
.match-select.wrong { border-color: #F87171; background: rgba(248,113,113,0.06); }

.q-feedback {
  margin-top: 22px; padding: 18px 20px; border-radius: 16px;
  animation: slide-up 0.4s ease-out;
}
@keyframes slide-up { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
.q-feedback.fb-right { background: linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.05)); border: 1px solid rgba(52,211,153,0.3); }
.q-feedback.fb-wrong { background: linear-gradient(135deg, rgba(248,113,113,0.1), rgba(248,113,113,0.04)); border: 1px solid rgba(248,113,113,0.3); }
.fb-title { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.fb-icon {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: #fff; font-weight: 800;
}
.fb-right .fb-icon { background: #34D399; }
.fb-wrong .fb-icon { background: #F87171; }
.fb-right .fb-title { color: #16a34a; }
.fb-wrong .fb-title { color: #dc2626; }
.fb-mine { font-size: 13px; color: #6B6580; margin-bottom: 8px; }
.fb-mine b { color: #2D2541; }
.fb-explain, .fb-source { font-size: 13px; color: #4B4458; margin-top: 6px; line-height: 1.7; }
.fb-explain span, .fb-source span {
  display: inline-block; font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 99px; margin-right: 8px;
  background: rgba(183,148,246,0.12); color: #B794F6;
}

.q-nav { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.nav-btn {
  padding: 11px 22px; border-radius: 12px;
  background: transparent; border: 1.5px solid #EBE5F4;
  font-size: 13px; color: #6B6580; cursor: pointer;
  transition: all 0.18s;
}
.nav-btn:hover:not(:disabled) { border-color: #FF6B9D; color: #FF6B9D; }
.nav-btn.primary {
  background: linear-gradient(135deg, #FF6B9D, #B794F6); border: none; color: #fff;
  box-shadow: 0 6px 18px rgba(255,107,157,0.3);
}
.nav-btn.primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255,107,157,0.4); }
.nav-btn.finish {
  background: linear-gradient(135deg, #34D399, #10B981); border: none; color: #fff;
  box-shadow: 0 6px 18px rgba(52,211,153,0.3);
}
.nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.fb-enter-active, .fb-leave-active { transition: opacity 0.25s, transform 0.25s; }
.fb-enter-from, .fb-leave-to { opacity: 0; transform: translateY(8px); }

/* =============== 结果态 =============== */
.view-result { max-width: 820px; margin: 0 auto; width: 100%; }

.result-card {
  text-align: center; padding: 36px 30px 30px;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
  border: 1px solid rgba(235,229,244,0.7);
  border-radius: 28px;
  box-shadow: 0 20px 50px rgba(183,148,246,0.14);
  margin-bottom: 24px;
}
.result-ring-wrap { position: relative; width: 180px; height: 180px; margin: 0 auto 16px; }
.result-ring { width: 180px; height: 180px; transform: rotate(-90deg); }
.r-bg { fill: none; stroke: rgba(183,148,246,0.14); stroke-width: 12; }
.r-fg { fill: none; stroke-width: 12; stroke-linecap: round; stroke-dasharray: 427; stroke-dashoffset: 427; transition: stroke-dashoffset 1.2s cubic-bezier(.4,1.4,.6,1); filter: drop-shadow(0 0 8px rgba(255,107,157,0.4)); }
.result-score { position: absolute; inset: 0; display: flex; align-items: baseline; justify-content: center; }
.result-score strong { font-size: 50px; font-weight: 800; color: #2D2541; line-height: 1; background: linear-gradient(135deg, #FF6B9D, #B794F6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.result-score small { font-size: 16px; color: #9088A8; margin-left: 4px; }

.result-title { font-size: 22px; color: #2D2541; margin: 0 0 8px; font-weight: 700; }
.result-sub { font-size: 13px; color: #6B6580; margin: 0 0 14px; }
.diff-stats { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.diff-stat {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 5px 14px;
  border-radius: 99px;
  background: rgba(183,148,246,0.1); color: #6B6580; font-weight: 600;
}
.diff-stat i { width: 6px; height: 6px; border-radius: 50%; }
.diff-stat.easy { background: rgba(52,211,153,0.1); color: #16a34a; }
.diff-stat.easy i { background: #34D399; }
.diff-stat.medium { background: rgba(251,191,36,0.1); color: #d97706; }
.diff-stat.medium i { background: #FBBF24; }
.diff-stat.hard { background: rgba(248,113,113,0.1); color: #dc2626; }
.diff-stat.hard i { background: #F87171; }
.diff-stat b { color: inherit; }

.result-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 12px 24px; border-radius: 14px;
  background: transparent; border: 1.5px solid #EBE5F4;
  font-size: 14px; color: #6B6580; cursor: pointer;
  transition: all 0.18s;
}
.action-btn span { font-size: 15px; }
.action-btn:hover { border-color: #FF6B9D; color: #FF6B9D; transform: translateY(-1px); }
.action-btn.primary {
  background: linear-gradient(135deg, #FF6B9D, #B794F6); border: none; color: #fff;
  box-shadow: 0 8px 22px rgba(255,107,157,0.3);
}
.action-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(255,107,157,0.4); }
.action-btn.ghost { background: transparent; }

.review-list-card {
  background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
  border: 1px solid rgba(235,229,244,0.7);
  border-radius: 24px; padding: 22px 26px;
  box-shadow: 0 14px 36px rgba(183,148,246,0.10);
}
.review-title { font-size: 15px; color: #2D2541; margin: 0 0 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.review-title small { font-size: 11px; color: #9088A8; font-weight: 500; }
.review-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.review-items li {
  display: flex; gap: 14px; padding: 14px 0;
  border-bottom: 1px dashed #EBE5F4;
}
.review-items li:last-child { border-bottom: none; }
.r-idx {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(183,148,246,0.18), rgba(110,138,255,0.12));
  color: #6E8AFF; font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.review-items li.wrong .r-idx { background: rgba(248,113,113,0.14); color: #dc2626; }
.r-body { flex: 1; min-width: 0; }
.r-q { font-size: 13px; color: #2D2541; line-height: 1.65; margin-bottom: 6px; }
.q-pill-mini {
  display: inline-block; font-size: 10px; font-weight: 700;
  padding: 1px 8px; border-radius: 99px; margin-right: 6px;
  background: rgba(183,148,246,0.14); color: #B794F6;
  vertical-align: 1px;
}
.q-pill-mini.choice { background: rgba(255,107,157,0.12); color: #FF6B9D; }
.q-pill-mini.multi { background: rgba(251,191,36,0.14); color: #FB923C; }
.q-pill-mini.judge { background: rgba(110,138,255,0.12); color: #6E8AFF; }
.q-pill-mini.match { background: rgba(52,211,153,0.12); color: #34D399; }
.r-time { font-style: normal; font-size: 11px; color: #9088A8; margin-left: 8px; }
.r-meta { font-size: 12px; color: #6B6580; margin-bottom: 4px; }
.r-meta b { color: #2D2541; }
.r-correct { margin-left: 12px; color: #dc2626; }
.r-ok { margin-left: 8px; color: #34D399; font-weight: 800; }
.r-src { font-size: 11px; color: #9088A8; }

/* 响应式 */
@media (max-width: 960px) {
  .view-setup { grid-template-columns: 1fr; }
  .dash-grid { grid-template-columns: 1fr; }
  .config-card, .side-stack { grid-column: 1; }
  .course-grid { grid-template-columns: 1fr; }
  .q-card { padding: 24px 22px; }
  .q-text { font-size: 18px; }
}
</style>