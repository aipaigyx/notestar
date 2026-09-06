// 生成 12 张泰坦占位图（SVG）到 app/public/titans/
// 命名规则：<titanId>.svg（用户后续把真图按同名放入即可替换，页面会自动回退 .png/.jpg）
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'app', 'public', 'titans')

// 12 泰坦：id / 中文名 / 称号 / 火种 / 分组 / 主色 / 符号（几何 path）
const TITANS = [
  // 命运三泰坦
  { id: 'oronyx',   name: '欧洛尼斯', title: '永夜之帷', core: '岁月', group: 'fate',   color: '#8B7CE8', symbol: 'eye' },
  { id: 'talanton', name: '塔兰顿',   title: '公正之秤', core: '律法', group: 'fate',   color: '#6FA8DC', symbol: 'scale' },
  { id: 'janus',    name: '雅努斯',   title: '万径之门', core: '门径', group: 'fate',   color: '#7FD1C1', symbol: 'gate' },
  // 支柱三泰坦
  { id: 'aquila',   name: '艾格勒',   title: '晨昏之眼', core: '天空', group: 'pillar', color: '#5DADE2', symbol: 'bird' },
  { id: 'georios',  name: '吉奥里亚', title: '磐岩之脊', core: '大地', group: 'pillar', color: '#A9895E', symbol: 'mountain' },
  { id: 'phagousa', name: '法吉娜',   title: '满溢之杯', core: '海洋', group: 'pillar', color: '#48A9A6', symbol: 'wave' },
  // 创生三泰坦
  { id: 'kephale',  name: '刻法勒',   title: '全世之座', core: '负世', group: 'genesis', color: '#E8B04B', symbol: 'throne' },
  { id: 'cerces',   name: '瑟希斯',   title: '裂分之枝', core: '理性', group: 'genesis', color: '#7FBF6A', symbol: 'tree' },
  { id: 'mnestia',  name: '墨涅塔',   title: '黄金之茧', core: '浪漫', group: 'genesis', color: '#F0A0C0', symbol: 'cocoon' },
  // 灾厄三泰坦
  { id: 'zagreus',  name: '扎格列斯', title: '翻飞之币', core: '诡计', group: 'calamity', color: '#C9904F', symbol: 'coin' },
  { id: 'nikador',  name: '尼卡多利', title: '天谴之矛', core: '纷争', group: 'calamity', color: '#D9705F', symbol: 'spear' },
  { id: 'thanatos', name: '塞纳托斯', title: '灰黯之手', core: '死亡', group: 'calamity', color: '#9B6BB5', symbol: 'dragon' },
]

const GROUP_LABEL = { fate: '命运', pillar: '支柱', genesis: '创生', calamity: '灾厄' }

// 各泰坦的几何符号（居中绘制在 150,165 附近）
const SYMBOLS = {
  eye: '<ellipse cx="150" cy="165" rx="62" ry="38" fill="none" stroke="{c}" stroke-width="6"/><circle cx="150" cy="165" r="20" fill="{c}"/>',
  scale: '<path d="M150 105 V250 M90 145 H210 M90 145 L62 200 H118 Z M210 145 L182 200 H238 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>',
  gate: '<path d="M92 240 V120 a58 58 0 0 1 116 0 V240" fill="none" stroke="{c}" stroke-width="6"/><path d="M150 120 V240" stroke="{c}" stroke-width="3" opacity="0.5"/>',
  bird: '<path d="M62 165 q40 -52 88 0 q48 -52 88 0" fill="none" stroke="{c}" stroke-width="6"/><circle cx="150" cy="168" r="12" fill="{c}"/>',
  mountain: '<path d="M52 235 L110 130 L150 185 L196 118 L248 235 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>',
  wave: '<path d="M58 160 q30 -26 58 0 t58 0 t30 0 M58 200 q30 -26 58 0 t58 0 t30 0" fill="none" stroke="{c}" stroke-width="6"/>',
  throne: '<path d="M92 240 V110 h116 V240 M108 175 h84 M150 110 V72" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>',
  tree: '<path d="M150 245 V150 M150 175 L104 128 M150 175 L196 128 M150 205 L112 168 M150 205 L188 168" fill="none" stroke="{c}" stroke-width="6" stroke-linecap="round"/><circle cx="150" cy="118" r="30" fill="none" stroke="{c}" stroke-width="6"/>',
  cocoon: '<ellipse cx="150" cy="168" rx="42" ry="62" fill="none" stroke="{c}" stroke-width="6"/><path d="M150 106 V230 M118 140 h64 M112 180 h76" stroke="{c}" stroke-width="3" opacity="0.6"/>',
  coin: '<circle cx="150" cy="168" r="58" fill="none" stroke="{c}" stroke-width="6"/><path d="M150 128 v80 M126 148 h48 M126 188 h48" stroke="{c}" stroke-width="5" stroke-linecap="round"/>',
  spear: '<path d="M150 66 L178 118 L150 250 L122 118 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/>',
  dragon: '<path d="M78 200 q28 -80 76 -40 q26 22 54 -18 q-16 66 -70 82 q-46 14 -60 -24 Z" fill="none" stroke="{c}" stroke-width="6" stroke-linejoin="round"/><circle cx="196" cy="140" r="7" fill="{c}"/>',
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
  <text x="150" y="316" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">${t.name}</text>
  <text x="150" y="348" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="17" fill="${t.color}">${t.title}</text>
  <text x="150" y="378" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="15" fill="#B9B2D6">${GROUP_LABEL[t.group]} · 「${t.core}」火种</text>
  <text x="150" y="404" text-anchor="middle" font-family="'Microsoft YaHei',sans-serif" font-size="12" fill="#6E6885" letter-spacing="2">占位图 · 待替换</text>
</svg>
`
}

fs.mkdirSync(OUT, { recursive: true })
let n = 0
for (const t of TITANS) {
  fs.writeFileSync(path.join(OUT, `${t.id}.svg`), buildSvg(t), 'utf8')
  n++
}
console.log(`已生成 ${n} 张泰坦占位图 → ${OUT}`)
console.log(TITANS.map(t => t.id + '.svg').join(', '))
