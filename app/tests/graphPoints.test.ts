import { describe, it, expect } from 'vitest'
import { extractKnowledgePoints } from '../src/utils/graphPoints'

describe('extractKnowledgePoints（知识图谱子知识点提取）', () => {
  it('提取 ## / ### 标题作为知识点', () => {
    const content = '# 总标题\n\n## 一、课前答疑\n\n### 1. Home 键用法\n\n## 二、工作模式\n\n正文'
    const points = extractKnowledgePoints(content, 8)
    expect(points).toContain('一、课前答疑')
    expect(points).toContain('1. Home 键用法')
    expect(points).toContain('二、工作模式')
  })

  it('不包含一级标题（仅 ##/###/####）', () => {
    const content = '# 总标题\n\n## 子标题'
    const points = extractKnowledgePoints(content, 8)
    expect(points).not.toContain('总标题')
    expect(points).toContain('子标题')
  })

  it('自动过滤 AI 分析报告之后的标题', () => {
    const content = '## 真实知识点\n\n## 🤖 AI 知识分析报告\n\n### 报告内的标题不应出现'
    const points = extractKnowledgePoints(content, 8)
    expect(points).toEqual(['真实知识点'])
    expect(points.join('')).not.toContain('报告内的标题')
  })

  it('清理 markdown 加粗和行内符号', () => {
    const content = '## **加粗标题** 和 `代码`'
    const points = extractKnowledgePoints(content, 8)
    expect(points[0]).toBe('加粗标题 和 代码')
  })

  it('无标题时退回列表项', () => {
    const content = '第一段文字\n- 快捷键整理\n- 界面布局说明\n- 长于二十个字的列表项不应该被采用因为太长了\n'
    const points = extractKnowledgePoints(content, 8)
    expect(points).toContain('快捷键整理')
    expect(points).toContain('界面布局说明')
    expect(points).not.toContain('长于二十个字的列表项不应该被采用因为太长了')
  })

  it('限制最大数量', () => {
    const content = Array.from({ length: 15 }, (_, i) => `## 知识点${i}`).join('\n')
    expect(extractKnowledgePoints(content, 8).length).toBe(8)
  })

  it('去重相同标题', () => {
    const content = '## 相同\n## 相同\n## 其他'
    const points = extractKnowledgePoints(content, 8)
    expect(points.filter(p => p === '相同').length).toBe(1)
  })

  it('空内容返回空数组', () => {
    expect(extractKnowledgePoints('')).toEqual([])
    expect(extractKnowledgePoints(undefined as unknown as string)).toEqual([])
  })
})
