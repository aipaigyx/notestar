// 生成 12 张黄金裔占位图（SVG）到 app/public/heirs/
// 命名规则：<heirId>.svg（用户后续把真图按同名放入即可替换，页面会自动回退 .png/.jpg）
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'app', 'public', 'heirs')

// 12 黄金裔：id / 中文名 / 罗马名 / 称号 / 火种 / 分组 / 主色 / 符号
const HEIRS = [
  // 命运三裔
  { id: 'march7',    name: '三月七',   roman: 'March 7th', title: '隐秘的陌客', core: '岁月', group: 'fate',     color: '#5EC8E5', symbol: 'camera' },
  { id: 'cerydra',   name: '刻律德菈', roman: 'Cerydra',   title: '执棋的君主', core: '律法', group: 'fate',     color: '#8FAADC', symbol: 'crown' },
  { id: 'tribbie',   name: '缇宝',     roman: 'Tribbie',   title: '命运的三子', core: '门径', group: 'fate',     color: '#C9A0DC', symbol: 'triad' },
  // 支柱三裔
  { id: 'hyacine',   name: '风堇',     roman: 'Hyacine',   title: '摇光的医师', core: '天空', group: 'pillar',   color: '#7FD4F0', symbol: 'wing' },
  { id: 'danheng',   name: '丹恒·腾荒', roman: 'Dan Heng', title: '腾飞的荒龙', core: '大地', group: 'pillar',   color: '#5FA98F', symbol: 'dragon' },
  { id: 'hysilens',  name: '海瑟音',   roman: 'Hysilens',  title: '奏浪的剑骑', core: '海洋', group: 'pillar',   color: '#54A6D8', symbol: 'wavesword' },
  // 创生三裔
  { id: 'aglaea',    name: '阿格莱雅', roman: 'Aglaea',    title: '黄金的织者', core: '浪漫', group: 'genesis',  color: '#E0A94E', symbol: 'weave' },
  { id: 'phainon',   name: '白厄',     roman: 'Phainon',   title: '无名的英雄', core: '负世', group: 'genesis',  color: '#EFB93D', symbol: 'sun' },
  { id: 'anaxa',     name: '那刻夏',   roman: 'Anaxa',     title: '殁世的学士', core: '理性', group: 'genesis',  color: '#74C69D', symbol: 'tree' },
  // 灾厄三裔
  { id: 'cipher',    name: '赛飞儿',   roman: 'Cipher',    title: '捷足的贼星', core: '诡计', group: 'calamity', color: '#D09A5A', symbol: 'coin' },
  { id: 'mydei',     name: '万敌',     roman: 'Mydei',     title: '亡国的王储', core: '纷争', group: 'calamity', color: '#D9705F', symbol: 'spear' },
  { id: 'castorice', name: '遐蝶',     roman: 'Castorice', title: '死荫的侍女', core: '死亡', group: 'calamity', color: '#9E7BB8', symbol: 'butterfly' },
]

const GROUP_LABEL = { fate: '命运', pillar: '支柱', genesis: '创生', calamity: '灾厄' }

