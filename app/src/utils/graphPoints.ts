// 从笔记内容提取子知识点标题（供知识图谱 point 节点使用），可测试纯函数

export const REPORT_MARK = '## 🤖 AI 知识分析报告'

/**
 * 从笔记内容提取知识点标题列表：
 * 1. 优先取 ##/###/#### 标题（去重、清理 markdown 符号）
 * 2. 无标题时退回 - 列表项（长度 2~20 字）
 * 3. 只取 AI 报告之前的原始内容
 * @param content 完整笔记内容
 * @param max 最多返回个数（默认 8）
 */
export function extractKnowledgePoints(content: string, max = 8): string[] {
  if (!content) return []
  const reportIdx = content.indexOf(REPORT_MARK)
  const raw = reportIdx >= 0 ? content.slice(0, reportIdx) : content

  const clean = (t: string) => t.trim().replace(/\*\*/g, '').replace(/[`>]/g, '').trim()

  const headings: string[] = []
  const headingRe = /^#{2,4}\s+(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(raw)) !== null) {
    const t = clean(m[1])
    if (t && t.length > 1 && !headings.includes(t)) headings.push(t)
  }

  // 无标题时退回列表项
  if (headings.length === 0) {
    const lineRe = /^[-*]\s+(.+)$/gm
    while ((m = lineRe.exec(raw)) !== null && headings.length < max) {
      const t = clean(m[1])
      if (t && t.length > 2 && t.length < 20 && !headings.includes(t)) headings.push(t)
    }
  }

  return headings.slice(0, max)
}
