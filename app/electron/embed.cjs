// 笔记向量化模块（本地 nomic-embed-text，无外部依赖）
// 用途：把笔记内容转成 768 维向量，存本地 embeddings.json；
//       AI 问答时先做向量检索，召回 Top-K 跨课程相关笔记作为上下文
//
// API: Ollama POST /api/embeddings {model, prompt} → {embedding: [float]}
// 模型: nomic-embed-text (137M, 768维, 离线本地)
const fs = require('fs')
const path = require('path')
const http = require('http')

const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text'
const EMBED_TIMEOUT = 30000 // 30s
const EMBED_DIM = 768 // nomic-embed-text 输出维度

// ========== Ollama HTTP 调用 ==========
function ollamaEmbed(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: EMBED_MODEL, prompt })
    const req = http.request({
      host: '127.0.0.1', port: 11434, path: '/api/embeddings',
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      timeout: EMBED_TIMEOUT,
    }, (res) => {
      let buf = ''
      res.on('data', (c) => { buf += c })
      res.on('end', () => {
        try {
          const j = JSON.parse(buf)
          if (j.embedding && Array.isArray(j.embedding)) resolve(j.embedding)
          else reject(new Error('embedding 字段缺失: ' + buf.slice(0, 200)))
        } catch (e) { reject(new Error('JSON parse 失败: ' + e.message)) }
      })
    })
    req.on('timeout', () => { req.destroy(new Error('embedding 超时')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ========== 文本预处理 ==========
// 截取标题 + 前 800 字内容（embedding 模型有上下文限制，去掉 markdown 噪声）
function buildEmbedText(note) {
  const stripMd = (s) => String(s || '')
    .replace(/```[\s\S]*?```/g, ' ')   // 去代码块
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')  // 去图片
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接保留文本
    .replace(/[#>*_`~]+/g, ' ')         // 去 markdown 符号
    .replace(/\s+/g, ' ')
    .trim()
  const title = stripMd(note.title).slice(0, 60)
  const body = stripMd(note.content).slice(0, 800)
  const text = `${title}\n${body}`.trim()
  return text.slice(0, 1000) // 总长 1000 字符内
}

// ========== 余弦相似度 ==========
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    dot += x * y; na += x * x; nb += y * y
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

// ========== Embeddings 仓库（内存 + JSON 持久化） ==========
class EmbeddingStore {
  constructor(filePath) {
    this.filePath = filePath
    this.map = new Map() // noteId → { vector, summary, courseId, updatedAt }
    this.load()
  }
  load() {
    try {
      if (!fs.existsSync(this.filePath)) return
      const arr = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      for (const e of arr) this.map.set(e.noteId, e)
    } catch (e) { /* 损坏文件降级为空 */ }
  }
  save() {
    try {
      const arr = Array.from(this.map.values())
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 0), 'utf-8')
    } catch (e) { /* 保存失败不致命 */ }
  }
  get(noteId) { return this.map.get(noteId) || null }
  has(noteId) { return this.map.has(noteId) }
  set(noteId, data) {
    this.map.set(noteId, { ...this.map.get(noteId), ...data, noteId, updatedAt: new Date().toISOString() })
    this.save()
  }
  delete(noteId) { this.map.delete(noteId); this.save() }
  size() { return this.map.size }
}

// ========== 单条 embed ==========
async function embedOne(store, note) {
  const text = buildEmbedText(note)
  if (!text) return null
  const vector = await ollamaEmbed(text)
  store.set(note.id, {
    vector,
    summary: text.slice(0, 200),
    courseId: note.courseId || '',
  })
  return { noteId: note.id, dim: vector.length }
}

// ========== 批量 embed（启动时增量补全用） ==========
async function batchEmbed(store, notes, opts = {}) {
  const concurrency = opts.concurrency || 2
  const skipIfFresh = opts.skipIfFresh !== false // 默认跳过已是新的
  let ok = 0, skip = 0, fail = 0
  const queue = notes.filter(n => {
    if (!skipIfFresh) return true
    const exist = store.get(n.id)
    if (!exist) return true
    // 笔记 updatedAt 比 embedding updatedAt 新 → 需重 embed
    return String(n.updatedAt || '') > String(exist.updatedAt || '')
  })
  // 简单并发控制
  const results = []
  for (let i = 0; i < queue.length; i += concurrency) {
    const slice = queue.slice(i, i + concurrency)
    const r = await Promise.allSettled(slice.map(n => embedOne(store, n)))
    for (const x of r) {
      if (x.status === 'fulfilled') { ok++; if (x.value) results.push(x.value) }
      else fail++
    }
    skip = queue.length - ok - fail
  }
  return { total: notes.length, queued: queue.length, ok, skip, fail, results }
}

// ========== Top-K 检索 ==========
function search(store, queryVector, opts = {}) {
  const k = opts.k || 5
  const minScore = opts.minScore || 0.3
  const courseFilter = opts.courseId || null // null = 跨课程
  const scored = []
  for (const e of store.map.values()) {
    if (courseFilter && e.courseId === courseFilter) continue // 跨课程
    const score = cosine(queryVector, e.vector)
    if (score >= minScore) scored.push({ noteId: e.noteId, courseId: e.courseId, summary: e.summary, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

module.exports = {
  EMBED_MODEL, EMBED_DIM,
  ollamaEmbed, buildEmbedText, cosine,
  EmbeddingStore, embedOne, batchEmbed, search,
}