// 各黄金裔的几何符号（居中绘制在 150,165 附近）
const SYMBOLS = {
  // 三月七：相机取景框 + 中心圆 + 顶部快门
  camera: '<rect x="96" y="118" width="108" height="98" rx="12" fill="none" stroke="{c}" stroke-width="6"/><rect x="124" y="104" width="52" height="18" rx="4" fill="{c}"/><circle cx="150" cy="167" r="24" fill="none" stroke="{c}" stroke-width="5"/><circle cx="150" cy="167" r="9" fill="{c}"/>',
  // 刻律德菈：三尖王冠 + 底横（执棋君主）
  crown: '<path d="M118 196 v-32 l16 13 16 -20 16 20 16 -13 v32 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/><path d="M106 196 h88 M118 222 h64" stroke="{c}" stroke-width="3" opacity="0.55"/>',
  // 缇宝：三位一体圆 + 中心连接（命运三子）
  triad: '<circle cx="112" cy="152" r="21" fill="none" stroke="{c}" stroke-width="5"/><circle cx="150" cy="132" r="21" fill="none" stroke="{c}" stroke-width="5"/><circle cx="188" cy="152" r="21" fill="none" stroke="{c}" stroke-width="5"/><circle cx="112" cy="152" r="7" fill="{c}"/><circle cx="150" cy="132" r="7" fill="{c}"/><circle cx="188" cy="152" r="7" fill="{c}"/><path d="M120 214 q30 -40 60 0 q30 -40 60 0" fill="none" stroke="{c}" stroke-width="4" opacity="0.5"/>',
  // 风堇：展翼弧 + 医师十字（缝合晨昏）
  wing: '<path d="M58 178 q48 -54 92 -6 q44 -48 92 6" fill="none" stroke="{c}" stroke-width="6"/><path d="M150 116 v104 M112 168 h76" stroke="{c}" stroke-width="4" opacity="0.6"/>',
  // 丹恒·腾荒：荒龙（头向左的飞龙轮廓）
  dragon: '<path d="M84 204 q26 -84 74 -42 q26 22 54 -20 q-16 68 -70 86 q-48 14 -58 -24 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/><circle cx="194" cy="142" r="7" fill="{c}"/><path d="M132 150 l-16 10 M128 172 l-14 6" stroke="{c}" stroke-width="4" stroke-linecap="round" opacity="0.7"/>',
  // 海瑟音：居中剑 + 两道浪（奏浪的剑骑）
  wavesword: '<path d="M150 84 L158 122 L150 236 L142 122 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/><path d="M86 200 q26 -20 52 0 t52 0 M86 230 q26 -20 52 0 t52 0" fill="none" stroke="{c}" stroke-width="5"/>',
  // 阿格莱雅：金丝织线 + 竖直轴线（黄金的织者）
  weave: '<path d="M150 92 v154" stroke="{c}" stroke-width="4" opacity="0.55"/><path d="M86 208 C120 138 180 138 214 208 M86 168 C120 98 180 98 214 168" fill="none" stroke="{c}" stroke-width="6"/>',
  // 白厄：烈阳 + 放射芒（明日烈阳）
  sun: '<circle cx="150" cy="166" r="36" fill="none" stroke="{c}" stroke-width="6"/><circle cx="150" cy="166" r="13" fill="{c}"/><path d="M150 92 v-20 M150 240 v20 M90 166 h-20 M230 166 h20 M108 124 l-14 -14 M206 208 l14 14 M108 208 l-14 14 M206 124 l14 -14" stroke="{c}" stroke-width="5" stroke-linecap="round"/>',
  // 那刻夏：理性圣树（枝杈刺入圣树）
  tree: '<path d="M150 240 V148 M150 176 L106 130 M150 176 L194 130 M150 206 L112 166 M150 206 L188 166" fill="none" stroke="{c}" stroke-width="6" stroke-linecap="round"/><circle cx="150" cy="118" r="28" fill="none" stroke="{c}" stroke-width="6"/>',
  // 赛飞儿：翻飞之币（捷足）
  coin: '<circle cx="150" cy="168" r="56" fill="none" stroke="{c}" stroke-width="6"/><path d="M150 128 v80 M126 148 h48 M126 188 h48" stroke="{c}" stroke-width="5" stroke-linecap="round"/>',
  // 万敌：天谴长矛
  spear: '<path d="M150 62 L180 120 L150 242 L120 120 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>',
  // 遐蝶：双翼蝴蝶 + 身线
  butterfly: '<path d="M150 148 C134 116 88 104 82 144 C76 184 124 194 150 158 Z M150 148 C166 116 212 104 218 144 C224 184 176 194 150 158 Z M150 158 v88 M150 176 C134 190 116 194 108 206 M150 176 C166 190 184 194 192 206" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>',
}

function buildSvg(t) {
  const sym = SYMBOLS[t.symbol].replace(/\{c\}/g, t.color)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="420" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2A2140"/>
      <stop offset="100%" stop-color="#171225"/>
    </linearGradient>
    <radialGradient id="halo" cx="150" cy="168" r="130" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${t.color}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${t.color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="300" height="420" fill="url(#bg)"/>
  <rect width="300" height="420" fill="url(#halo)"/>
  <rect x="10" y="10" width="280" height="400" rx="18" fill="none" stroke="${t.color}" stroke-opacity="0.45" stroke-width="2"/>
  <g opacity="0.95">${sym}</g>
  <text x="150" y="316" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="32" font-weight="700" fill="#FFFFFF">${t.name}</text>
  <text x="150" y="346" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="16" fill="${t.color}">${t.roman}</text>
  <text x="150" y="374" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="15" fill="#B9B2D6">${t.title} · 「${t.core}」火种</text>
  <text x="150" y="400" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="12" fill="#6E6885" letter-spacing="2">占位图 · 待替换</text>
</svg>
`
}

fs.mkdirSync(OUT, { recursive: true })
let n = 0
for (const h of HEIRS) {
  fs.writeFileSync(path.join(OUT, `${h.id}.svg`), buildSvg(h), 'utf8')
  n++
}
console.log(`已生成 ${n} 张黄金裔占位图 → ${OUT}`)
console.log(HEIRS.map(h => h.id + '.svg').join(', '))
