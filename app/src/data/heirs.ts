// 翁法罗斯十二黄金裔 — 卡牌数据
// 设定修正（2026-09-03）：本系统站台的英雄是「黄金裔」（继承泰坦火种的逐火者），而非泰坦神明。
// 每组黄金裔正好承接对应「神权三泰坦」的火种：命运（岁月/律法/门径）· 支柱（天空/大地/海洋）
// · 创生（浪漫/负世/理性）· 灾厄（诡计/纷争/死亡）。
// 图片约定：public/heirs/<id>.svg（占位图），把真图按同名放入即可替换。
// 页面会自动尝试 <id>.svg → <id>.png → <id>.jpg，找不到则回退 CSS 渐变卡面。

export type HeirGroup = 'fate' | 'pillar' | 'genesis' | 'calamity'

export interface HeirDef {
  id: string        // 图片文件名（不含扩展名）
  name: string      // 黄金裔名（中文）
  roman: string     // 罗马名 / 英文名
  title: string     // 称号
  core: string      // 继承火种（神权）
  group: HeirGroup
  color: string     // 主色（卡片光晕/描边）
  desc: string      // 简介（点开卡片看）
  voice: string     // 熄灭语音路径（public/heirs/voices/<id>.mp3）
}

export const HEIR_GROUPS: { key: HeirGroup; label: string; sub: string; color: string }[] = [
  { key: 'fate',     label: '命运三裔', sub: '继承 · 编织命运', color: '#8B7CE8' },
  { key: 'pillar',   label: '支柱三裔', sub: '继承 · 开辟天地', color: '#5DADE2' },
  { key: 'genesis',  label: '创生三裔', sub: '继承 · 捏塑生命', color: '#E8B04B' },
  { key: 'calamity', label: '灾厄三裔', sub: '继承 · 引渡灾祸', color: '#D9705F' },
]

export const HEIRS: HeirDef[] = [
  // —— 命运三裔 ——
  { id: 'march7',    name: '三月七',     roman: 'March 7th',     title: '隐秘的陌客', core: '岁月', group: 'fate',     color: '#5EC8E5', desc: '隐匿「岁月」之火的黄金裔。于永夜之帷中取回未来，以快门定格流光的隐秘陌客。', voice: 'heirs/voices/march7.mp3' },
  { id: 'cerydra',   name: '刻律德菈',   roman: 'Cerydra',       title: '执棋的君主', core: '律法', group: 'fate',     color: '#8FAADC', desc: '执握「律法」之火的黄金裔。以公正之秤衡量众生，于棋局之上落定秩序的君主。', voice: 'heirs/voices/cerydra.mp3' },
  { id: 'tribbie',   name: '缇宝',       roman: 'Tribbie',       title: '命运的三子', core: '门径', group: 'fate',     color: '#C9A0DC', desc: '窃夺「门径」之火的黄金裔。雅努萨波利斯的圣女，三人同体的预言信使。', voice: 'heirs/voices/tribbie.mp3' },
  // —— 支柱三裔 ——
  { id: 'hyacine',   name: '风堇',       roman: 'Hyacine',       title: '摇光的医师', core: '天空', group: 'pillar',   color: '#7FD4F0', desc: '守望「天空」之火的黄金裔。昏光庭院的医师，缝合破裂的晨昏，为永夜捎来微光。', voice: 'heirs/voices/hyacine.mp3' },
  { id: 'danheng',   name: '丹恒·腾荒',  roman: 'Dan Heng',      title: '腾飞的荒龙', core: '大地', group: 'pillar',   color: '#5FA98F', desc: '捍卫「大地」之火的黄金裔。腾飞的荒龙越过沉眠的山脉，将誓约带往黎明。', voice: 'heirs/voices/danheng.mp3' },
  { id: 'hysilens',  name: '海瑟音',     roman: 'Hysilens',      title: '奏浪的剑骑', core: '海洋', group: 'pillar',   color: '#54A6D8', desc: '清洗「海洋」之火的黄金裔。斯缇科西亚的大海之女，以浪涛为剑，奏响不散的乐章。', voice: 'heirs/voices/hysilens.mp3' },
  // —— 创生三裔 ——
  { id: 'aglaea',    name: '阿格莱雅',   roman: 'Aglaea',        title: '黄金的织者', core: '浪漫', group: 'genesis',  color: '#E0A94E', desc: '背负「浪漫」之火的黄金裔。奥赫玛的织者，以金丝连缀命运，召集英雄再踏征途。', voice: 'heirs/voices/aglaea.mp3' },
  { id: 'phainon',   name: '白厄',       roman: 'Phainon',       title: '无名的英雄', core: '负世', group: 'genesis',  color: '#EFB93D', desc: '容纳「负世」之火的黄金裔。背负万众命运的无名英雄，愿化作明日不熄的烈阳。', voice: 'heirs/voices/phainon.mp3' },
  { id: 'anaxa',     name: '那刻夏',     roman: 'Anaxa',         title: '殁世的学士', core: '理性', group: 'genesis',  color: '#74C69D', desc: '诘问「理性」之火的黄金裔。神悟树庭的贤人，将怀疑的枝杈刺入智慧的圣树。', voice: 'heirs/voices/anaxa.mp3' },
  // —— 灾厄三裔 ——
  { id: 'cipher',    name: '赛飞儿',     roman: 'Cipher',        title: '捷足的贼星', core: '诡计', group: 'calamity', color: '#D09A5A', desc: '戏弄「诡计」之火的黄金裔。多洛斯的贼星，以谎言与神速在命运间穿行。', voice: 'heirs/voices/cipher.mp3' },
  { id: 'mydei',     name: '万敌',       roman: 'Mydei',         title: '亡国的王储', core: '纷争', group: 'calamity', color: '#D9705F', desc: '逐猎「纷争」之火的黄金裔。悬锋城不死的王储，浴血还乡，弑神登神。', voice: 'heirs/voices/mydei.mp3' },
  { id: 'castorice', name: '遐蝶',       roman: 'Castorice',     title: '死荫的侍女', core: '死亡', group: 'calamity', color: '#9E7BB8', desc: '寻索「死亡」之火的黄金裔。冥河的女儿，身负死亡之触，令凋零与新生往复。', voice: 'heirs/voices/castorice.mp3' },
]

// 侵蚀熄灭顺序：灾厄 → 命运 → 支柱 → 创生（世界崩塌有层次）
export const EROSION_ORDER: HeirGroup[] = ['calamity', 'fate', 'pillar', 'genesis']

// 图片回退链：svg → png → jpg
export function heirImgCandidates(id: string): string[] {
  return [`heirs/${id}.svg`, `heirs/${id}.png`, `heirs/${id}.jpg`]
}
