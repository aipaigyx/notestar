// 笔记 HTML 导出渲染器：Markdown → 排版 HTML + KaTeX 公式 + AI 分析图表区块
// 供 main.cjs 的 files:exportNotes 使用（可独立测试）
// 注意：marked/katex 为 ESM-only，Electron 主进程不支持 require(ESM)，必须动态 import
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

let _marked = null
let _katex = null
async function loadDeps() {
  if (!_marked) _marked = await import('marked')
  if (!_katex) _katex = await import('katex')
}

// KaTeX 样式内联（字体文件路径失效时用 fallback，仍可读）
let KATEX_CSS = ''
try {
  KATEX_CSS = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'katex', 'dist', 'katex.min.css'), 'utf-8')
} catch (e) { KATEX_CSS = '' }

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 渲染 Markdown：先提取公式用 KaTeX，再 marked 渲染，最后还原
async function renderMarkdown(md) {
  if (!md) return ''
  await loadDeps()
  const katex = _katex
  const blocks = []
  let counter = 0
  let processed = String(md)
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_m, latex) => {
    const ph = `KATEXPH${counter++}K`
    let html = ''
    try { html = katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false }) }
    catch (e) { html = `<code>${escapeHtml(latex.trim())}</code>` }
    blocks.push({ ph, html })
    return ph
  })
  processed = processed.replace(/(^|[^$])\$([^$\n]+?)\$(?![$])/g, (_m, pre, latex) => {
    const ph = `KATEXPH${counter++}K`
    let html = ''
    try { html = katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false }) }
    catch (e) { html = `<code>${escapeHtml(latex.trim())}</code>` }
    blocks.push({ ph, html })
    return pre + ph
  })
  let html = _marked.marked.parse(processed)
  for (const b of blocks) html = html.split(b.ph).join(b.html)
  return html
}

const CHART_COLORS = ['#FF6B9D', '#B794F6', '#4292F5', '#26D0A8', '#FF9948', '#F06595']

