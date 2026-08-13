// quiz 出题结果解析+溯源校验的纯逻辑测试
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { simpleHash, parseAIJSON } = require('../electron/ai-utils.cjs')

// 模拟 AI 输出（真实场景：全角逗号 + sourceNoteId 字面量 + ```json 包裹）
const aiOutput = `\`\`\`json
{
    "questions": [
        {
            "type": "choice",
            "question": "Home 键的功能是什么？",
            "options": ["A. 居中显示所有物体", "B. 只显示一个选定对象", "C. 切换视图模式", "D. 保存文件"],
            "answer": "A",
            "explanation": "Home 键用于居中显示场景中的所有物体。",
            "source": "《第三课Blender 基础操作进阶与界面全面解析》1. Home 键与小数点键（Numpad .）的区别",
            "sourceNoteId": "笔记id"
        },
        {
            "type": "choice",
            "question": "如何保存 Q 键收藏的参数？",
            "options": ["A. 点击文件保存", "B. 点击视图居中全部物体", "C. 点击选择全选A键", "D. 点击添加平面"],
            "answer": "A",
            "explanation": "直接点击文件保存，Q 键收藏的参数就会随之保存。",
            "source": "《第三课Blender 基础操作进阶与界面全面解析》1. Q 键收藏的保存方法",
            "sourceNoteId": "笔记id"
        }
    ]
}
\`\`\``

const normalizeCJK = (s) => String(s).replace(/，/g, ',').replace(/：/g, ':').replace(/“|”/g, '"').replace(/‘|’/g, "'").replace(/（/g, '(').replace(/）/g, ')')

describe('quiz 出题解析', () => {
  it('能解析含全角标点+代码块包裹的 AI 输出', () => {
    let parsed = null
    try { parsed = parseAIJSON(aiOutput) } catch { parsed = null }
    if (!parsed) { try { parsed = parseAIJSON(normalizeCJK(aiOutput)) } catch { parsed = null } }
    expect(parsed).not.toBeNull()
    expect(Array.isArray(parsed.questions)).toBe(true)
    expect(parsed.questions.length).toBe(2)
  })

  it('sourceNoteId 不可靠时按标题匹配笔记', () => {
    const picked = [
      { id: 'n123', title: '第三课Blender 基础操作进阶与界面全面解析', content: 'Home 键用于居中显示场景中的所有物体。点击文件保存，Q 键收藏的参数就会随之保存。' },
    ]
    const strip = (s) => String(s || '').replace(/\s+/g, '').toLowerCase()
    // 与 main.cjs 相同的模糊窗口匹配
    const containsFuzzy = (content, text) => {
      if (!text || text.length < 2) return false
      if (content.includes(text)) return true
      const win = Math.min(4, text.length)
      for (let i = 0; i + win <= text.length; i++) {
        if (content.includes(text.slice(i, i + win))) return true
      }
      return false
    }
    let parsed = parseAIJSON(normalizeCJK(aiOutput))
    const noteById = new Map(picked.map(n => [n.id, n]))
    const ok = []
    for (const q of parsed.questions) {
      let srcNote = noteById.get(q.sourceNoteId)
      if (!srcNote) {
        const titleMatch = (q.source || '').match(/《([^》]+)》/)
        srcNote = titleMatch ? picked.find(n => strip(n.title) === strip(titleMatch[1])) : undefined
      }
      expect(srcNote).toBeTruthy()
      const content = strip(srcNote.content || '')
      const idx = 'ABCD'.indexOf(String(q.answer || '').toUpperCase().trim())
      const optText = strip(q.options[idx].replace(/^[A-D][.、)\s]*/i, ''))
      expect(containsFuzzy(content, optText)).toBe(true)
      ok.push(q)
    }
    expect(ok.length).toBe(2)
  })
})
