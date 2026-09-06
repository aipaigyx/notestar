<template>
  <div class="titan-page" :class="{ 'is-night': extinguishedCount >= 12 }">
    <div class="glow-orb glow-pink" style="width: 420px; height: 420px; top: 40px; left: -100px;"></div>
    <div class="glow-orb glow-blue" style="width: 520px; height: 520px; bottom: -140px; right: 40px;"></div>
    <!-- 永夜终局：十二黄金裔尽数熄灭 -->
    <div v-if="extinguishedCount >= 12" class="tp-nightfall">
      <span class="tnf-icon">🌑</span>
      <strong class="tnf-title">永夜降临</strong>
      <span class="tnf-sub">十二黄金裔尽数熄灭，唯有逐火之旅能唤回黎明</span>
    </div>

    <div class="content-layer">
      <!-- ===== 页头：状态灯 ===== -->
      <header class="tp-header">
        <div class="tp-title-wrap">
          <h1 class="tp-title">黑潮侵蚀</h1>
          <p class="tp-sub">错题即黑潮 · 答对即逐火，守护翁法罗斯的十二黄金裔</p>
        </div>
        <div class="tp-state" :class="stateClass">
          <span class="ts-icon">{{ stateIcon }}</span>
          <div class="ts-body">
            <small>世界状态</small>
            <strong>{{ stateLabel }}</strong>
          </div>
        </div>
      </header>

      <!-- ===== 统计三卡 ===== -->
      <div class="tp-stats">
        <div class="tps-card wrong">
          <span class="tps-value">{{ todayWrong }}</span>
          <span class="tps-label">累计错题</span>
          <span class="tps-hint">再错 {{ nextErodeIn }} 题熄灭下一张</span>
        </div>
        <div class="tps-card dark">
          <span class="tps-value">{{ extinguishedCount }}<em>/12</em></span>
          <span class="tps-label">已被侵蚀</span>
          <span class="tps-hint">火种熄灭的黄金裔</span>
        </div>
        <div class="tps-card good">
          <span class="tps-value">{{ aliveCount }}<em>/12</em></span>
          <span class="tps-label">仍在守护</span>
          <span class="tps-hint">尚未被黑潮吞没</span>
        </div>
      </div>

      <!-- ===== 十二黄金裔牌阵（横向一排，可左右滑动） ===== -->
      <div class="tp-deck">
        <div class="tpd-legend">
          <span v-for="g in HEIR_GROUPS" :key="g.key" class="tpl-item">
            <i class="tpl-dot" :style="{ background: g.color }"></i>{{ g.label }}
          </span>
          <span class="tpl-hint">← 左右滑动查看全部 12 位黄金裔 →</span>
        </div>
        <div class="tpd-scroll">
          <div
            v-for="t in HEIRS"
            :key="t.id"
            class="titan-card"
            :class="{ extinct: erosionOf(t.id) >= 100, dying: erosionOf(t.id) > 0 && erosionOf(t.id) < 100, surging: surgingId === t.id }"
            :style="cardStyle(t)"
            @click="openDetail(t)"
          >
            <div class="tc-bar" :style="{ background: groupColor(t.group) }"></div>
            <div class="tc-inner">
              <img
                v-if="!imgFailed[t.id]"
                class="tc-img"
                :src="imgSrc(t.id)"
                :alt="t.name"
                @error="onImgError(t.id)"
              />
              <div v-else class="tc-fallback" :style="{ '--tc': t.color }">
                <span class="tcf-name">{{ t.name }}</span>
                <span class="tcf-core">「{{ t.core }}」</span>
              </div>
              <div class="tc-veil" :style="{ opacity: erosionOf(t.id) / 100 * 0.85 }"></div>
              <div class="tc-crack" :style="{ opacity: erosionOf(t.id) / 100 }"></div>
              <div v-if="surgingId === t.id" class="tc-surge-wave"></div>
              <!-- 红金圣火：全盛黄金裔浴火燃烧，侵蚀越深越被黑潮压灭 -->
              <div class="tc-goldflame" :style="{ opacity: goldFireOpacity(t.id) }">
                <span v-for="(fl, i) in FLAMES" :key="'g' + i" class="gflame" :style="{ left: fl.left, animationDelay: fl.delay, '--fs': fl.scale, height: Math.round(fl.h * 0.85) + 'px' }"></span>
                <span v-if="erosionOf(t.id) < 100" class="ember gold" :style="emberStyle(0)"></span>
                <span v-if="erosionOf(t.id) < 100" class="ember gold" :style="emberStyle(1)"></span>
                <span v-if="erosionOf(t.id) < 100" class="ember gold" :style="emberStyle(2)"></span>
                <span v-if="erosionOf(t.id) < 100" class="ember gold" :style="emberStyle(3)"></span>
                <span v-if="erosionOf(t.id) < 100" class="ember gold" :style="emberStyle(4)"></span>
              </div>
              <div class="tc-flame" :style="{ opacity: erosionOf(t.id) > 0 ? Math.min(1, 0.3 + erosionOf(t.id) / 70) : 0 }">
                <span v-for="(fl, i) in FLAMES" :key="i" class="flame" :style="{ left: fl.left, animationDelay: fl.delay, '--fs': fl.scale, height: blackFlameH(t, fl) }"></span>
                <span v-if="erosionOf(t.id) > 0" class="ember dark" :style="emberStyle(5)"></span>
                <span v-if="erosionOf(t.id) > 0" class="ember dark" :style="emberStyle(6)"></span>
                <span v-if="erosionOf(t.id) > 0" class="ember dark" :style="emberStyle(7)"></span>
              </div>
              <span v-if="erosionOf(t.id) >= 100" class="tc-extinct">已熄灭</span>
              <span v-else-if="erosionOf(t.id) > 0" class="tc-erosion">{{ erosionOf(t.id) }}%</span>
            </div>
            <div class="tc-foot">
              <span class="tcf-title">{{ t.name }}</span>
              <span class="tcf-group">{{ t.title }} · {{ t.core }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="tp-actions">
        <button class="tp-btn primary" @click="goQuiz">去复习，夺回火种</button>
        <span class="tp-note">侵蚀不可重置 —— 只能靠答对复习逐点夺回</span>
      </div>
    </div>

    <!-- ===== 详情弹层 ===== -->
    <div v-if="detail" class="tp-mask" @click.self="detail = null">
      <div class="tp-modal" :style="{ '--tc': detail.color }">
        <button class="tpm-close" @click="detail = null" aria-label="关闭">✕</button>
        <div class="tpm-head">
          <span class="tpm-core">{{ detail.title }}</span>
          <h3 class="tpm-name">{{ detail.name }}</h3>
          <span class="tpm-group">{{ groupLabel(detail.group) }} · 「{{ detail.core }}」火种</span>
        </div>
        <p class="tpm-desc">{{ detail.desc }}</p>
        <div class="tpm-meter">
          <div class="tpm-track"><div class="tpm-fill" :style="{ width: erosionOf(detail.id) + '%' }"></div></div>
          <span class="tpm-pct">侵蚀度 {{ erosionOf(detail.id) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { HEIRS, HEIR_GROUPS, type HeirDef, type HeirGroup } from '../data/heirs'
import {
  erosionMap, erosionOf, extinguishedCount, aliveCount, worldState, equivalentWrong,
  pulseCardId, pulseTick,
} from '../store/titanErosion'

// 7 根黑色火苗的固定种子（位置/延时/缩放/高度），保证渲染稳定不抖动
const FLAMES = [
  { left: '8%', delay: '0.0s', scale: '0.9', h: 52 },
  { left: '22%', delay: '0.4s', scale: '1.3', h: 60 },
  { left: '36%', delay: '0.8s', scale: '0.8', h: 46 },
  { left: '50%', delay: '0.2s', scale: '1.1', h: 56 },
  { left: '64%', delay: '0.6s', scale: '1.0', h: 50 },
  { left: '78%', delay: '0.1s', scale: '1.25', h: 58 },
  { left: '90%', delay: '0.5s', scale: '0.85', h: 48 },
]
// 余烬火星：固定 8 颗的种子（金火 0-4 号 / 黑火 5-7 号），位置/延迟/飘升距离稳定不抖动
const EMBERS = [
  { left: '10%', delay: '0.3s', dur: '2.4s', size: 3, dist: 46 },
  { left: '26%', delay: '1.1s', dur: '2.9s', size: 2, dist: 38 },
  { left: '42%', delay: '0.6s', dur: '2.5s', size: 3, dist: 52 },
  { left: '58%', delay: '1.5s', dur: '2.2s', size: 2, dist: 42 },
  { left: '74%', delay: '0.9s', dur: '2.7s', size: 3, dist: 48 },
  { left: '18%', delay: '0.5s', dur: '2.3s', size: 3, dist: 58 },
  { left: '47%', delay: '1.2s', dur: '2.6s', size: 2, dist: 46 },
  { left: '78%', delay: '0.8s', dur: '2.2s', size: 3, dist: 52 },
]
const emberStyle = (i: number) => {
  const e = EMBERS[i]
  const dx = i % 2 === 0 ? 5 : -5
  return { left: e.left, animationDelay: e.delay, animationDuration: e.dur, '--es': e.size + 'px', '--ed': e.dist + 'px', '--edx': dx + 'px' }
}
const router = useRouter()

// —— 图片回退：svg → png → jpg ——
const imgFailed = reactive<Record<string, boolean>>({})
const imgTry = reactive<Record<string, number>>({})
const imgSrc = (id: string) => {
  const i = imgTry[id] || 0
  return [`heirs/${id}.svg`, `heirs/${id}.png`, `heirs/${id}.jpg`][i]
}
const onImgError = (id: string) => {
  const next = (imgTry[id] || 0) + 1
  if (next < 3) imgTry[id] = next
  else imgFailed[id] = true
}

// —— 派生（全部来自状态层，单一数据源）——
const groupColor = (g: HeirGroup) => HEIR_GROUPS.find(x => x.key === g)?.color || '#B794F6'
const groupLabel = (g: HeirGroup) => HEIR_GROUPS.find(x => x.key === g)?.label || ''
const todayWrong = computed(() => equivalentWrong.value)
const nextErodeIn = computed(() => 10 - (equivalentWrong.value % 10))
const stateClass = computed(() => 'st-' + worldState.value)
const stateIcon = computed(() => ({ dawn: '☀', cloudy: '⛅', dusk: '🌇', night: '🌑' } as any)[worldState.value])
const stateLabel = computed(() => ({ dawn: '永昼', cloudy: '阴翳', dusk: '黄昏', night: '永夜' } as any)[worldState.value])

const cardStyle = (t: HeirDef) => {
  const e = erosionOf(t.id)
  return {
    '--tc': t.color,
    '--ring-op': e >= 100 ? 0 : Math.max(0.15, 1 - e / 100),
    filter: `brightness(${100 - e * 0.38}%) contrast(${100 + e * 0.2}%) saturate(${100 + e * 0.1}%)`,
  } as any
}

// 红金圣火：全盛(0%)最旺，侵蚀越深圣火越被压灭，熄灭后归零（由黑火接管）
const goldFireOpacity = (id: string) => {
  const e = erosionOf(id)
  if (e >= 100) return 0
  return Math.max(0, Math.round((1 - e / 100) * 0.78 * 10) / 10)
}

// 黑火高度随侵蚀加深而窜高（侵蚀越重，火舌越猛烈，最高约 1.55 倍）
const blackFlameH = (t: HeirDef, fl: { h: number }) => {
  const e = erosionOf(t.id)
  const boost = 1 + (e / 100) * 0.55
  return Math.round(fl.h * boost) + 'px'
}

// —— 交互 ——
const detail = ref<HeirDef | null>(null)
const openDetail = (t: HeirDef) => { detail.value = t }
const goQuiz = () => router.push('/quiz')

// —— 黑潮实时涌动：监听侵蚀脉冲，让被侵蚀的牌短暂播放动效 ——
const surgingId = ref<string | null>(null)
watch(pulseTick, () => {
  surgingId.value = pulseCardId.value
  window.setTimeout(() => { surgingId.value = null }, 900)
})
</script>

<style scoped>
.titan-page { position: relative; padding: 28px 32px 60px; min-height: 100vh; }
.tp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 22px; }
.tp-title { font-size: 28px; font-weight: 800; margin: 0 0 6px; background: var(--gradient-pink-purple); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.tp-sub { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
.tp-state { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-radius: var(--radius-card); background: var(--color-bg-card); border: 1px solid var(--om-border, rgba(183,148,246,0.18)); }
.ts-icon { font-size: 26px; line-height: 1; }
.ts-body { display: flex; flex-direction: column; }
.ts-body small { font-size: 11px; color: var(--color-text-tertiary); }
.ts-body strong { font-size: 16px; }
.tp-state.st-night { border-color: rgba(120,120,140,0.5); }
.tp-state.st-dusk { border-color: rgba(217,112,95,0.45); }

.tp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 26px; }
.tps-card { padding: 18px 20px; border-radius: var(--radius-card); background: var(--color-bg-card); border: 1px solid var(--om-border, rgba(183,148,246,0.18)); display: flex; flex-direction: column; }
.tps-value { font-size: 30px; font-weight: 800; line-height: 1.1; }
.tps-value em { font-size: 15px; font-style: normal; font-weight: 600; color: var(--color-text-tertiary); }
.tps-label { font-size: 13px; font-weight: 600; margin-top: 2px; }
.tps-hint { font-size: 11px; color: var(--color-text-tertiary); margin-top: 6px; }
.tps-card.wrong .tps-value { color: #E8778D; }
.tps-card.dark .tps-value { color: #8B88A8; }
.tps-card.good .tps-value { color: #6DBE8C; }

.tp-deck { margin-bottom: 8px; }
.tpd-legend { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
.tpl-item { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-secondary); }
.tpl-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.tpl-hint { margin-left: auto; font-size: 11px; color: var(--color-text-tertiary); }

/* 横向一排：卡片固定适中宽度（约 170px），超出可左右滑动 */
.tpd-scroll {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 2px 14px;
  scroll-snap-type: x proximity;
}
.tpd-scroll::-webkit-scrollbar { height: 8px; }
.tpd-scroll::-webkit-scrollbar-thumb { background: rgba(183,148,246,0.35); border-radius: 999px; }
.tpd-scroll::-webkit-scrollbar-track { background: transparent; }

.titan-card {
  position: relative;
  flex: 0 0 auto;
  width: 170px;
  scroll-snap-align: start;
  cursor: pointer;
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-bg-card);
  border: 1px solid var(--om-border, rgba(183,148,246,0.18));
  transition: transform .22s ease, box-shadow .22s ease, filter .6s ease;
}
.titan-card:hover { transform: translateY(-4px); box-shadow: 0 10px 28px rgba(107,134,255,0.18); }

/* 黄金血脉 · 边框流光：全盛黄金裔的卡框持续扫过一圈金色流光（开 SSR 的观感）
   侵蚀越深流光越弱，熄灭后归零，由底部黑火接管 */
@property --ring-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
.titan-card::before {
  content: ''; position: absolute; inset: 0; z-index: 6; pointer-events: none;
  border-radius: inherit; padding: 2px;
  background: conic-gradient(from var(--ring-a, 0deg),
    rgba(240,205,120,0) 0deg, rgba(240,205,120,0) 262deg,
    rgba(255,240,196,0.95) 342deg, rgba(240,205,120,0.35) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: var(--ring-op, 0);
  transition: opacity .6s ease;
  animation: ring-sweep 3s linear infinite;
}
@keyframes ring-sweep { to { --ring-a: 360deg; } }

/* 黑潮涌动：被侵蚀瞬间的实时动效 */
.titan-card.surging { animation: tc-shake 0.9s ease; z-index: 2; }
@keyframes tc-shake {
  0% { transform: translateY(0); }
  12% { transform: translateY(-7px) rotate(-1.4deg); }
  28% { transform: translateY(5px) rotate(1.4deg); }
  46% { transform: translateY(-3px) rotate(-0.8deg); }
  70% { transform: translateY(2px); }
  100% { transform: translateY(0); }
}
.tc-surge-wave {
  position: absolute; inset: 0; z-index: 3; pointer-events: none;
  background: linear-gradient(to top, rgba(20,6,34,0.96), rgba(82,20,104,0.5) 55%, transparent);
  animation: tc-wave 0.9s ease forwards;
}
@keyframes tc-wave {
  0% { opacity: 0; transform: translateY(45%); }
  28% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12%); }
}
.tc-bar { height: 3px; width: 100%; }
.tc-inner { position: relative; aspect-ratio: 300 / 420; background: #171225; }
.tc-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tc-fallback { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(160deg, #2A2140, #171225); }
.tcf-name { font-size: 30px; font-weight: 800; color: var(--tc); }
.tcf-core { font-size: 13px; color: #B9B2D6; }
.tc-veil { position: absolute; inset: 0; z-index: 3; background: radial-gradient(circle at 50% 42%, rgba(24,9,42,0.14), rgba(14,4,26,0.98)); pointer-events: none; transition: opacity .6s ease; }
.tc-crack { position: absolute; inset: 0; z-index: 1; pointer-events: none; transition: opacity .6s ease;
  background:
    linear-gradient(118deg, transparent 45%, rgba(8,2,16,0.72) 46.5%, transparent 48%),
    linear-gradient(64deg, transparent 60%, rgba(8,2,16,0.56) 61.5%, transparent 63%),
    linear-gradient(152deg, transparent 28%, rgba(8,2,16,0.48) 29.5%, transparent 31%),
    linear-gradient(96deg, transparent 74%, rgba(8,2,16,0.4) 75.4%, transparent 77%),
    linear-gradient(36deg, transparent 52%, rgba(8,2,16,0.32) 53.4%, transparent 55%),
    radial-gradient(120% 90% at 50% 115%, rgba(30,6,52,0.85), transparent 60%); }
/* 红金圣火：全盛黄金裔自卡底向上窜烧的红金色火焰（内芯亮金白、外缘炽红），与黑火此消彼长 */
.tc-goldflame { position: absolute; left: 0; right: 0; top: 0; bottom: 0; z-index: 4; pointer-events: none; opacity: 0; transition: opacity .6s ease; }
.tc-goldflame::before { content:''; position: absolute; left: 0; right: 0; bottom: 0; height: 52%;
  background: radial-gradient(96% 78% at 50% 100%, rgba(255,214,120,0.32) 0%, rgba(255,140,60,0.14) 46%, transparent 74%); }
.tc-goldflame .gflame { position: absolute; bottom: 0; width: calc(17px * var(--fs, 1));
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 100'><defs><linearGradient id='gfl' x1='0' y1='1' x2='0' y2='0'><stop offset='0' stop-color='%23FFF9E0'/><stop offset='24%' stop-color='%23FFE08A'/><stop offset='50%' stop-color='%23FFA33C'/><stop offset='76%' stop-color='%23F2601F'/><stop offset='100%' stop-color='%23C62D10' stop-opacity='0'/></linearGradient></defs><path d='M22 98 C6 86 3 60 13 42 C17 33 20 25 20 16 C22 8 24 2 25 0 C27 10 31 18 33 27 C38 42 42 64 35 80 C32 89 27 96 22 98 Z' fill='url(%23gfl)'/><path d='M22 96 C15 87 13 74 18 63 C20 57 22 51 22 45 C23 39 24 33 25 28 C26 34 27 40 27 47 C29 62 28 80 23 90 C22 93 22 95 22 96 Z' fill='%23FFFDF2' opacity='0.85'/></svg>");
  background-size: 100% 100%; background-repeat: no-repeat;
  transform-origin: 50% 100%; animation: gf-burn 1.5s ease-in-out infinite alternate;
  filter: drop-shadow(0 0 6px rgba(255,180,80,0.55)) drop-shadow(0 2px 10px rgba(255,120,40,0.28)); }
@keyframes gf-burn {
  0%   { transform: translateY(3px) scale(var(--fs,1), calc(var(--fs,1) * 0.92)) rotate(-2.2deg); opacity: .85; }
  45%  { transform: translateY(-18px) scale(calc(var(--fs,1) * 0.9), calc(var(--fs,1) * 1.26)) rotate(2deg); opacity: 1; }
  100% { transform: translateY(-9px) scale(calc(var(--fs,1) * 1.05), calc(var(--fs,1) * 1.04)) rotate(-0.6deg); opacity: .92; }
}
/* 黑色火焰：从卡片底部持续向上窜烧（侵蚀越深越旺） */
.tc-flame { position: absolute; left: 0; right: 0; top: 0; bottom: 0; z-index: 4;
  pointer-events: none; opacity: 0; transition: opacity .6s ease; filter: blur(1.1px); }
.tc-flame::before { content:''; position: absolute; left: 0; right: 0; bottom: 0; height: 80%;
  background:
    linear-gradient(to top, rgba(6,1,12,0.98) 0%, rgba(26,7,40,0.86) 36%, rgba(60,16,84,0.44) 66%, transparent 92%),
    radial-gradient(70% 46% at 50% 100%, rgba(74,20,110,0.5) 0%, transparent 72%);
  background-blend-mode: normal; }
.tc-flame .flame { position: absolute; bottom: 0; width: calc(17px * var(--fs, 1));
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 100'><defs><linearGradient id='dfl' x1='0' y1='1' x2='0' y2='0'><stop offset='0' stop-color='%238C36C8'/><stop offset='28%' stop-color='%23621A96'/><stop offset='58%' stop-color='%23300B50'/><stop offset='100%' stop-color='%230B0216' stop-opacity='0'/></linearGradient></defs><path d='M22 98 C7 84 5 62 13 44 C17 35 19 27 19 18 C21 11 23 5 25 0 C27 9 31 16 33 25 C38 40 41 62 35 78 C32 87 28 94 22 98 Z' fill='url(%23dfl)'/><path d='M22 95 C15 86 14 73 18 62 C20 55 21 49 21 43 C22 39 23 35 24 31 C25 37 27 43 28 49 C30 61 30 76 26 87 C25 91 24 93 22 95 Z' fill='%23C27AF0' opacity='0.5'/><path d='M22 90 C18 82 17 72 19 64 C20 58 21 54 22 48 C23 54 24 58 25 64 C27 72 26 82 22 90 Z' fill='%23F0DDFF' opacity='0.35'/></svg>");
  background-size: 100% 100%; background-repeat: no-repeat;
  transform-origin: 50% 100%; animation: tc-flicker 1.4s ease-in-out infinite alternate;
  filter: drop-shadow(0 0 5px rgba(140,60,220,0.4)) drop-shadow(0 0 14px rgba(90,30,160,0.22)); }
@keyframes tc-flicker {
  0%   { transform: translateY(0) scale(var(--fs,1), calc(var(--fs,1) * 0.9)) rotate(-2deg); opacity: .8; }
  45%  { transform: translateY(-17px) scale(calc(var(--fs,1) * 0.86), calc(var(--fs,1) * 1.22)) rotate(2deg); opacity: 1; }
  100% { transform: translateY(-8px) scale(var(--fs,1), calc(var(--fs,1) * 1.02)) rotate(-0.4deg); opacity: .92; }
}
/* 余烬火星：从火焰中迸出向上飘散，明灭隐现（金色随圣火、紫色随黑火） */
.ember { position: absolute; bottom: 26%; border-radius: 50%; pointer-events: none;
  opacity: 0; will-change: transform, opacity; }
.ember.gold { background: radial-gradient(circle, #FFF3C4 0%, #FFC24B 55%, rgba(255,150,60,0) 100%);
  animation: ember-rise 2.4s ease-out infinite; box-shadow: 0 0 6px 1px rgba(255,190,90,0.55); }
.ember.dark { background: radial-gradient(circle, #D9B0FF 0%, #8C3CC8 55%, rgba(120,50,200,0) 100%);
  animation: ember-rise 2.4s ease-out infinite; box-shadow: 0 0 5px 1px rgba(150,90,235,0.4); }
@keyframes ember-rise {
  0%   { transform: translate(0, 0) scale(0.5); opacity: 0; }
  15%  { opacity: 1; }
  70%  { opacity: .65; }
  100% { transform: translate(var(--edx, 0px), calc(-1 * var(--ed, 46px))) scale(1); opacity: 0; }
}
.ember { width: var(--es, 3px); height: var(--es, 3px); }
.tc-extinct { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); padding: 6px 14px; border-radius: var(--radius-pill); background: rgba(0,0,0,0.72); color: #CFCADF; font-size: 12px; letter-spacing: 2px; }
.tc-erosion { position: absolute; right: 8px; top: 8px; padding: 3px 9px; border-radius: var(--radius-pill); background: rgba(0,0,0,0.62); color: #E8B4C0; font-size: 11px; font-weight: 700; }
.tc-foot {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  position: relative;
  background: linear-gradient(180deg, rgba(0,0,0,0.02), rgba(139,95,196,0.06));
  border-top: 1px solid rgba(232,198,106,0.12);
}
/* 顶部鎏金装饰线 */
.tc-foot::before {
  content: '';
  position: absolute;
  top: -1px; left: 12px; right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(232,198,106,0.4), rgba(232,198,106,0.6), rgba(232,198,106,0.4), transparent);
  opacity: 0.8;
}
.tcf-title {
  font-size: 14px; font-weight: 700;
  background: linear-gradient(120deg, #F5E9FF, #E8C66A 50%, #F5E9FF);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  letter-spacing: 0.5px;
  transition: filter .5s ease;
}
.tcf-group {
  font-size: 11px; color: var(--color-text-tertiary);
  margin-top: 3px;
  letter-spacing: 0.3px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 分组标识色点 */
.tcf-group::before {
  content: '';
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--tc, #B794F6);
  flex-shrink: 0;
  box-shadow: 0 0 4px var(--tc, #B794F6);
}

/* 熄灭态：卡片底部整体变暗，标题灰色 */
.extinct .tc-foot {
  background: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(40,10,60,0.25));
  border-top-color: rgba(100,80,130,0.2);
}
.extinct .tc-foot::before {
  opacity: 0.2;
  background: linear-gradient(90deg, transparent, rgba(140,110,180,0.3), transparent);
}
.extinct .tcf-title {
  background: none;
  color: #8B88A8;
  filter: grayscale(0.6);
}
.extinct .tcf-group { color: #6B6888; }
.extinct .tcf-group::before { opacity: 0.35; }

.tp-actions { display: flex; gap: 12px; margin-top: 30px; }
.tp-btn { padding: 12px 26px; border-radius: var(--radius-pill); font-size: 14px; font-weight: 700; cursor: pointer; border: none; }
.tp-btn.primary { background: var(--gradient-pink-purple); color: #fff; box-shadow: 0 6px 18px rgba(255,107,157,0.28); }
.tp-btn.ghost { background: transparent; color: var(--color-text-secondary); border: 1px solid var(--om-border, rgba(183,148,246,0.3)); }

.tp-mask { position: fixed; inset: 0; background: rgba(12,8,20,0.62); display: flex; align-items: center; justify-content: center; z-index: 60; }
.tp-modal { position: relative; width: 420px; max-width: 92vw; padding: 26px 28px; border-radius: 18px; background: var(--color-bg-card); border: 1px solid var(--om-border, rgba(183,148,246,0.24)); }
.tpm-close { position: absolute; right: 14px; top: 12px; background: none; border: none; font-size: 16px; color: var(--color-text-tertiary); cursor: pointer; }
.tpm-core { font-size: 12px; color: var(--tc); font-weight: 700; }
.tpm-name { margin: 6px 0 4px; font-size: 24px; font-weight: 800; }
.tpm-group { font-size: 12px; color: var(--color-text-tertiary); }
.tpm-desc { margin: 16px 0 18px; font-size: 14px; line-height: 1.7; color: var(--color-text-secondary); }
.tpm-meter { display: flex; align-items: center; gap: 10px; }
.tpm-track { flex: 1; height: 8px; border-radius: var(--radius-pill); background: rgba(120,110,160,0.22); overflow: hidden; }
.tpm-fill { height: 100%; border-radius: var(--radius-pill); background: linear-gradient(90deg, #8B88A8, #E8778D); transition: width .5s ease; }
.tpm-pct { font-size: 12px; font-weight: 700; color: var(--color-text-secondary); }

/* ===== 永夜终局：十二黄金裔尽数熄灭 ===== */
.tp-nightfall {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 24px;
  background: radial-gradient(circle at 50% 40%, rgba(20,15,30,0.86), rgba(4,3,8,0.96));
  backdrop-filter: blur(2px);
  color: #CFCADF;
}
.tnf-icon { font-size: 54px; line-height: 1; }
.tnf-title { font-size: 30px; font-weight: 800; letter-spacing: 4px; color: #E8778D; margin: 4px 0; }
.tnf-sub { font-size: 13px; color: #8B88A8; max-width: 320px; line-height: 1.6; }

/* 永夜时整体压暗，强化"世界沉入黑暗"感 */
.titan-page.is-night .tp-deck,
.titan-page.is-night .tp-stats { filter: saturate(0.5) brightness(0.6) contrast(1.05); transition: filter .8s ease; }
</style>
