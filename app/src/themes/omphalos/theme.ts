/**
 * 翁法罗斯主题 · 基底调色板（紫夜 + 鎏金）
 */
/** 翁法罗斯基底（紫黑 + 鎏金） */
export interface OmphalosPalette {
  bgDeep: string; bgMid: string; bgLight: string
  gold: string; goldDeep: string; accent: string
  textPri: string; textSec: string; textMute: string
}
export interface OmphalosTheme {
  id: 'omphalos'
  name: string
  palette: OmphalosPalette
  fonts: { cn: string }
}
export const OMPHALOS_THEME: OmphalosTheme = {
  id: 'omphalos',
  name: '翁法罗斯 · 黄金星海',
  palette: {
    bgDeep:    '#0A0418',
    bgMid:     '#1A0F35',
    bgLight:   '#2A1A4A',
    gold:      '#E8C66A',
    goldDeep:  '#C49A45',
    accent:    '#C896FF',
    textPri:   '#F5E0B0',
    textSec:   '#B9A9E0',
    textMute:  '#8B7FC4',
  },
  fonts: { cn: '"Noto Serif SC", "Source Han Serif SC", "SimSun", serif' },
}
