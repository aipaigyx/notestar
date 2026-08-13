// 可测试的 AI 纯函数工具集（无 Electron 依赖，可被 Vitest 直接测试）

// 简单字符串哈希（用于分析缓存的内容指纹）
function simpleHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// 从 Markdown 中提取 data URI 图片
const IMAGE_URI_RE = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g

function extractImageURIs(text) {
  if (!text) return []
  const images = []
  let match
  const re = new RegExp(IMAGE_URI_RE.source, 'g')
  while ((match = re.exec(text)) !== null) {
    images.push({ alt: match[1], dataUri: match[2] })
  }
  return images
}

function countImages(text) {
  if (!text) return 0
  const matches = text.match(IMAGE_URI_RE)
  return matches ? matches.length : 0
}

// 把图片标记替换为占位说明（模型不支持视觉或用户选择不读图时）
function replaceImagesWithPlaceholders(text) {
  if (!text) return ''
  return text.replace(IMAGE_URI_RE, (m, alt) => `[图片：${alt || '未命名'}]`)
}

// AI 输出 JSON 容错解析（多种策略：直接解析 → 去代码块 → 截取大括号 → 兜底）
function parseAIJSON(result) {
  if (typeof result !== 'string') return result
  const raw = result.trim()
  // 策略1：直接解析
  try {
    return JSON.parse(raw)
  } catch (e) { /* fallthrough */ }
  // 策略2：去除 markdown 代码块标记
  try {
    let jsonStr = raw
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    return JSON.parse(jsonStr)
  } catch (e) { /* fallthrough */ }
  // 策略3：截取第一个 { 到最后一个 } 之间的内容
  try {
    const firstBrace = raw.indexOf('{')
    const lastBrace = raw.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(raw.substring(firstBrace, lastBrace + 1))
    }
  } catch (e) { /* fallthrough */ }
  return null
}

module.exports = {
  simpleHash,
  extractImageURIs,
  countImages,
  replaceImagesWithPlaceholders,
  parseAIJSON,
  IMAGE_URI_RE,
}