// 生成单个图表的 HTML（7 种类型：bar/pie/line/timeline/flow/venn/comparison）
function renderChart(chart) {
  if (!chart) return ''
  const t = chart.type
  const title = `<h5 class="chart-title">${escapeHtml(chart.title || '')}</h5>`
  if (t === 'bar') {
    const values = chart.values || []
    const max = Math.max(...values.filter(v => typeof v === 'number'), 1)
    const bars = (chart.labels || []).map((label, i) => {
      const v = values[i] || 0
      const h = Math.round(v / max * 100)
      return `<div class="bar-col"><div class="bar-val">${v}</div><div class="bar-track"><div class="bar-fill" style="height:${h}%"></div></div><div class="bar-label">${escapeHtml(label)}</div></div>`
    }).join('')
    return `<div class="chart">${title}<div class="bar-chart">${bars}</div></div>`
  }
  if (t === 'pie') {
    const values = chart.values || []
    const total = values.reduce((s, v) => s + (Number(v) || 0), 0) || 1
    let acc = 0
    const stops = values.map((v, i) => { const p = Number(v) / total * 100; const from = acc; acc += p; return `${CHART_COLORS[i % 6]} ${from}% ${acc}%` }).join(', ')
    const legend = (chart.labels || []).map((label, i) => `<div class="pie-li"><span class="pie-dot" style="background:${CHART_COLORS[i % 6]}"></span>${escapeHtml(label)}${chart.values?.[i] != null ? ' · ' + chart.values[i] + '%' : ''}</div>`).join('')
    return `<div class="chart">${title}<div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops})"></div><div class="pie-legend">${legend}</div></div></div>`
  }
  if (t === 'line') {
    const values = chart.values || []
    const labels = chart.labels || []
    const n = values.length
    const W = 360, H = 150, padL = 40, padR = 16
    const maxV = Math.max(...values.filter(v => typeof v === 'number'), 1)
    const innerW = W - padL - padR, innerH = H - 36
    const xAt = (i) => padL + (n === 1 ? innerW / 2 : i / (n - 1) * innerW)
    const yAt = (v) => innerH - Number(v) / maxV * (innerH - 20) + 16
    const pts = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
    const dots = values.map((v, i) => `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="3.5" fill="#fff" stroke="#FF6B9D" stroke-width="2"/><text x="${xAt(i)}" y="${yAt(v) - 8}" class="line-val">${v}</text>`).join('')
    const lbls = labels.map(l => `<span class="line-label">${escapeHtml(l)}</span>`).join('')
    return `<div class="chart">${title}<svg viewBox="0 0 ${W} ${H}" class="line-svg"><line x1="${padL}" y1="${H - 20}" x2="${W - padR}" y2="${H - 20}" stroke="#EBE5F4"/><polyline points="${pts}" fill="none" stroke="#FF6B9D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg><div class="line-labels">${lbls}</div></div>`
  }
  if (t === 'timeline') {
    const items = (chart.events || []).map(ev => `<div class="tl-item"><div class="tl-dot"></div><div class="tl-body"><span class="tl-time">${escapeHtml(ev.time || '')}</span><span class="tl-title">${escapeHtml(ev.title || '')}</span>${ev.desc ? `<span class="tl-desc">${escapeHtml(ev.desc)}</span>` : ''}</div></div>`).join('')
    return `<div class="chart">${title}<div class="timeline">${items}</div></div>`
  }
  if (t === 'flow') {
    const steps = (chart.steps || []).map((s, i) => `<div class="flow-item"><span class="flow-num">${i + 1}</span><span class="flow-text">${escapeHtml(s)}</span></div>${i < (chart.steps || []).length - 1 ? '<div class="flow-arrow">↓</div>' : ''}`).join('')
    return `<div class="chart">${title}<div class="flow">${steps}</div></div>`
  }
  if (t === 'venn') {
    const onlyA = (chart.onlyA || []).map((t, i) => `<text x="78" y="${100 + i * 18}" class="venn-t">${escapeHtml(t)}</text>`).join('')
    const onlyB = (chart.onlyB || []).map((t, i) => `<text x="262" y="${100 + i * 18}" class="venn-t">${escapeHtml(t)}</text>`).join('')
    const both = (chart.both || []).map((t, i) => `<text x="180" y="${70 + i * 18}" class="venn-t both" text-anchor="middle">${escapeHtml(t)}</text>`).join('')
    return `<div class="chart">${title}<svg viewBox="0 0 340 170" class="venn-svg"><circle cx="130" cy="130" r="78" fill="#FF6B9D" fill-opacity="0.35" stroke="#FF6B9D" stroke-width="2"/><circle cx="230" cy="130" r="78" fill="#4292F5" fill-opacity="0.35" stroke="#4292F5" stroke-width="2"/><text x="72" y="30" class="venn-set">${escapeHtml(chart.sets?.[0] || 'A')}</text><text x="268" y="30" class="venn-set">${escapeHtml(chart.sets?.[1] || 'B')}</text>${onlyA}${onlyB}${both}</svg></div>`
  }
  if (t === 'comparison') {
    const head = `<tr><th></th>${(chart.labels || []).map(l => `<th>${escapeHtml(l)}</th>`).join('')}</tr>`
    const rows = (chart.rows || []).map(r => `<tr><td class="cmp-l">${escapeHtml(r.label)}</td>${(r.items || []).map(it => `<td>${escapeHtml(it)}</td>`).join('')}</tr>`).join('')
    return `<div class="chart">${title}<table class="cmp-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`
  }
  return ''
}

// 知识树嵌套列表
function renderTree(node) {
  if (!node) return ''
  const kids = (node.children || []).map(renderTree).join('')
  return `<li><span class="tree-node">${escapeHtml(node.title || '')}</span>${kids ? `<ul>${kids}</ul>` : ''}</li>`
}

