/**
 * 主题皮肤引擎
 * - 从注册表 THEMES 加载当前主题（当前为翁法罗斯招牌主题）的基底调色板 + 字体
 * - 把主题的 palette 注入到 document.documentElement.style 的 CSS 变量上
 * - 提供装饰层开关（背景/粒子/顶部光晕），持久化到 localStorage
 * - 注册表驱动：新增主题只需在 registry.ts 登记，引擎无需改动
 */
import { ref, computed, watchEffect } from 'vue'
import { THEMES, getTheme, hasTheme, type ThemeId } from './registry'

export type { ThemeId } from './registry'

const STORAGE_KEY = 'notestar_active_theme'

const activeTheme = ref<ThemeId>(getInitialTheme())

// 从 localStorage 恢复上次激活主题（非法值回退默认）
function getInitialTheme(): ThemeId {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && hasTheme(saved)) return saved
    } catch { /* ignore */ }
  }
  return 'omphalos'
}

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

/** 注入某主题的 CSS 变量到 :root */
function applyThemeVars(id: ThemeId) {
  const theme = getTheme(id)
  // 把主题标识写到 :root，供全局 CSS 的 [data-theme="*"] 选择器匹配
  if (typeof document !== 'undefined') {
    const el = document.documentElement
    el.setAttribute('data-theme', id)
    // 若非软件回退模式，移除禁用毛玻璃标记
    if (!(window as any).__NOTESTAR_SOFTWARE__) el.classList.remove('sw-disable-blur')
  }
  const p = theme.palette
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
  r.setProperty('--om-font-cn',     theme.fonts.cn)
}

export function useThemeEngine() {
  // 初次挂载：注入当前激活主题基底
  if (typeof document !== 'undefined') {
    applyThemeVars(activeTheme.value)
  }

  // 持久化
  watchEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, activeTheme.value)
    localStorage.setItem(LAYER_KEY, JSON.stringify(skinLayers.value))
  })

  function setTheme(id: ThemeId) {
    if (!hasTheme(id)) return
    activeTheme.value = id
    applyThemeVars(id)
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

// 暴露主题注册表面（供新建皮肤/选择器用）
export { THEMES }