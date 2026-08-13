// AI 卡片：把 AI 分析/扩展结果包装成带样式的 HTML 卡片
// 追加到笔记后，在预览模式（markdown-body）中显示为粉紫渐变卡片
import { renderMarkdown } from '../store'

export type AiCardKind = 'analysis' | 'expansion'

export function buildAiCardHtml(kind: AiCardKind, title: string, markdownBody: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const bodyHtml = renderMarkdown(markdownBody || '')
  const icon = kind === 'analysis' ? '🧠' : '📚'
  return (
    `\n\n<div class="ai-card ai-card-${kind}">\n` +
    `  <div class="ai-card-head"><span class="ai-card-icon">${icon}</span><span class="ai-card-title">${title}</span><time class="ai-card-time">${stamp}</time></div>\n` +
    `  <div class="ai-card-body">${bodyHtml}</div>\n` +
    `</div>\n`
  )
}
