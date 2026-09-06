// embed.cjs 单元测试（不依赖 Ollama 真实服务，只测本地逻辑）
import { describe, it, expect } from 'vitest'
import { cosine, buildEmbedText, EmbeddingStore } from '../electron/embed.cjs'

describe('cosine 相似度', () => {
  it('相同向量 = 1', () => {
    const v = [1, 2, 3]
    expect(cosine(v, v)).toBeCloseTo(1, 5)
  })
  it('正交向量 = 0', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 5)
  })
  it('反向向量 = -1', () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 5)
  })
  it('维度不一致 = 0（防 NaN）', () => {
    expect(cosine([1, 2], [1, 2, 3])).toBe(0)
  })
  it('空向量 = 0', () => {
    expect(cosine([], [])).toBe(0)
    expect(cosine([0, 0], [0, 0])).toBe(0)
  })
  it('null/undefined 安全', () => {
    expect(cosine(null, [1, 2])).toBe(0)
    expect(cosine([1, 2], undefined)).toBe(0)
  })
})

describe('buildEmbedText 文本预处理', () => {
  it('标题 + 内容拼接', () => {
    const t = buildEmbedText({ title: 'Blender 灯光', content: '三点照明' })
    expect(t).toBe('Blender 灯光\n三点照明')
  })
  it('剥离 markdown 符号', () => {
    const t = buildEmbedText({ title: '## 标题', content: '**粗体** + `代码`' })
    expect(t).not.toContain('##')
    expect(t).not.toContain('**')
    expect(t).not.toContain('`')
  })
  it('去除代码块', () => {
    const t = buildEmbedText({ title: 'JS', content: '```js\nconst x = 1\n```' })
    expect(t).not.toContain('const x')
    expect(t).not.toContain('```')
  })
  it('去除图片 + 链接保留文本', () => {
    const t = buildEmbedText({ title: 'T', content: '![img](a.png) 点击 [链接](https://x.com)' })
    expect(t).not.toContain('a.png')
    expect(t).toContain('点击')
    expect(t).toContain('链接')
    expect(t).not.toContain('https://')
  })
  it('总长限制 1000 字符', () => {
    const t = buildEmbedText({ title: 'X', content: 'A'.repeat(2000) })
    expect(t.length).toBeLessThanOrEqual(1000)
  })
  it('空内容返回空', () => {
    const t = buildEmbedText({ title: '', content: '' })
    expect(t).toBe('')
  })
})

describe('EmbeddingStore 持久化', () => {
  it('set / get / has / delete 流程', () => {
    const store = new EmbeddingStore('E:/tmp/embed-test-1.json')
    store.set('n1', { vector: [0.1, 0.2], summary: 's1' })
    expect(store.has('n1')).toBe(true)
    expect(store.get('n1').summary).toBe('s1')
    store.delete('n1')
    expect(store.has('n1')).toBe(false)
  })
  it('save 后重新 load 数据一致', () => {
    const fp = 'E:/tmp/embed-test-2.json'
    try { require('fs').unlinkSync(fp) } catch (e) {}
    const a = new EmbeddingStore(fp)
    a.set('n1', { vector: [1, 2, 3], summary: 'first' })
    const b = new EmbeddingStore(fp)
    expect(b.has('n1')).toBe(true)
    expect(b.get('n1').vector).toEqual([1, 2, 3])
    try { require('fs').unlinkSync(fp) } catch (e) {}
  })
  it('set 自动加 updatedAt', () => {
    const store = new EmbeddingStore('E:/tmp/embed-test-3.json')
    store.set('n1', { vector: [1], summary: 's' })
    expect(store.get('n1').updatedAt).toBeTruthy()
  })
})
