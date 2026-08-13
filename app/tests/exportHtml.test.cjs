// exportHtml 渲染器测试：Markdown 排版 + KaTeX + AI 分析区块（7 种图表）
import { describe, it, expect } from 'vitest'
import { renderNoteToHtml } from '../electron/exportHtml.cjs'

const sampleNote = {
  title: 'Blender 挤出建模',
  content: [
    '# 挤出 Extrude',
    '',
    '按 **E** 键挤出。公式：$E = mc^2$',
    '',
    '| 操作 | 快捷键 |',
    '| --- | --- |',
    '| 挤出 | E |',
  ].join('\n'),
}

const sampleAnalysis = {
  summary: '挤出是 Blender 最基础建模操作',
  tree: { title: '挤出', children: [{ title: '操作', children: [{ title: '按 E' }] }] },
  cards: [{ title: '挤出', content: '沿法线拉伸面', type: 'concept' }],
  keyPoints: ['E 键挤出'],
  charts: [
    { type: 'bar', title: '耗时', labels: ['挤出', '旋转'], values: [5, 3] },
    { type: 'pie', title: '占比', labels: ['A', 'B'], values: [60, 40] },
    { type: 'line', title: '趋势', labels: ['1月', '2月'], values: [10, 20] },
    { type: 'timeline', title: '版本', events: [{ time: '1998', title: '1.0' }] },
    { type: 'flow', title: '流程', steps: ['建体', '挤出'] },
    { type: 'venn', title: '对比', sets: ['A', 'B'], onlyA: ['x'], both: ['y'] },
    { type: 'comparison', title: '对照', labels: ['A', 'B'], rows: [{ label: '特点', items: ['1', '2'] }] },
  ],
}

describe('exportHtml 渲染器', () => {
  it('渲染完整 HTML 文档（标题/正文/表格）', async () => {
    const html = await renderNoteToHtml(sampleNote, null, {})
    expect(html).toContain('<h1>Blender 挤出建模</h1>')
    expect(html).toContain('<table>')
    expect(html).toContain('<strong>E</strong>')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('KaTeX 公式渲染为 HTML', async () => {
    const html = await renderNoteToHtml(sampleNote, null, {})
    expect(html).toContain('katex')
  })

  it('AI 分析区块：摘要/知识树/卡片/关键点', async () => {
    const html = await renderNoteToHtml(sampleNote, sampleAnalysis, {})
    expect(html).toContain('AI 知识分析')
    expect(html).toContain('挤出是 Blender 最基础建模操作')
    expect(html).toContain('知识树')
    expect(html).toContain('k-card')
    expect(html).toContain('E 键挤出')
  })

  it('7 种图表类型全部渲染', async () => {
    const html = await renderNoteToHtml(sampleNote, sampleAnalysis, {})
    expect(html).toContain('bar-chart')
    expect(html).toContain('conic-gradient')
    expect(html).toContain('line-svg')
    expect(html).toContain('timeline')
    expect(html).toContain('flow-item')
    expect(html).toContain('venn-svg')
    expect(html).toContain('cmp-table')
  })

  it('无分析时只渲染正文（无 AI 区块）', async () => {
    const html = await renderNoteToHtml(sampleNote, null, {})
    expect(html).not.toContain('AI 知识分析')
  })

  it('图片引用转换为 file:/// 绝对路径', async () => {
    const fs = require('fs')
    const path = require('path')
    const os = require('os')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notestar-export-'))
    const imgDir = path.join(tmpDir, 'images')
    fs.mkdirSync(imgDir, { recursive: true })
    fs.writeFileSync(path.join(imgDir, 'shot1.png'), 'fake')
    const note = { title: 't', content: '![截图](images/shot1.png)' }
    const html = await renderNoteToHtml(note, null, { imagesDir: imgDir })
    expect(html).toContain('file:///')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
