// 数据存储层：路径定义 + 内存缓存 + 防抖落盘（无 Electron 依赖，可测试）
const path = require('path')
const fs = require('fs')

const dataDir = path.join(__dirname, '..', 'data')
const notesFile = path.join(dataDir, 'notes.json')
const coursesFile = path.join(dataDir, 'courses.json')
const chatFile = path.join(dataDir, 'chatSessions.json')
const statsFile = path.join(dataDir, 'stats.json')
const settingsFile = path.join(dataDir, 'settings.json')
const analysisCacheFile = path.join(dataDir, 'analysisCache.json')
const quizzesFile = path.join(dataDir, 'quizzes.json')
const mistakesFile = path.join(dataDir, 'mistakes.json')
const masteryFile = path.join(dataDir, 'quizMastery.json')
const imagesDir = path.join(dataDir, 'images')

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

// 高频文件（notes/chat）写入采用防抖合并，避免每次保存都全量写盘；
// 读取优先返回内存最新数据（可能尚未落盘），保证读写一致；进程退出前强制 flush。
const _memoryCache = new Map()      // file -> 最近写入的数据
const _writeTimers = new Map()      // file -> setTimeout 句柄
const WRITE_DEBOUNCE_MS = 600       // 防抖窗口

function readJSON(file, def) {
  if (_memoryCache.has(file)) return _memoryCache.get(file)
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch (e) { console.error('读取失败:', file, e) }
  return def
}

function flushWrite(file) {
  const timer = _writeTimers.get(file)
  if (timer) { clearTimeout(timer); _writeTimers.delete(file) }
  const data = _memoryCache.get(file)
  if (data !== undefined) {
    try {
      ensureDataDir()
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) { console.error('写入失败:', file, e) }
  }
}

function flushAllWrites() {
  for (const file of [..._writeTimers.keys()]) flushWrite(file)
}

function writeJSON(file, data, { debounce = 0 } = {}) {
  _memoryCache.set(file, data)
  if (debounce > 0) {
    const existing = _writeTimers.get(file)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => { _writeTimers.delete(file); flushWrite(file) }, debounce)
    _writeTimers.set(file, timer)
    return
  }
  flushWrite(file)
}

module.exports = {
  dataDir, notesFile, coursesFile, chatFile, statsFile, settingsFile, analysisCacheFile, quizzesFile, mistakesFile, masteryFile, imagesDir,
  ensureDataDir, readJSON, writeJSON, flushWrite, flushAllWrites, WRITE_DEBOUNCE_MS,
}