// AI 知识分析区块
function renderAnalysisBlock(analysis) {
  if (!analysis) return ''
  const parts = []
  if (analysis.summary) {
    parts.push(`<section class="a-section"><h4>📊 内容摘要</h4><p class="a-summary">${escapeHtml(analysis.summary)}</p></section>`)
  }
  if (analysis.tree?.children?.length) {
    parts.push(`<section class="a-section"><h4>🌳 知识树</h4><ul class="tree">${renderTree(analysis.tree)}</ul></section>`)
  }
  if (analysis.cards?.length) {
    const cards = analysis.cards.map(c => `<div class="k-card"><span class="k-type">${escapeHtml(c.type || 'concept')}</span><h5>${escapeHtml(c.title || '')}</h5><p>${escapeHtml(c.content || '')}</p></div>`).join('')
    parts.push(`<section class="a-section"><h4>📇 知识卡片</h4><div class="k-cards">${cards}</div></section>`)
  }
  if (analysis.charts?.length) {
    parts.push(`<section class="a-section"><h4>📈 数据图表</h4>${analysis.charts.map(renderChart).join('')}</section>`)
  }
  if (analysis.keyPoints?.length) {
    const kps = analysis.keyPoints.map((k, i) => `<li class="kp">${escapeHtml(k)}</li>`).join('')
    parts.push(`<section class="a-section"><h4>🔑 核心关键点</h4><ol class="kps">${kps}</ol></section>`)
  }
  return parts.join('')
}

const EXPORT_CSS = `
  :root { --pink: #FF6B9D; --purple: #B794F6; --blue: #4292F5; }
  body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 860px; margin: 0 auto; padding: 40px 32px 80px; color: #3A2D54; line-height: 1.85; background: #F7F4FB; }
  h1 { color: var(--pink); font-size: 28px; border-bottom: 3px solid rgba(255,107,157,0.25); padding-bottom: 10px; margin-bottom: 8px; }
  .meta { color: #9B9BB5; font-size: 13px; margin-bottom: 28px; }
  h2 { color: #FF6B9D; margin-top: 30px; padding-left: 10px; border-left: 4px solid var(--pink); }
  h3 { color: #8B5CF6; margin-top: 24px; }
  h4 { color: #4B3F72; margin-top: 20px; }
  p { margin: 10px 0; }
  a { color: var(--blue); }
  blockquote { margin: 12px 0; padding: 10px 16px; border-left: 4px solid var(--purple); background: rgba(183,148,246,0.1); border-radius: 0 10px 10px 0; color: #5B5470; }
  code { background: rgba(183,148,246,0.15); padding: 2px 6px; border-radius: 5px; font-size: 0.9em; color: #B4536A; }
  pre { background: #2A2340; color: #E9E4F5; padding: 16px; border-radius: 12px; overflow-x: auto; }
  pre code { background: none; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; }
  th { background: rgba(255,107,157,0.12); color: var(--pink); padding: 8px 12px; border: 1px solid #EBDDF5; }
  td { padding: 7px 12px; border: 1px solid #EBDDF5; }
  img { max-width: 100%; border-radius: 10px; box-shadow: 0 2px 12px rgba(183,148,246,0.2); }
  hr { border: none; border-top: 2px dashed #E8DDF2; margin: 24px 0; }
  .a-section { margin-top: 26px; padding: 18px; background: #fff; border: 1px solid #EBE0F5; border-radius: 14px; box-shadow: 0 2px 10px rgba(183,148,246,0.08); }
  .a-section h4 { margin-top: 0; color: var(--pink); font-size: 15px; }
  .a-summary { background: rgba(255,107,157,0.06); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,107,157,0.15); }
  ul.tree { list-style: none; padding-left: 0; }
  ul.tree ul { list-style: none; padding-left: 18px; border-left: 2px solid #EFE4FA; margin: 4px 0; }
  .tree-node { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(255,107,157,0.1); color: var(--pink); font-weight: 600; font-size: 13px; margin: 2px 0; }
  .k-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .k-card { padding: 14px; border-radius: 12px; background: linear-gradient(135deg, rgba(255,107,157,0.06), rgba(183,148,246,0.08)); border: 1px solid #EFE2F7; }
  .k-card h5 { margin: 6px 0 4px; color: #4B3F72; }
  .k-card p { font-size: 13px; color: #5B5470; margin: 0; line-height: 1.7; }
  .k-type { font-size: 10px; color: var(--pink); background: rgba(255,107,157,0.12); padding: 2px 8px; border-radius: 999px; }
  .kps { padding-left: 20px; }
  .kp { margin: 6px 0; }
  .chart { margin: 14px 0; }
  .chart-title { color: #4B3F72; font-size: 14px; margin: 10px 0 8px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 10px; padding: 8px 0; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .bar-val { font-size: 11px; color: var(--pink); font-weight: 700; }
  .bar-track { width: 100%; max-width: 32px; height: 90px; background: rgba(183,148,246,0.12); border-radius: 8px; display: flex; align-items: flex-end; overflow: hidden; }
  .bar-fill { width: 100%; background: linear-gradient(180deg, #FF6B9D, #B794F6); border-radius: 8px 8px 3px 3px; min-height: 3px; }
  .bar-label { font-size: 10px; color: #9B9BB5; }
  .pie-wrap { display: flex; gap: 16px; align-items: center; }
  .pie { width: 120px; height: 120px; border-radius: 50%; flex-shrink: 0; }
  .pie-legend { display: flex; flex-direction: column; gap: 5px; }
  .pie-li { font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .pie-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .line-svg { width: 100%; height: 150px; }
  .line-val { font-size: 10px; fill: var(--pink); font-weight: 700; text-anchor: middle; }
  .line-labels { display: flex; justify-content: space-between; padding: 0 30px 0 44px; }
  .line-label { font-size: 10px; color: #9B9BB5; }
  .timeline { position: relative; padding-left: 24px; }
  .timeline::before { content: ''; position: absolute; left: 8px; top: 6px; bottom: 6px; width: 3px; background: linear-gradient(180deg, rgba(255,107,157,0.5), rgba(183,148,246,0.4)); border-radius: 2px; }
  .tl-item { position: relative; padding: 4px 0 12px; }
  .tl-dot { position: absolute; left: -20px; top: 9px; width: 10px; height: 10px; border-radius: 50%; background: linear-gradient(135deg, #FF6B9D, #B794F6); }
  .tl-body { display: flex; flex-direction: column; }
  .tl-time { font-size: 10.5px; font-weight: 700; color: var(--pink); }
  .tl-title { font-size: 13px; font-weight: 600; }
  .tl-desc { font-size: 11.5px; color: #6B6B96; }
  .flow { display: flex; flex-direction: column; align-items: center; }
  .flow-item { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 300px; padding: 10px 14px; background: #fff; border: 1.5px solid #F3C9DA; border-radius: 12px; }
  .flow-num { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #FF6B9D, #B794F6); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .flow-text { font-size: 12.5px; }
  .flow-arrow { color: var(--pink); font-size: 14px; font-weight: 700; padding: 1px 0; }
  .venn-svg { width: 100%; max-width: 340px; }
  .venn-set { font-size: 13px; font-weight: 800; fill: #3A2D54; }
  .venn-t { font-size: 10px; fill: #5B5470; }
  .venn-t.both { font-weight: 700; fill: #3A2D54; }
  .cmp-table th, .cmp-table td { font-size: 12px; }
  .cmp-l { font-weight: 700; color: #5B5470; }
  .katex-display { overflow-x: auto; overflow-y: hidden; padding: 4px 0; }
  @media print { body { background: #fff; } .a-section { break-inside: avoid; } }
`

