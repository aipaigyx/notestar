<template>
  <div class="chart-renderer">
    <!-- 柱状图 -->
    <div v-if="chart.type === 'bar'" class="bar-chart">
      <div v-for="(label, li) in chart.labels" :key="li" class="bar-col">
        <div class="bar-value">{{ chart.values?.[li] }}</div>
        <div class="bar-track">
          <div class="bar-fill" :style="{ height: Math.min(100, (chart.values?.[li] || 0) / maxVal * 100) + '%' }"></div>
        </div>
        <div class="bar-label">{{ label }}</div>
      </div>
    </div>

    <!-- 饼图 / 环形图 -->
    <div v-else-if="chart.type === 'pie'" class="pie-wrap">
      <div class="pie-chart" :style="{ background: pieGradient }"></div>
      <div class="pie-legend">
        <div v-for="(label, li) in chart.labels" :key="li" class="pie-legend-item">
          <span class="pie-dot" :style="{ background: COLORS[li % COLORS.length] }"></span>
          <span>{{ label }} {{ chart.values?.[li] != null ? '· ' + chart.values[li] + '%' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- 折线图（趋势） -->
    <div v-else-if="chart.type === 'line'" class="line-chart">
      <svg :viewBox="`0 0 ${W} ${H}`" class="line-svg">
        <!-- 网格 -->
        <line v-for="gy in gridYs" :key="gy" :x1="padL" :y1="gy" :x2="W - padR" :y2="gy" class="grid-line" />
        <!-- 折线 -->
        <polyline :points="linePoints" class="line-path" />
        <!-- 数据点 -->
        <circle v-for="(p, i) in points" :key="i" :cx="p.x" :cy="p.y" r="3.5" class="line-dot" />
        <!-- 值标签 -->
        <text v-for="(p, i) in points" :key="'t' + i" :x="p.x" :y="p.y - 8" class="line-val">{{ chart.values?.[i] }}</text>
      </svg>
      <div class="line-labels">
        <span v-for="(label, li) in chart.labels" :key="li" class="line-label">{{ label }}</span>
      </div>
    </div>

    <!-- 时间轴 -->
    <div v-else-if="chart.type === 'timeline'" class="timeline">
      <div v-for="(ev, ei) in chart.events" :key="ei" class="tl-item" :class="{ alt: ei % 2 === 1 }">
        <div class="tl-line"></div>
        <div class="tl-dot"></div>
        <div class="tl-content">
          <span class="tl-time">{{ ev.time }}</span>
          <span class="tl-title">{{ ev.title }}</span>
          <span v-if="ev.desc" class="tl-desc">{{ ev.desc }}</span>
        </div>
      </div>
    </div>

    <!-- 流程图（纵向步骤） -->
    <div v-else-if="chart.type === 'flow'" class="flow">
      <div v-for="(step, si) in chart.steps" :key="si" class="flow-step-row">
        <div class="flow-step">
          <span class="flow-num">{{ si + 1 }}</span>
          <span class="flow-text">{{ step }}</span>
        </div>
        <div v-if="si < (chart.steps?.length || 0) - 1" class="flow-arrow">↓</div>
      </div>
    </div>

    <!-- 维恩图（两集合） -->
    <div v-else-if="chart.type === 'venn'" class="venn">
      <svg :viewBox="`0 0 ${W} ${H}`" class="venn-svg">
        <circle cx="130" cy="130" r="78" class="venn-circle c1" />
        <circle cx="230" cy="130" r="78" class="venn-circle c2" />
        <text x="72" y="30" class="venn-set-label">{{ chart.sets?.[0] || 'A' }}</text>
        <text x="268" y="30" class="venn-set-label">{{ chart.sets?.[1] || 'B' }}</text>
        <!-- 独有项文本 -->
        <text v-for="(t, ti) in chart.onlyA" :key="'a' + ti" x="78" :y="100 + ti * 18" class="venn-text">{{ t }}</text>
        <text v-for="(t, ti) in chart.onlyB" :key="'b' + ti" x="262" :y="100 + ti * 18" class="venn-text">{{ t }}</text>
        <text v-for="(t, ti) in chart.both" :key="'m' + ti" x="180" :y="70 + ti * 18" class="venn-text both" text-anchor="middle">{{ t }}</text>
      </svg>
    </div>

    <!-- 对比表 -->
    <div v-else-if="chart.type === 'comparison'" class="comparison-table">
      <table>
        <thead>
          <tr>
            <th></th>
            <th v-for="(label, li) in chart.labels" :key="li">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in chart.rows" :key="ri">
            <td class="cmp-row-label">{{ row.label }}</td>
            <td v-for="(item, ii) in row.items" :key="ii">{{ item }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 未知类型兜底 -->
    <div v-else class="chart-fallback">[图表类型暂不支持]</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AnalysisChart } from '../../types'

const props = defineProps<{ chart: AnalysisChart }>()
const chart = computed(() => props.chart)

const COLORS = ['#FF6B9D', '#B794F6', '#4292F5', '#26D0A8', '#FF9948', '#F06595']
const W = 340
const H = 170
const padL = 34
const padR = 12

// 柱状图最大值（避免除零）
const maxVal = computed(() => {
  const values = chart.value.values || []
  const max = Math.max(...values.filter((v: number) => typeof v === 'number'))
  return max > 0 ? max : 1
})

// 饼图 conic-gradient
const pieGradient = computed(() => {
  const values = chart.value.values || []
  const total = values.reduce((s: number, v: number) => s + (Number(v) || 0), 0) || 1
  let acc = 0
  const stops = values.map((v: number, i: number) => {
    const pct = (Number(v) || 0) / total * 100
    const from = acc
    acc += pct
    return `${COLORS[i % COLORS.length]} ${from}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
})

// 折线图数据点
const points = computed(() => {
  const values = chart.value.values || []
  const labels = chart.value.labels || []
  const n = values.length
  if (n === 0) return []
  const maxV = Math.max(...values.filter((v: number) => typeof v === 'number'), 1)
  const innerW = W - padL - padR
  const innerH = H - 36
  return values.map((v: number, i: number) => ({
    x: n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW,
    y: innerH - (Number(v) || 0) / maxV * (innerH - 20) + 16,
  }))
})
const linePoints = computed(() => points.value.map(p => `${p.x},${p.y}`).join(' '))
const gridYs = computed(() => {
  const ys: number[] = []
  for (let i = 0; i < 4; i++) ys.push(H - 20 - i * 36)
  return ys
})
</script>

<style scoped>
.chart-renderer { width: 100%; }

/* 柱状图 */
.bar-chart { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; padding: 8px 0 4px; min-height: 130px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; height: 100%; justify-content: flex-end; }
.bar-value { font-size: 11px; font-weight: 700; color: var(--color-pink); }
.bar-track { width: 100%; max-width: 30px; height: 90px; background: rgba(183,148,246,0.12); border-radius: 8px; display: flex; align-items: flex-end; overflow: hidden; }
.bar-fill { width: 100%; border-radius: 8px 8px 3px 3px; background: var(--gradient-pink-purple); box-shadow: 0 2px 8px rgba(255,107,157,0.25); transition: height 0.5s ease; min-height: 3px; }
.bar-label { font-size: 10px; color: var(--color-text-muted); font-weight: 500; }

/* 饼图 */
.pie-wrap { display: flex; gap: 16px; align-items: center; padding: 6px 0; }
.pie-chart { width: 120px; height: 120px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 4px 14px rgba(183,148,246,0.2); }
.pie-legend { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.pie-legend-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--color-text); }
.pie-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* 折线图 */
.line-chart { padding: 4px 0; }
.line-svg { width: 100%; height: 150px; display: block; }
.grid-line { stroke: rgba(183,148,246,0.15); stroke-width: 1; stroke-dasharray: 4 4; }
.line-path { fill: none; stroke: #FF6B9D; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.line-dot { fill: #fff; stroke: #FF6B9D; stroke-width: 2; }
.line-val { font-size: 10px; fill: var(--color-pink); font-weight: 700; text-anchor: middle; }
.line-labels { display: flex; justify-content: space-between; padding: 0 30px 0 44px; }
.line-label { font-size: 10px; color: var(--color-text-muted); }

/* 时间轴 */
.timeline { position: relative; padding: 6px 0 2px 22px; }
.timeline::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: linear-gradient(180deg, rgba(255,107,157,0.5), rgba(183,148,246,0.4)); }
.tl-item { position: relative; padding: 4px 0 10px; }
.tl-dot { position: absolute; left: -19px; top: 10px; width: 10px; height: 10px; border-radius: 50%; background: var(--gradient-pink-purple); box-shadow: 0 0 0 3px rgba(255,107,157,0.18); }
.tl-line { display: none; }
.tl-content { display: flex; flex-direction: column; gap: 1px; }
.tl-time { font-size: 10.5px; font-weight: 700; color: var(--color-pink); }
.tl-title { font-size: 12.5px; font-weight: 600; color: var(--color-text); }
.tl-desc { font-size: 11px; color: var(--color-text-secondary); line-height: 1.5; }

/* 流程图 */
.flow { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; }
.flow-step-row { display: flex; flex-direction: column; align-items: center; width: 100%; }
.flow-step { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 260px; padding: 9px 14px; border-radius: 12px; background: var(--color-white); border: 1.5px solid rgba(255,192,213,0.55); box-shadow: var(--shadow-sm); }
.flow-num { width: 20px; height: 20px; border-radius: 50%; background: var(--gradient-pink-purple); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.flow-text { font-size: 12.5px; color: var(--color-text); line-height: 1.5; }
.flow-arrow { color: var(--color-pink); font-size: 14px; font-weight: 700; padding: 1px 0; }

/* 维恩图 */
.venn { display: flex; justify-content: center; padding: 4px 0; }
.venn-svg { width: 100%; max-width: 340px; height: 170px; }
.venn-circle { fill-opacity: 0.35; stroke-width: 2; }
.venn-circle.c1 { fill: #FF6B9D; stroke: #FF6B9D; }
.venn-circle.c2 { fill: #4292F5; stroke: #4292F5; }
.venn-set-label { font-size: 13px; font-weight: 800; fill: var(--color-text); }
.venn-text { font-size: 10px; fill: var(--color-text-secondary); }
.venn-text.both { font-weight: 700; fill: var(--color-text); }

/* 对比表 */
.comparison-table { overflow-x: auto; }
.comparison-table table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.comparison-table th { background: rgba(255,107,157,0.1); color: var(--color-pink); font-weight: 700; padding: 7px 10px; border: 1px solid rgba(255,192,213,0.4); text-align: left; }
.comparison-table td { padding: 6px 10px; border: 1px solid rgba(255,192,213,0.35); color: var(--color-text); vertical-align: top; line-height: 1.5; }
.comparison-table .cmp-row-label { font-weight: 700; color: var(--color-text-secondary); white-space: nowrap; background: rgba(246,241,251,0.6); }

.chart-fallback { font-size: 12px; color: var(--color-text-muted); padding: 12px; text-align: center; }
</style>
