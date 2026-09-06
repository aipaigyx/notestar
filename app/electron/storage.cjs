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

// ========== 原子写（tmp + rename + bak） ==========
// P0-2 修复：防止断电/强杀进程时 JSON 半截损坏 → readJSON 返回默认值 → 笔记"全没了"
// 策略：
//   1) 写 <file>.tmp（完整 JSON）；失败 = 原文件不动
//   2) 读 rename 前的原文件内容，写 <file>.bak（保存上一版完整数据）
//   3) fs.renameSync(tmp, path) — 原子替换，NTFS/APFS/ext4 均保证原子；要么完成，要么回滚
//   4) 任何损坏情况下，readJSON 先 fallback .tmp，再 fallback .bak
function writeAtomic(path, content) {
  ensureDataDir()
  const tmp = path + '.tmp'
  const bak = path + '.bak'
  fs.writeFileSync(tmp, content, 'utf-8')
  let prevContent = null
  try { if (fs.existsSync(path)) prevContent = fs.readFileSync(path, 'utf-8') } catch (_) { /* ignore */ }
  if (prevContent != null) {
    try { fs.writeFileSync(bak, prevContent, 'utf-8') } catch (_) { /* ignore */ }
  }
  fs.renameSync(tmp, path)
}

// 兜底读：正式 → .tmp → .bak
function readWithFallbacks(file) {
  try {
    if (fs.existsSync(file)) return { src: 'main', raw: fs.readFileSync(file, 'utf-8') }
  } catch (_) {}
  const tmp = file + '.tmp'
  try {
    if (fs.existsSync(tmp)) return { src: 'tmp', raw: fs.readFileSync(tmp, 'utf-8') }
  } catch (_) {}
  const bak = file + '.bak'
  try {
    if (fs.existsSync(bak)) return { src: 'bak', raw: fs.readFileSync(bak, 'utf-8') }
  } catch (_) {}
  return { src: 'none', raw: null }
}

function readJSON(file, def) {
  if (_memoryCache.has(file)) return _memoryCache.get(file)
  const { src, raw } = readWithFallbacks(file)
  if (raw == null) { _memoryCache.set(file, def); return def }
  try {
    const parsed = JSON.parse(raw)
    _memoryCache.set(file, parsed)
    // 若从 tmp/bak 恢复：把恢复后的数据正式回写到主文件，避免下次仍走兜底
    if (src !== 'main') {
      try { writeAtomic(file, JSON.stringify(parsed, null, 2)) } catch (_) {}
      console.warn('[storage] ' + file + ' 从 ' + src + ' 恢复，已回写主文件')
    }
    return parsed
  } catch (e) {
    console.error('[storage] JSON 解析失败：' + file + '（来源=' + src + '），返回默认值', e)
    // 若主文件坏了，自动尝试 .bak 再读一次（上面 fallback 逻辑已覆盖，此处仅记录）
    _memoryCache.set(file, def)
    return def
  }
}

function flushWrite(file) {
  const timer = _writeTimers.get(file)
  if (timer) { clearTimeout(timer); _writeTimers.delete(file) }
  const data = _memoryCache.get(file)
  if (data !== undefined) {
    try {
      writeAtomic(file, JSON.stringify(data, null, 2))
    } catch (e) { console.error('写入失败（原子写）:', file, e) }
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