// 图片引用转换：images/xxx.png → file:/// 绝对路径（指向应用数据目录）
function fixImageRefs(md, imagesDir) {
  if (!imagesDir || !fs.existsSync(imagesDir)) return md
  return String(md).replace(/!\[([^\]]*)\]\((images\/([^)]+))\)/g, (_m, alt, _src, file) => {
    const p = path.join(imagesDir, file)
    if (fs.existsSync(p)) {
      return `![${alt}](${pathToFileURL(p).toString()})`
    }
    return _m
  })
}

// 生成完整 HTML 文档（async：内部动态加载 marked/katex）
async function renderNoteToHtml(note, analysis, options = {}) {
  const { imagesDir } = options
  const title = note.title || '未命名笔记'
  let contentMd = fixImageRefs(note.content || '', imagesDir)
  const body = await renderMarkdown(contentMd)
  const analysisHtml = renderAnalysisBlock(analysis)
  const extra = `<p class="meta">导出时间：${new Date().toLocaleString()}${analysis ? ' · 含 AI 知识分析' : ''}</p>`
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${KATEX_CSS}</style>
<style>${EXPORT_CSS}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${extra}
<article>
${body}
</article>
${analysisHtml ? `<hr><h2 style="border-left:none;padding-left:0">🤖 AI 知识分析</h2>${analysisHtml}` : ''}
</body>
</html>`
}

module.exports = { renderNoteToHtml, renderChart, renderAnalysisBlock, renderMarkdown }
