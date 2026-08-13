import { describe, it, expect } from 'vitest'
import { simpleHash, extractImageURIs, countImages, replaceImagesWithPlaceholders, parseAIJSON } from '../electron/ai-utils.cjs'

describe('simpleHash', () => {
  it('相同输入产生相同哈希', () => {
    expect(simpleHash('hello')).toBe(simpleHash('hello'))
  })
  it('不同输入产生不同哈希', () => {
    expect(simpleHash('hello')).not.toBe(simpleHash('world'))
  })
  it('空字符串可处理', () => {
    expect(typeof simpleHash('')).toBe('string')
  })
  it('长内容稳定返回字符串', () => {
    const long = 'x'.repeat(10000)
    expect(typeof simpleHash(long)).toBe('string')
  })
})

describe('extractImageURIs / countImages', () => {
  const noteWithImg = '## 标题\n\n![知识树](data:image/svg+xml,%3Csvg%3E%3C/svg%3E)\n\n正文内容'
  it('提取 data URI 图片', () => {
    const imgs = extractImageURIs(noteWithImg)
    expect(imgs.length).toBe(1)
    expect(imgs[0].alt).toBe('知识树')
    expect(imgs[0].dataUri).toContain('data:image/svg+xml')
  })
  it('无图片返回空数组', () => {
    expect(extractImageURIs('纯文本笔记')).toEqual([])
    expect(extractImageURIs('')).toEqual([])
  })
  it('countImages 正确计数', () => {
    expect(countImages(noteWithImg)).toBe(1)
    expect(countImages('无图')).toBe(0)
  })
  it('多张图片全部提取', () => {
    const two = '![a](data:image/png;base64,AAA) 和 ![b](data:image/png;base64,BBB)'
    expect(countImages(two)).toBe(2)
    expect(extractImageURIs(two).map(i => i.alt)).toEqual(['a', 'b'])
  })
})

describe('replaceImagesWithPlaceholders', () => {
  it('图片替换为占位说明', () => {
    const out = replaceImagesWithPlaceholders('![知识树](data:image/svg+xml,abc) 说明')
    expect(out).toContain('[图片：知识树]')
    expect(out).not.toContain('data:image')
  })
  it('无图片时原样返回', () => {
    expect(replaceImagesWithPlaceholders('普通文本')).toBe('普通文本')
  })
})

describe('parseAIJSON（AI 输出容错解析）', () => {
  it('直接解析合法 JSON', () => {
    expect(parseAIJSON('{"a":1}')).toEqual({ a: 1 })
  })
  it('去掉 markdown 代码块标记后解析', () => {
    const raw = '```json\n{"summary":"测试","cards":[]}\n```'
    expect(parseAIJSON(raw)).toEqual({ summary: '测试', cards: [] })
  })
  it('前后有杂讯文本时截取大括号内容', () => {
    const raw = '好的，以下是分析结果：\n{"key":"value"}\n希望有帮助！'
    expect(parseAIJSON(raw)).toEqual({ key: 'value' })
  })
  it('JSON 数组也能解析（大括号截取不适用时返回 null）', () => {
    expect(parseAIJSON('[1,2,3]')).toEqual([1, 2, 3])
  })
  it('完全无法解析返回 null', () => {
    expect(parseAIJSON('不是 JSON')).toBeNull()
    expect(parseAIJSON('')).toBeNull()
  })
  it('非字符串输入原样返回', () => {
    expect(parseAIJSON({ a: 1 })).toEqual({ a: 1 })
    expect(parseAIJSON(null)).toBeNull()
  })
})
