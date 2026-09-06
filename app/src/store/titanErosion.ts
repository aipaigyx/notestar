// 黄金裔侵蚀状态层（黑潮侵蚀系统）
// 设计原则：**无重置**。侵蚀度只能由答题行为驱动——答错累积侵蚀、答对/完成复习削减侵蚀。
// 终局只有两极：全部恢复（0%） / 全部熄灭（100%），不提供任何手动清零入口。

import { reactive, computed, ref } from 'vue'
import { HEIRS, EROSION_ORDER, type HeirGroup } from '../data/heirs'
import { playHeirVoice } from '../utils/voicePlayer'

// v2：设定从「十二泰坦」修正为「十二黄金裔」后更换键名，旧结构数据不再读取（避免 id 错位）
const STORAGE_KEY = 'notestar.heir.erosion.v2'

// 每张牌的侵蚀度 0~100
const erosion = reactive<Record<string, number>>(load())

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object') return obj
    }
  } catch (e) { /* 数据损坏则全 0 */ }
  const init: Record<string, number> = {}
  for (const h of HEIRS) init[h.id] = 0
  return init
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...erosion })) } catch (e) { /* ignore */ }
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

export const erosionMap = erosion
export const erosionOf = (id: string) => erosion[id] || 0

/** 黑潮脉冲信号：erode 时置位，供页面播放实时侵蚀动效（非挂载页面时仅更新状态） */
export const pulseCardId = ref<string | null>(null)
export const pulseTick = ref(0)
export function heirName(id: string): string {
  return HEIRS.find(h => h.id === id)?.name || id
}

/** 累计侵蚀总量（0 ~ 1200） */
export const totalErosion = computed(() =>
  HEIRS.reduce((acc, h) => acc + (erosion[h.id] || 0), 0)
)
/** 已熄灭的黄金裔数 */
export const extinguishedCount = computed(() =>
  HEIRS.filter(h => (erosion[h.id] || 0) >= 100).length
)
/** 仍在守护的黄金裔数 */
export const aliveCount = computed(() => 12 - extinguishedCount.value)
/** 世界状态：永昼 / 阴翳 / 黄昏 / 永夜 */
export const worldState = computed(() => {
  const n = extinguishedCount.value
  if (n === 0 && totalErosion.value === 0) return 'dawn'
  if (n >= 12) return 'night'
  if (n >= 6) return 'dusk'
  return 'cloudy'
})
/** 等价错题数（每 10% 侵蚀 ≈ 1 道错题） */
export const equivalentWrong = computed(() => Math.round(totalErosion.value / 10))

/**
 * 黑潮侵蚀：按熄灭顺序（灾厄→命运→支柱→创生）定向推进
 * @param amount 侵蚀增量（默认 10，即 1 道错题）
 * @returns 被侵蚀的黄金裔 id（已全灭则返回 null）
 */
export function erode(amount = 10): string | null {
  // 先找还没熄灭、且属于最靠前分组的黄金裔
  for (const g of EROSION_ORDER) {
    const target = HEIRS
      .filter(h => h.group === g && (erosion[h.id] || 0) < 100)
      .sort((a, b) => (erosion[a.id] || 0) - (erosion[b.id] || 0))[0]
    if (target) {
      const before = erosion[target.id] || 0
      erosion[target.id] = clamp((erosion[target.id] || 0) + amount)
      const after = erosion[target.id]
      persist()
      pulseCardId.value = target.id
      pulseTick.value++
      // 卡片达到 100% 熄灭 → 播放角色语音
      if (before < 100 && after >= 100) {
        playHeirVoice(target.voice)
      }
      return target.id
    }
  }
  return null
}

/**
 * 逐火复苏：削减侵蚀（从侵蚀最浅的开始回补）
 * @param amount 恢复量（默认 10）
 * @returns 被恢复的黄金裔 id
 */
export function revive(amount = 10): string | null {
  // 抢救「最濒危」的黄金裔（侵蚀度最高者优先），更贴合"逐火救世"叙事
  const candidates = HEIRS
    .filter(h => (erosion[h.id] || 0) > 0)
    .sort((a, b) => (erosion[b.id] || 0) - (erosion[a.id] || 0))
  const target = candidates[0]
  if (!target) return null
  erosion[target.id] = clamp((erosion[target.id] || 0) - amount)
  persist()
  return target.id
}

/** 分组内已熄灭数（供 UI 展示） */
export function groupExtinct(g: HeirGroup): number {
  return HEIRS.filter(h => h.group === g && (erosion[h.id] || 0) >= 100).length
}
