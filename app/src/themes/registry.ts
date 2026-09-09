/**
 * 主题注册表
 * - 每个主题只需在此登记一条 ThemeDef，即可被主题引擎加载
 * - 当前仅翁法罗斯（招牌主题）；后续新增皮肤只需向 THEMES 追加条目
 * - CSS 变量统一使用 `--om-*` 命名空间（值随当前主题变化），免改整体样式表
 */
import { OMPHALOS_THEME } from './omphalos/theme'

export interface ThemePalette {
  bgDeep: string; bgMid: string; bgLight: string
  gold: string; goldDeep: string; accent: string
  textPri: string; textSec: string; textMute: string
}

export interface ThemeDef {
  id: string
  name: string
  palette: ThemePalette
  fonts: { cn: string }
}

/** 全量主题注册表：新增主题在此追加一条即可 */
export const THEMES: Record<string, ThemeDef> = {
  omphalos: OMPHALOS_THEME,
}

/** 主题 id 联合类型：由注册表推导，新增主题无需改类型 */
export type ThemeId = keyof typeof THEMES

/** 查询某主题是否存在 */
export function hasTheme(id: string | null | undefined): id is ThemeId {
  return !!id && id in THEMES
}

/** 取某主题定义（不存在则回退翁法罗斯招牌主题） */
export function getTheme(id?: string | null): ThemeDef {
  if (id && id in THEMES) return THEMES[id]
  return THEMES.omphalos
}