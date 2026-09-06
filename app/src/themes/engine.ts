/**
 * 主题皮肤引擎
 * - 加载翁法罗斯主题元数据（基底调色板 + 字体）
 * - 把主题的 palette 注入到 document.documentElement.style 的 CSS 变量上
 * - 提供装饰层开关（背景/粒子/顶部光晕），持久化到 localStorage
 * - 单一皮肤：翁法罗斯（紫夜鎏金），不提供多主题切换
 */
import { ref, computed, watchEffect } from 'vue'
import { OMPHALOS_THEME } from './omphalos/theme'

export type ThemeId = 'omphalos'

const STORAGE_KEY = 'notestar_active_theme'

const activeTheme = ref<ThemeId>('omphalos')

/** 皮肤装饰层开关（持久化） */
const LAYER_KEY = 'notestar_skin_layers'
const skinLayers = ref<Record<string, boolean>>({
  background: true,
  particles: true,
  haze: true,
})

// 从 localStorage 恢复层开关
if (typeof localStorage !== 'undefined') {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYER_KEY) || 'null')
    if (saved && typeof saved === 'object') {
      Object.keys(skinLayers.value).forEach(k => {
        if (typeof saved[k] === 'boolean') skinLayers.value[k] = saved[k]
      })
    }
  } catch { /* ignore */ }
}

/** 注入主题 CSS 变量到 :root */
function applyOmphalosVars() {
  // 把主题标识写到 :root，供全局 CSS 的 [data-theme="omphalos"] 选择器匹配
  if (typeof document !== 'undefined') {
    const el = document.documentElement
    el.setAttribute('data-theme', 'omphalos')
    // 若非软件回退模式，移除禁用毛玻璃标记
    if (!(window as any).__NOTESTAR_SOFTWARE__) el.classList.remove('sw-disable-blur')
  }
  const p = OMPHALOS_THEME.palette
  const r = document.documentElement.style
  r.setProperty('--om-bg-deep',     p.bgDeep)
  r.setProperty('--om-bg-mid',      p.bgMid)
  r.setProperty('--om-bg-light',    p.bgLight)
  r.setProperty('--om-gold',        p.gold)
  r.setProperty('--om-gold-deep',   p.goldDeep)
  r.setProperty('--om-accent',      p.accent)
  r.setProperty('--om-text-pri',    p.textPri)
  r.setProperty('--om-text-sec',    p.textSec)
  r.setProperty('--om-text-mute',   p.textMute)
  r.setProperty('--om-font-cn',     OMPHALOS_THEME.fonts.cn)
}

export function useThemeEngine() {
  // 初次挂载：注入翁法罗斯基底
  if (typeof document !== 'undefined') {
    applyOmphalosVars()
  }

  // 持久化
  watchEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, activeTheme.value)
    localStorage.setItem(LAYER_KEY, JSON.stringify(skinLayers.value))
  })

  function setTheme(id: ThemeId) {
    // 单一皮肤：仅翁法罗斯，切换其他无效
    if (id === 'omphalos') applyOmphalosVars()
  }

  function toggleLayer(key: string) {
    if (key in skinLayers.value) {
      skinLayers.value[key] = !skinLayers.value[key]
    }
  }

  return {
    activeTheme: computed(() => activeTheme.value),
    skinLayers,
    toggleLayer,
    setTheme,
  }
}
