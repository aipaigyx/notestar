// 端到端冒烟测试（沙箱可跑部分）
// 用户重启 electron 后请按 README 实测清单 GUI 验证 4 项
import { describe, it, expect } from 'vitest'
import { cosine, buildEmbedText, EmbeddingStore } from '../electron/embed.cjs'
import fs from 'fs'
import path from 'path'

describe('端到端冒烟（沙箱可跑部分）', () => {
  it('embed.cjs 模块可正常 require', async () => {
    const mod = await import('../electron/embed.cjs')
    expect(typeof mod.ollamaEmbed).toBe('function')
    expect(typeof mod.buildEmbedText).toBe('function')
    expect(typeof mod.cosine).toBe('function')
    expect(typeof mod.EmbeddingStore).toBe('function')
    expect(mod.EMBED_MODEL).toBeTruthy()
    expect(mod.EMBED_DIM).toBe(768)
  })

  it('buildEmbedText 真实笔记样本', () => {
    const note = {
      title: 'Blender 三渲二：三点照明',
      content: '## 概述\n三点照明是基础，包括**主光**、*补光*、轮廓光。\n\n```python\nprint("code block")\n```\n\n![参考图](images/abc.png)\n详见 [文档](https://docs.blender.org)',
    }
    const t = buildEmbedText(note)
    expect(t).not.toContain('```')
    expect(t).not.toContain('![参考图]')
    expect(t).not.toContain('https://docs.blender.org')
    expect(t).toContain('Blender 三渲二')
    expect(t.length).toBeLessThanOrEqual(1000)
  })

  it('EmbeddingStore 真实文件持久化（E 盘）', () => {
    const fp = 'E:/tmp/test-e2e-embed.json'
    try { fs.unlinkSync(fp) } catch (e) {}
    const s = new EmbeddingStore(fp)
    s.set('note-A', { vector: [0.1, 0.2, 0.3], summary: 'Blender 灯光' })
    s.set('note-B', { vector: [0.4, 0.5, 0.6], summary: '材质节点' })
    // 重新加载
    const s2 = new EmbeddingStore(fp)
    expect(s2.size()).toBe(2)
    expect(s2.has('note-A')).toBe(true)
    // 删除
    s2.delete('note-A')
    expect(s2.size()).toBe(1)
    try { fs.unlinkSync(fp) } catch (e) {}
  })

  it('cosine 在跨课程场景可用', () => {
    // 用零均值向量：独立随机向量的 cosine 期望接近 0，断言才稳定
    const rnd = () => Math.random() * 2 - 1
    const v1 = Array.from({ length: 768 }, rnd)
    const v2 = Array.from({ length: 768 }, rnd)
    const v3 = v1.map(x => x + 0.01 * rnd()) // 接近 v1
    expect(cosine(v1, v1)).toBeCloseTo(1, 3)
    expect(cosine(v1, v3)).toBeGreaterThan(0.9) // 相似
    expect(cosine(v1, v2)).toBeLessThan(0.5) // 不相似
  })
})

// 注：以下 4 项需用户在 GUI 重启 electron 后实测：
// 1) 设置页 → 视觉模型下拉应显示 moondream ✓ 已安装（Bug A 已修）
// 2) 设置页 → 🕸️ 知识网络卡片 → 显示"已索引 N 篇笔记"
// 3) 悬浮球 → 🎥 跟拍记笔记 → 起 5 分钟录屏 + AI 识别 → 复习页验证联动
// 4) AI 助手 → 选个笔记上下文 → 提问 → 观察是否召回跨课程相关笔记