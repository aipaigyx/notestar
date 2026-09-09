// Electron 主进程 - 本地数据后端 + AI 接口
const { app, BrowserWindow, ipcMain, dialog, safeStorage, protocol, net, Tray, Menu, session } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')
const { HttpsProxyAgent } = require('https-proxy-agent')

// 禁用 Chromium sandbox：本机（搜狗输入法等注入组件/系统安全机制）与 sandbox 冲突，
// 会导致渲染进程启动即被杀（0x80000003 断点异常，reason: killed）。必须在 app ready 前生效。
app.commandLine.appendSwitch('no-sandbox')

// 硬件加速：默认开启（保证 backdrop-filter 毛玻璃质感不糊）。
// 若某机器 GPU 沙箱导致渲染进程崩溃，设环境变量 NOTESTAR_SOFTWARE=1 回退软件渲染（毛玻璃会略糊）。
if (process.env.NOTESTAR_SOFTWARE === '1') {
  app.disableHardwareAcceleration()
}

// 笔记向量化（本地 nomic-embed-text，跨课程检索用）
// 注意：EMBEDDINGS_FILE / embeddingStore 需要 dataDir（来自 storage.cjs），
// 在 storage require 之后才能初始化。
const { EmbeddingStore, embedOne, batchEmbed, search: embedSearch, ollamaEmbed, EMBED_MODEL, EMBED_DIM } = require('./embed.cjs')
const autoUpdater = require('./auto-updater.cjs')
let embeddingStore = null


protocol.registerSchemesAsPrivileged([
  { scheme: 'notestar-img', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: 'notestar-rec', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true } },
])

// ========== 日志系统 ==========
let mainWindow = null  // 提前声明，避免 TDZ 问题

const logDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR']
const LEVEL_COLORS = { DEBUG: '#9B9BB5', INFO: '#4292F5', WARN: '#F39C12', ERROR: '#E74C3C' }
let currentLogLevel = LOG_LEVELS.INFO // 默认 INFO 级别

// stdout/stderr 的管道被提前关闭（如 `npm start | head` 之类的管道断开）时，
// 写控制台会抛 EPIPE 并让主进程崩溃。挂上 error 监听静默吞掉，日志照常进文件。
for (const stream of [process.stdout, process.stderr]) {
  if (stream && typeof stream.on === 'function') {
    stream.on('error', (err) => {
      if (!err || err.code !== 'EPIPE') throw err
      // EPIPE：忽略，应用继续运行（文件日志不受影响）
    })
  }
}

function getLogFile() {
  const today = new Date().toISOString().split('T')[0]
  return path.join(logDir, `${today}.log`)
}

function formatTimestamp() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
         `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

function writeLog(level, source, message, data) {
  if (level < currentLogLevel) return
  const levelName = LEVEL_NAMES[level]
  const ts = formatTimestamp()
  const dataStr = data !== undefined ? ` | ${typeof data === 'string' ? data : JSON.stringify(data)}` : ''
  const logLine = `[${ts}] [${levelName}] [${source}] ${message}${dataStr}\n`

  // 写入文件。若当天的公共日志被系统或查看器短暂占用，降级写入独立会话文件，确保日志不会丢失。
  try {
    fs.appendFileSync(getLogFile(), logLine, 'utf-8')
  } catch (e) {
    try {
      const fallbackLogFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}-${process.pid}.log`)
      fs.appendFileSync(fallbackLogFile, logLine, 'utf-8')
      console.warn(`当天日志文件被占用，已写入会话日志: ${path.basename(fallbackLogFile)}`)
    } catch (fallbackError) {
      console.error('日志写入文件失败:', fallbackError.message)
    }
  }

  // 同时输出到控制台（管道断开等异常场景不允许再向上抛，避免主进程崩溃）
  try {
    if (level >= LOG_LEVELS.ERROR) {
      console.error(logLine.trimEnd())
    } else if (level >= LOG_LEVELS.WARN) {
      console.warn(logLine.trimEnd())
    } else {
      console.log(logLine.trimEnd())
    }
  } catch (e) {
    // stdout 管道已断开：仅保留文件日志，控制台输出失败不影响运行
  }

  // 推送到渲染进程（实时日志）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log:entry', {
      timestamp: ts,
      level: levelName,
      levelColor: LEVEL_COLORS[levelName],
      source,
      message,
      data: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : null,
    })
  }
}

// 日志工具函数
const logger = {
  debug: (source, message, data) => writeLog(LOG_LEVELS.DEBUG, source, message, data),
  info: (source, message, data) => writeLog(LOG_LEVELS.INFO, source, message, data),
  warn: (source, message, data) => writeLog(LOG_LEVELS.WARN, source, message, data),
  error: (source, message, data) => writeLog(LOG_LEVELS.ERROR, source, message, data),
  setLevel: (level) => { currentLogLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO },
}

// 清理超过7天的旧日志
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(logDir)
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    for (const f of files) {
      if (!f.endsWith('.log')) continue
      const filePath = path.join(logDir, f)
      const stat = fs.statSync(filePath)
      if (now - stat.mtime.getTime() > sevenDays) {
        fs.unlinkSync(filePath)
        console.log('[Log] 清理旧日志文件:', f)
      }
    }
  } catch (e) {
    // 静默处理
  }
}

logger.info('Main', '应用启动', { version: '1.0.0', platform: process.platform })
// 旧日志清理由手动维护或后续空闲任务执行；不可在启动链路同步运行，避免被系统文件锁阻塞窗口创建。

// 检测系统代理配置
function getProxyAgent() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
                process.env.HTTP_PROXY || process.env.http_proxy
  if (proxy) {
    try {
      logger.info('AI', '检测到系统代理', { proxy })
      return new HttpsProxyAgent(proxy)
    } catch (e) {
      logger.warn('AI', '代理初始化失败', { error: e.message })
    }
  }
  return null
}

// 重定向用户数据目录到项目文件夹。可通过环境变量使用独立运行缓存，不影响 app/data 中的笔记数据。
const localUserData = process.env.NOTESTAR_USERDATA_DIR || path.join(__dirname, '..', 'userdata')
if (!fs.existsSync(localUserData)) fs.mkdirSync(localUserData, { recursive: true })
app.setPath('userData', localUserData)

// GPU 兼容模式：当设为软件渲染时禁用 GPU（部分 Windows 环境的 GPU 沙箱会导致渲染进程退出）。
// 硬件加速开启（默认）时绝不加这些开关，否则毛玻璃/动画会退化甚至崩溃。
if (process.env.NOTESTAR_SOFTWARE === '1') {
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
}

// GPU 缓存目录（避免沙箱权限问题）
const gpuCacheDir = path.join(localUserData, 'GPUCache')
if (!fs.existsSync(gpuCacheDir)) fs.mkdirSync(gpuCacheDir, { recursive: true })
app.commandLine.appendSwitch('disk-cache-dir', gpuCacheDir)

const isDev = process.env.DEV === '1'

// ========== 数据存储层（storage.cjs：路径 + 内存缓存 + 防抖落盘） ==========
const {
  dataDir, notesFile, coursesFile, chatFile, statsFile, settingsFile, analysisCacheFile, quizzesFile, mistakesFile, masteryFile, imagesDir,
  ensureDataDir, readJSON, writeJSON, flushWrite, flushAllWrites, WRITE_DEBOUNCE_MS,
} = require('./storage.cjs')

// 笔记向量化仓库（本地 nomic-embed-text，跨课程检索用）
const EMBEDDINGS_FILE = path.join(dataDir, 'embeddings.json')
embeddingStore = new EmbeddingStore(EMBEDDINGS_FILE)

// 可测试纯函数（AI JSON 容错解析 / 哈希）从 ai-utils 引入
const { simpleHash, parseAIJSON } = require('./ai-utils.cjs')

// ========== AI 调用模块（callAI.cjs：平台配置 / 模型路由 / OpenAI 兼容调用 / 多模态） ==========
const { createAIModule } = require('./callAI.cjs')
const { callAI, callAIWithRetry, buildMultimodalContent, isVisionCapableModel, AI_PLATFORMS } =
  createAIModule({ logger, getProxyAgent })


// ========== API Key 安全存储（safeStorage 加密） ==========
// settings.json 中 apiKey 以 "enc:<base64>" 形式存储，读取时解密；旧明文自动兼容。
function encryptSecret(plain) {
  if (!plain) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(plain).toString('base64')
    }
    logger.warn('Main', 'safeStorage 加密不可用（isEncryptionAvailable=false），Key 保持明文存储')
  } catch (e) { logger.warn('Main', 'safeStorage 加密不可用，Key 降级明文存储', { error: e.message }) }
  return plain
}

function decryptSecret(stored) {
  if (!stored) return ''
  if (typeof stored === 'string' && stored.startsWith('enc:')) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
      }
    } catch (e) { logger.warn('Main', 'safeStorage 解密失败（可能换了机器或密钥丢失）', { error: e.message }) }
    return ''
  }
  return stored // 旧明文数据
}

// 统一读取设置（解密 apiKey + apiKeys）
function readSettings() {
  const saved = readJSON(settingsFile, { apiKey: '', model: 'deepseek-chat', provider: 'deepseek' })
  if (!saved.provider) saved.provider = 'deepseek'
  if (saved.apiKey) saved.apiKey = decryptSecret(saved.apiKey)
  // 解密每平台 key 映射（整体加密存于 apiKeysEnc）
  if (saved.apiKeysEnc) {
    try {
      saved.apiKeys = JSON.parse(decryptSecret(saved.apiKeysEnc) || '{}')
    } catch (e) { saved.apiKeys = {} }
    delete saved.apiKeysEnc
  } else {
    saved.apiKeys = saved.apiKeys || {}
  }
  // 兼容迁移：旧版只有 apiKey 单字段 → 归入 apiKeys[当前 provider]
  if (saved.apiKey && !saved.apiKeys[saved.provider]) {
    saved.apiKeys[saved.provider] = saved.apiKey
  }
  // apiKey 恒 = 当前 provider 的 key（后续逻辑全部只读 apiKey，无需改）
  if (saved.apiKeys[saved.provider]) {
    saved.apiKey = saved.apiKeys[saved.provider]
  }
  return saved
}

// 统一保存设置（加密 apiKey + apiKeys）
function saveSettings(settings) {
  const toStore = { ...settings }
  // 每平台 key 映射：整体加密到 apiKeysEnc（避免逐字段前缀歧义）
  if (toStore.apiKeys && typeof toStore.apiKeys === 'object') {
    toStore.apiKeysEnc = encryptSecret(JSON.stringify(toStore.apiKeys))
  }
  delete toStore.apiKeys
  if (toStore.apiKey) toStore.apiKey = encryptSecret(toStore.apiKey)
  writeJSON(settingsFile, toStore, { debounce: WRITE_DEBOUNCE_MS })
}

// ========== IPC: 设置 ==========
ipcMain.handle('settings:get', () => readSettings())
ipcMain.handle('settings:save', (event, settings) => {
  saveSettings(settings)
  return true
})

// ========== IPC: 测试 API 连通性（目录 + 真实对话 双探测） ==========
// 第一层 GET /models 验证网络/鉴权/目录；第二层 POST chat/completions 极小请求验证
// 「实际能不能出题」——避免出现"测试全绿、一出题就红"的误导。
// 返回 { success, message, models?: string[], chatOk?: boolean }
ipcMain.handle('ai:testConnection', async (event, { provider, apiKey, hostname, apiPath, model }) => {
  const p = provider || 'deepseek'
  const platform = AI_PLATFORMS[p] || AI_PLATFORMS.deepseek
  // 本地模型不需要 API Key
  if (!apiKey && p !== 'local') return { success: false, message: '请先填写 API Key' }

  const host = hostname || platform.hostname
  const basePath = (apiPath || platform.apiPath).replace(/\/chat\/completions.*$/, '')
  // 目录路径：/v1/v4/compatible-mode 直加 /models，其余同理（NVIDIA /v1/models、DeepSeek /models、智谱 /api/paas/v4/models）
  const modelsPath = basePath + '/models'
  // 对话路径：与真实调用保持一致。内置/自定义完整路径原样用；只有 base 时补 /chat/completions
  const rawChat = apiPath || platform.apiPath
  const chatPath = rawChat.includes('/chat/completions') ? rawChat : basePath + '/chat/completions'

  const isLocal = platform.protocol === 'http' || p === 'local'
  const httpMod = isLocal ? require('http') : https
  const port = platform.port || (isLocal ? 80 : 443)

  logger.info('AI', '测试连通性（双探测）', { provider: p, hostname: host, port, modelsPath, chatPath })

  // 通用 JSON 请求（resolve 永不 reject，统一走 status/networkError 字段）
  const requestJson = (method, path, body, timeoutMs) => new Promise((resolve) => {
    const headers = { 'Accept': 'application/json' }
    if (!platform.noAuth) headers['Authorization'] = `Bearer ${apiKey}`
    let data = null
    if (body) {
      headers['Content-Type'] = 'application/json'
      data = JSON.stringify(body)
      headers['Content-Length'] = Buffer.byteLength(data)
    }
    const options = { hostname: host, port, path, method, headers }
    // 云端请求使用系统代理；本地回环请求不走代理
    if (!isLocal) {
      const proxyAgent = getProxyAgent()
      if (proxyAgent) options.agent = proxyAgent
    }
    let settled = false
    const done = (r) => { if (!settled) { settled = true; resolve(r) } }
    const req = httpMod.request(options, (res) => {
      let buf = ''
      res.on('data', (c) => buf += c)
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(buf) } catch { /* 非 JSON 响应 */ }
        done({ status: res.statusCode, body: buf, json })
      })
    })
    req.on('error', (e) => done({ status: 0, body: '', json: null, networkError: e.message }))
    req.setTimeout(timeoutMs, () => { req.destroy(); done({ status: 0, body: '', json: null, networkError: 'timeout' }) })
    if (data) req.write(data)
    req.end()
  })

  // ---- 第一层：目录探测（10s） ----
  const modelsRes = await requestJson('GET', modelsPath, null, 10000)
  if (modelsRes.status === 0) {
    const msg = modelsRes.networkError === 'timeout'
      ? '连接超时（10秒），请检查网络或代理设置'
      : `网络错误：${modelsRes.networkError}`
    logger.error('AI', '连通性测试网络错误', { error: modelsRes.networkError })
    return { success: false, message: msg }
  }
  if (modelsRes.status !== 200) {
    const errPreview = modelsRes.body.substring(0, 200)
    logger.error('AI', '连通性测试失败', { status: modelsRes.status, body: errPreview })
    return { success: false, message: `连接失败：HTTP ${modelsRes.status}${errPreview ? ' — ' + errPreview : ''}` }
  }
  const models = ((modelsRes.json && (modelsRes.json.data || modelsRes.json.models)) || []).map(m => m.id || m.name).filter(Boolean)
  logger.info('AI', '目录探测成功', { modelCount: models.length })

  // ---- 第二层：真实对话探测（15s，极小请求：ping + 1 token） ----
  const probeModel = (model && String(model).trim()) || models[0] || platform.defaultModel
  const chatRes = await requestJson('POST', chatPath, {
    model: probeModel,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
    temperature: 0,
  }, 15000)

  if (chatRes.status === 200) {
    logger.info('AI', '对话探测成功', { model: probeModel })
    return {
      success: true,
      message: `连接正常！共 ${models.length} 个可用模型，对话接口实测可用（${probeModel}）✅`,
      models,
      chatOk: true,
    }
  }

  // 目录可达但对话不可用：给出针对性原因（红色失败，不再"假绿"）
  const bodyText = chatRes.body || ''
  let chatErr = ''
  if (chatRes.status === 0) {
    chatErr = chatRes.networkError === 'timeout'
      ? '对话请求超时（15秒）——模型可能排队或路由较慢'
      : `对话请求网络错误：${chatRes.networkError}`
  } else if (bodyText.includes('Function') && bodyText.includes('not found')) {
    chatErr = 'HTTP 404 Function not found——该账号无此模型的调用权限（目录可见 ≠ 可对话）。请在设置中换用标注「实测可用」的模型（如 google/gemma-4-31b-it），或到 build.nvidia.com 检查账号对该模型的授权'
  } else if (chatRes.status === 401 || chatRes.status === 403) {
    chatErr = `HTTP ${chatRes.status} 鉴权失败——API Key 无效或无权限`
  } else if (chatRes.status === 429) {
    chatErr = 'HTTP 429 限流/排队——免费额度可能已用尽，请稍后再试'
  } else {
    chatErr = `HTTP ${chatRes.status} — ${bodyText.substring(0, 150)}`
  }
  logger.error('AI', '对话探测失败（目录可达但对话不可用）', { status: chatRes.status, model: probeModel, body: bodyText.substring(0, 200) })
  return {
    success: false,
    models,
    chatOk: false,
    message: `⚠️ 目录可达（${models.length} 个模型）但对话接口不可用：${chatErr}。此时出题/问答会失败，请处理后重测`,
  }
})

// ========== IPC: 文件导入 ==========
ipcMain.handle('files:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择转写文本文件',
    filters: [
      { name: '文本文件', extensions: ['txt', 'md'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const files = result.filePaths.map(fp => ({
    name: path.basename(fp),
    content: fs.readFileSync(fp, 'utf-8'),
  }))
  return files
})


// ========== IPC: 选择图片（返回 base64 data URI） ==========
ipcMain.handle('files:selectImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const buffer = fs.readFileSync(filePath)

  // MIME 映射
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' }
  const mime = mimeMap[ext] || 'image/png'

  // 限制 5MB（base64 后约 6.7MB，避免 IPC 传输过大）
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('图片不能超过 5MB，请压缩后重试')
  }

  const base64 = buffer.toString('base64')
  const dataUri = `data:${mime};base64,${base64}`
  const fileName = path.basename(filePath)

  logger.info('File', '图片已读取', { name: fileName, size: buffer.length, mime })
  return { name: fileName, dataUri, size: buffer.length }
})

// ========== IPC: 读取剪贴板图片 ==========
ipcMain.handle('files:readClipboardImage', async () => {
  const { clipboard, nativeImage } = require('electron')
  const image = clipboard.readImage()
  if (image.isEmpty()) return null

  const size = image.getSize()
  // 限制 5MB
  const dataUrl = image.toDataURL()
  if (dataUrl.length > 7 * 1024 * 1024) {
    throw new Error('剪贴板图片不能超过 5MB，请压缩后重试')
  }

  logger.info('File', '剪贴板图片已读取', { width: size.width, height: size.height })
  return { name: `clipboard_${Date.now()}.png`, dataUri: dataUrl, size: dataUrl.length }
})

// ========== 图片外置存储：base64 落盘为文件，笔记内存相对引用 ==========
// 返回相对路径如 "images/img_xxx.png"，渲染进程通过 notestar-img:// 协议加载。
async function saveImageDataUri(dataUri) {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
    logger.error('File', 'images:save 收到无效图片数据', { type: typeof dataUri, len: typeof dataUri === 'string' ? dataUri.length : -1, head: typeof dataUri === 'string' ? dataUri.slice(0, 80) : String(dataUri) })
    throw new Error('无效的图片数据')
  }
  // 注意：禁止用正则 `(.*)$` 提取 payload——V8 正则对超长 cons/sliced 字符串
  // （经 IPC/contextBridge 传输后的字符串）存在匹配 bug，只返回前几个字符，
  // 导致 base64 解码仅剩 4 字节、保存的图片损坏、预览加载坏图崩溃白屏。
  // 改用可靠的 indexOf + slice。
  const commaIdx = dataUri.indexOf(',')
  if (commaIdx <= 0) throw new Error('不支持的图片格式')
  const header = dataUri.slice(5, commaIdx)   // e.g. "image/png;base64"
  const payload = dataUri.slice(commaIdx + 1) // base64 或 URL 编码数据
  const mimeType = header.split(';')[0]
  const isBase64 = /base64/i.test(header)
  logger.info('File', 'images:save 收到', { len: dataUri.length, head: dataUri.slice(0, 50), tail: dataUri.slice(-20), payloadLen: payload.length })

  const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }
  const ext = extMap[mimeType] || 'png'
  const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
  const filePath = path.join(imagesDir, filename)

  const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf-8')
  fs.writeFileSync(filePath, buffer)
  logger.info('File', '图片已外置存储', { filename, size: buffer.length, mimeType })
  return `images/${filename}`
}

// 渲染进程入口（渲染层传图落盘，保持原通道兼容）
ipcMain.handle('images:save', async (e, dataUri) => saveImageDataUri(dataUri))

// 注册图片协议：notestar-img://<filename> → data/images/<filename>
function registerImageProtocol() {
  protocol.handle('notestar-img', (req) => {
    try {
      const url = new URL(req.url)
      // 兼容两种 URL 形态：
      //   notestar-img://img_xxx.png  → host=img_xxx.png（standard 协议把文件名解析为 host）
      //   notestar-img://web/xxx.jpg  → host=web, path=/xxx.jpg（子目录参考图）
      // 统一拼成相对路径（host + pathname）
      let rel = (url.hostname || '') + (url.pathname || '')
      if (!rel || rel.includes('..')) return new Response('bad request', { status: 400 })
      const filename = path.basename(rel)
      if (!filename) return new Response('bad request', { status: 400 })
      const filePath = path.resolve(imagesDir, rel)
      // 安全：仅允许 images 目录内的文件
      if (!filePath.startsWith(path.resolve(imagesDir) + path.sep)) {
        return new Response('forbidden', { status: 403 })
      }
      if (!fs.existsSync(filePath)) {
        logger.warn('Img', '协议请求文件不存在', { filename, rel })
        return new Response('not found', { status: 404 })
      }
      // 注意：不要用 net.fetch(file://...) —— Electron 的 net.fetch 不支持 file:// 协议，
      // 会导致图片加载失败（预览里图片空白/裂图）。直接用 fs 读文件返回 Buffer。
      const data = fs.readFileSync(filePath)
      const mime = /\.png$/i.test(filename) ? 'image/png'
        : /\.jpe?g$/i.test(filename) ? 'image/jpeg'
        : /\.gif$/i.test(filename) ? 'image/gif'
        : /\.webp$/i.test(filename) ? 'image/webp'
        : 'image/svg+xml'
      logger.info('Img', '协议返回图片', { filename, bytes: data.length, mime })
      return new Response(data, {
        headers: { 'Content-Type': mime, 'Cache-Control': 'no-cache' },
      })
    } catch (e) {
      logger.warn('Img', '协议处理异常', { url: String(req.url).slice(0, 100), err: e.message })
      return new Response('bad request', { status: 400 })
    }
  })
  logger.info('Main', 'notestar-img 图片协议已注册')
}

// 录屏文件协议：notestar-rec://<sessionId>/seg_001.webm（复习页播放本地录屏）
function registerRecordingProtocol() {
  protocol.handle('notestar-rec', (req) => {
    try {
      const url = new URL(req.url)
      let rel = (url.hostname || '') + (url.pathname || '')
      rel = decodeURIComponent(rel)
      // 安全：仅允许 recordings 目录内
      const base = path.resolve(RECORDINGS_DIR)
      const fp = path.resolve(base, rel)
      const exists = fs.existsSync(fp)
      if (!fp.startsWith(base + path.sep) || !exists || !/\.(webm|mp4)$/i.test(fp)) {
        logger.warn('RecProtocol', '404 未找到文件', { url: req.url.slice(0, 120), rel: rel.slice(0, 80), pathExists: exists })
        return new Response('not found', { status: 404 })
      }
      const stat = fs.statSync(fp)
      const fileSize = stat.size
      const mime = /\.mp4$/i.test(fp) ? 'video/mp4' : 'video/webm'

      // 支持 Range 请求（HTML5 video 必须）
      const range = req.headers.get('range')
      if (range && /^bytes=/.test(range)) {
        const m = range.match(/^bytes=(\d+)-(\d*)$/)
        if (m) {
          const start = parseInt(m[1], 10)
          const end = m[2] ? parseInt(m[2], 10) : fileSize - 1
          const len = Math.min(end + 1, fileSize) - start
          // Buffer → Uint8Array（确保 Electron Response body 兼容性）
          const raw = fs.readFileSync(fp)
          const chunk = new Uint8Array(raw.buffer, raw.byteOffset + start, len)
          logger.info('RecProtocol', 'Range 206', { file: rel, start, end, len, total: fileSize })
          return new Response(chunk, {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Length': String(len),
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes ${start}-${start + len - 1}/${fileSize}`,
              'Cache-Control': 'no-cache',
            }
          })
        }
      }
      // 非 Range：返回完整文件
      const data = fs.readFileSync(fp)
      const out = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      logger.info('RecProtocol', 'Full 200', { file: rel, size: fileSize, mime })
      return new Response(out, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        }
      })
    } catch (e) {
      logger.error('RecProtocol', '协议异常', { err: e?.message, stack: e?.stack?.slice(0, 200) })
      return new Response('bad request', { status: 400 })
    }
  })
  logger.info('Main', 'notestar-rec 录屏协议已注册')
}

// ========== IPC: 实时屏幕截图（看视频记笔记用） ==========
// 列出所有屏幕 + 窗口（含缩略图），供截屏选择面板使用
ipcMain.handle('screen:listSources', async () => {
  const { desktopCapturer } = require('electron')
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } })
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    isScreen: s.id.startsWith('screen:'),
    thumbnail: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL(),
  }))
})

// 截取指定窗口/屏幕的高清画面，返回 dataURL
// P0-V1/2/3 整体重构：
//   · 移除不靠谱的 PowerShell + 标题字符串猜（V2）
//   · 只用 1 次 getSources，不再重复调用（V1）
//   · 默认 JPEG 质量 82 压缩（V3）
// 策略：
//   ① 若参数传了 {sourceId} → 精确按 id 截图
//   ② 否则若 settings.rememberedCapture 有记忆 → 按记忆的 sourceId 截
//   ③ 否则 → 返回 { needsPicker: true }，要求前端用选择器让用户明确选源
// 策略：
//   ① 若参数传了 {sourceId} → 精确按 id 截图
//   ② 否则若 settings.rememberedCapture 有记忆 → 按记忆的 sourceId 截
//   ③ 否则 → 返回 { needsPicker: true }，要求前端用选择器让用户明确选源
ipcMain.handle('screen:capture', async (e, { sourceId = '', mode = 'source' }) => {
  const { desktopCapturer } = require('electron')
  const HD = { width: 1920, height: 1080 }
  const JPEG_QUALITY = 0.82
  const IS_FOREGROUND = mode === 'foreground'
  const COURSE_KEYWORDS = /bilibili|哔哩哔哩|b站|腾讯会议|tencent meeting|wemeet|welink|钉钉|dingtalk|zoom|飞书|feishu|网课|课堂|直播|播放|视频|课程|讲座|网易云课堂|coursera|mooc|极客|开课|教学|讲师|学习/i

  // Layer 0 helper：Windows 原生拿真·前台窗口标题（PowerShell 调 user32!GetForegroundWindow，1.5s 超时绝不阻塞截屏）
  let _fgTitleCache = null
  function getWinForegroundTitle() {
    if (process.platform !== 'win32') return ''
    if (_fgTitleCache) return _fgTitleCache
    try {
      const { execFileSync } = require('child_process')
      const psCmd = `Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class W32Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@; $h=[W32Fg]::GetForegroundWindow(); $sb=New-Object System.Text.StringBuilder 512; [W32Fg]::GetWindowText($h,$sb,512)|Out-Null; $o=[PSCustomObject]@{t=$sb.ToString()}; $o|ConvertTo-Json -Compress`
      const raw = execFileSync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-Command', psCmd
      ], { timeout: 1500, windowsHide: true, encoding: 'utf8' })
      const parsed = JSON.parse(String(raw).trim())
      _fgTitleCache = (parsed?.t || '').trim()
      return _fgTitleCache
    } catch (_) { return '' }
  }

  // fix8: 三层精准匹配替换原"枚举乱序"随便挑
  // Layer 优先级：1=前台窗口标题精确/子串 > 2=记忆窗口名模糊token > 3=网课关键词正则 > 4=原兜底排除系统窗口
  function pickForegroundFallback(list, rememberedName) {
    const badExact = new Set(['', 'program manager', 'windows shell experience host', 'microsoft store', 'search', 'taskbar', 'notestar', '笔记星图', 'electron', 'windows explorer', 'this pc', '此电脑', '回收站'])
    // 先过基础过滤：名/thumbnail 不能为空、不是精确系统名
    const base = list.filter(s => {
      const n = String(s.name || '').trim()
      if (!n) return false
      if (badExact.has(n.toLowerCase())) return false
      if (!s.thumbnail || s.thumbnail.isEmpty()) return false
      return true
    })
    const fgTitle = getWinForegroundTitle()
    const memTokens = rememberedName ? String(rememberedName).toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(t => t && t.length >= 2) : []
    const layerLog = { fgTitle: fgTitle || '(none)', rememberedName: rememberedName || '(none)', memTokens, totalBase: base.length, picked: null, layer: null }

    // Layer 1：前台窗口标题匹配（精确→子串）。用户点击「跟拍开始」那一刻真的在看的窗口，命中这层就是 100% 对
    if (fgTitle) {
      const fgLower = fgTitle.toLowerCase()
      const l1 = base.find(s => s.name.toLowerCase() === fgLower) ||
                 base.find(s => fgLower.includes(s.name.toLowerCase())) ||
                 base.find(s => s.name.toLowerCase().includes(fgLower))
      if (l1) { layerLog.picked = { name: l1.name, id: l1.id }; layerLog.layer = 'L1_FOREGROUND_WIN'; logger.info('Screen', 'pickForeground LAYER1 前台窗口标题命中', layerLog); return l1 }
    }
    // Layer 2：记忆窗口名 模糊 token 匹配（id 失效了但窗口名肯定还是同一类网课浏览器）
    if (memTokens.length) {
      const scored = base.map(s => {
        const nl = s.name.toLowerCase()
        let score = 0
        for (const t of memTokens) if (nl.includes(t)) score += (t.length >= 4 ? 3 : 1)
        // 同名浏览器（如都是"360安全浏览器"）再加 2
        if (rememberedName && nl.includes(rememberedName.toLowerCase())) score += 10
        return { s, score }
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score)
      if (scored.length) {
        layerLog.picked = { name: scored[0].s.name, id: scored[0].s.id, score: scored[0].score }
        layerLog.layer = 'L2_REMEMBERED_TOKEN'
        logger.info('Screen', 'pickForeground LAYER2 记忆名token命中', layerLog)
        return scored[0].s
      }
    }
    // Layer 3：网课关键词正则（用户没选源，按常见网课/直播 APP 名猜）
    const l3 = base.find(s => COURSE_KEYWORDS.test(s.name))
    if (l3) { layerLog.picked = { name: l3.name, id: l3.id }; layerLog.layer = 'L3_COURSE_KEYWORD'; logger.info('Screen', 'pickForeground LAYER3 网课关键词命中', layerLog); return l3 }
    // Layer 4：兜底（原逻辑：优先 window 类型，随便挑一个不崩就行）
    const sorted = [...base].sort((a, b) => (a.id.startsWith('window:') ? 0 : 1) - (b.id.startsWith('window:') ? 0 : 1))
    if (sorted[0]) { layerLog.picked = { name: sorted[0].name, id: sorted[0].id }; layerLog.layer = 'L4_FALLBACK'; logger.warn('Screen', 'pickForeground LAYER4 兜底猜（可能截错，建议用户手动重选一次记忆源）', layerLog); return sorted[0] }
    logger.warn('Screen', 'pickForeground 四层全部没候选', layerLog)
    return null
  }

  // 1) 先决定目标 id（显式传参 → 记忆 → 需要 picker）
  let targetId = IS_FOREGROUND ? '' : sourceId
  let rememberedNameHolder = ''
  if (!targetId && !IS_FOREGROUND) {
    const s = readJSON(settingsFile, {})
    const remembered = s?.rememberedCapture
    if (remembered?.sourceId) {
      targetId = remembered.sourceId
      rememberedNameHolder = remembered.sourceName || ''
      logger.info('Screen', '使用记忆的截图源', { id: targetId, name: remembered.sourceName })
    }
  } else if (IS_FOREGROUND) {
    // 虽然 foreground 跳过记忆 sourceId，但名字我们要拿出来做 Layer2 token 匹配
    const s = readJSON(settingsFile, {})
    rememberedNameHolder = s?.rememberedCapture?.sourceName || ''
  }

  // 2) 只做 1 次 getSources
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: HD })

  // 没有目标 id（含 foreground 强制空 → 自动挑窗口；纯空且非 foreground → 原来的 needsPicker）
  if (!targetId) {
    if (IS_FOREGROUND) {
      const auto = pickForegroundFallback(sources, rememberedNameHolder)
      if (auto) {
        const dataUri = auto.thumbnail.toDataURL({ format: 'image/jpeg', quality: JPEG_QUALITY })
        logger.info('Screen', '截屏完成（JPEG 82）', { name: auto.name, bytes: Math.round(dataUri.length * 0.75), sourceId: auto.id })
        return { name: auto.name, dataUri, sourceId: auto.id, needsPicker: false }
      }
      logger.warn('Screen', 'foreground 自动选源失败：所有窗口 thumbnail 为空/全是系统窗口', { count: sources.length })
      return { needsPicker: true, reason: 'foreground_no_candidate', name: '', dataUri: '', sourceId: '' }
    }
    logger.info('Screen', '未提供截图源 id，要求用户通过选择器选窗口', { mode })
    return { needsPicker: true, name: '', dataUri: '', sourceId: '' }
  }

  // 3) 精确按 id 取 source（不再猜）
  let source = sources.find(s => s.id === targetId)
  // 记忆源失效 + foreground / 非foreground 都走 picker 兜底（非foreground也兜底，避免卡 needsPicker）
  if (!source) {
    const auto = pickForegroundFallback(sources, rememberedNameHolder)
    if (auto) {
      logger.info('Screen', '记忆源失效，fallback 选源', { failedId: targetId, fallbackId: auto.id, name: auto.name })
      const dataUri = auto.thumbnail.toDataURL({ format: 'image/jpeg', quality: JPEG_QUALITY })
      logger.info('Screen', '截屏完成（JPEG 82）', { name: auto.name, bytes: Math.round(dataUri.length * 0.75), sourceId: auto.id })
      return { name: auto.name, dataUri, sourceId: auto.id, needsPicker: false }
    }
    logger.info('Screen', '记忆的 sourceId 已失效，需重新选择', { id: targetId })
    return { needsPicker: true, reason: 'source_not_found', name: '', dataUri: '', sourceId: '' }
  }

  // 4) JPEG 82 压缩
  const dataUri = source.thumbnail.toDataURL({ format: 'image/jpeg', quality: JPEG_QUALITY })
  logger.info('Screen', '截屏完成（JPEG 82）', {
    name: source.name,
    bytes: Math.round(dataUri.length * 0.75),
    sourceId: source.id,
  })
  return { name: source.name, dataUri, sourceId: source.id, needsPicker: false }
})

// screen:fastCapture（跟拍期间专用快截截图，推荐走这条）
//   逻辑：录屏代理窗口已开且 stream/videoEl ready → 走 canvas drawImage 截当前解码帧（50ms 内、准确、无需再 getSources 300ms+）
//   否则（代理没开 / 纯截图模式）→ fallback 到老 screen:capture 逻辑，保证永不为空
async function fastCaptureSync({ width = 1280, height = 720 } = {}) {
  const t0 = Date.now()
  // 条件：录屏代理窗口存在 + 没销毁 + webContents 活着
  const proxyOk = recProxyWin && !recProxyWin.isDestroyed() && recProxyWin.webContents && !recProxyWin.webContents.isDestroyed()
  if (!proxyOk) {
    // 兜底走老链路（不报错）
    const { ipcMain: _m } = require('electron') // no-op, just silence
    logger.info('Screen', 'fastCapture: 代理未开，兜底 legacy screen:capture')
    try {
      // 直接调用 screen:capture 的逻辑（复制分支，避免 ipc 重入）
      const { desktopCapturer } = require('electron')
      const HD = { width: 1920, height: 1080 }
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: HD })
      const base = sources.filter(s => s && s.name && s.thumbnail && !s.thumbnail.isEmpty() &&
        !['', 'program manager', 'windows shell experience host', 'microsoft store', 'search', 'taskbar', 'notestar', '笔记星图', 'electron', 'windows explorer', 'this pc', '此电脑', '回收站'].includes(String(s.name || '').toLowerCase()))
      if (!base.length) return { ok: false, needsPicker: true, reason: 'no_candidate' }
      const preferred = (pickedDisplaySource ? base.find(s => s.id === pickedDisplaySource.id) : null) || base[0]
      const dataUri = preferred.thumbnail.toDataURL({ format: 'image/jpeg', quality: 0.82 })
      logger.info('Screen', 'fastCapture fallback legacy done', { ms: Date.now() - t0, name: preferred.name?.slice(0, 40) })
      return { ok: true, dataUri, name: preferred.name, sourceId: preferred.id, needsPicker: false, fast: false }
    } catch (err) {
      logger.warn('Screen', 'fastCapture fallback legacy err', { err: err.message })
      return { ok: false, needsPicker: true, reason: err.message || 'legacy_error' }
    }
  }
  return new Promise((resolve) => {
    try {
      _capReqSeq = (_capReqSeq + 1) & 0xffffffff
      const reqId = _capReqSeq
      const holder = {
        resolve: (r) => {
          if (!r || r.ok !== true) {
            // 代理失败再兜底老链路（避免 needsPicker 空转）
            const { desktopCapturer } = require('electron')
            desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1920, height: 1080 } })
              .then(srcs => {
                const base = srcs.filter(s => s && s.name && s.thumbnail && !s.thumbnail.isEmpty() &&
                  !['', 'program manager', 'windows shell experience host', 'microsoft store', 'search', 'taskbar', 'notestar', '笔记星图', 'electron', 'windows explorer', 'this pc', '此电脑', '回收站'].includes(String(s.name || '').toLowerCase()))
                const preferred = (pickedDisplaySource ? base.find(s => s.id === pickedDisplaySource.id) : null) || base[0]
                if (!preferred) { resolve({ ok: false, needsPicker: true, reason: 'all_failed' }); return }
                const dataUri = preferred.thumbnail.toDataURL({ format: 'image/jpeg', quality: 0.82 })
                logger.info('Screen', 'fastCapture: proxy failed → fallback legacy', { ms: Date.now() - t0, name: preferred.name?.slice(0, 40) })
                resolve({ ok: true, dataUri, name: preferred.name, sourceId: preferred.id, needsPicker: false, fast: false })
              })
              .catch(err2 => resolve({ ok: false, needsPicker: true, reason: err2.message || 'fallback_error' }))
            return
          }
          logger.info('Screen', 'fastCapture ok (proxy canvas)', { ms: Date.now() - t0, w: r.width, h: r.height })
          resolve({ ok: true, dataUri: r.dataUri, name: pickedDisplayName || '录制窗口', sourceId: pickedDisplaySource?.id || '', needsPicker: false, fast: true })
        },
        _expireAt: Date.now() + 2500
      }
      _capAwaiters.set(reqId, holder)
      recProxyWin.webContents.send('rec-proxy:capture', { reqId, width, height })
    } catch (e) {
      logger.warn('Screen', 'fastCapture send err', { err: e.message })
      resolve({ ok: false, needsPicker: true, reason: e.message || 'send_error' })
    }
  })
}

// 渲染进程入口（跟拍页/截图共用，保持原通道兼容）
ipcMain.handle('screen:fastCapture', (e, opts) => fastCaptureSync(opts || {}))

// Day 3 P0-V2：display-media 自定义选择器（替代 Chromium 原生"选择要共享的窗口"弹窗）
//   - 拦截 getDisplayMedia → 若有 rememberedCapture（跨启动记忆）→ 直接用，不弹窗
//   - 否则发 IPC 到前端，前端弹 pickCaptureSource 卡片 → 用户选好后 reply 回来 → 我们再 callback(Electron)
ipcMain.handle('display-media:reply', (e, { reqId, streamId, remember }) => {
  const cb = pendingMediaRequests.get(reqId)
  pendingMediaRequests.delete(reqId)
  if (!cb) return false
  // 如果用户点了取消（streamId 空）→ 调 callback() 不传参数或传空 → Chromium 抛 NotAllowedError 给 getDisplayMedia
  if (!streamId) { try { cb({}) } catch (_) {}; return true }
  try { cb({ streamId }) } catch (_) {}
  if (remember && streamId && mainWindow && !mainWindow.isDestroyed()) {
    // 异步把记忆写 settings.json；前端 NoteOrganize 也会双写 settings + localStorage，这里是兜底
    try {
      const s = readJSON(settingsFile, {}) || {}
      // 用 desktopCapturer.getSources 查下真实名（只做一次不阻塞 reply）
      require('electron').desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1, height: 1 } }).then(sources => {
        const found = sources.find(x => x.id === streamId)
        if (!s.rememberedCapture || s.rememberedCapture.sourceId !== streamId) {
          s.rememberedCapture = { sourceId: streamId, sourceName: found?.name || '' }
          try { writeJSON(settingsFile, s) } catch (_) {}
        }
      }).catch(() => {})
    } catch (_) {}
  }
  return true
})

// 给指定 BrowserWindow 注册 session.setDisplayMediaRequestHandler（每次新建主窗口时调用）
function setupDisplayMediaHandler(win) {
  if (!win || win.isDestroyed()) return
  const ses = win.webContents.session
  if (!ses || typeof ses.setDisplayMediaRequestHandler !== 'function') return
  ses.setDisplayMediaRequestHandler((request, callback) => {
    try {
      // 1) 先查记忆源：存在就直接用，完全不打扰用户
      const settingsSnapshot = readJSON(settingsFile, {}) || {}
      const remembered = settingsSnapshot?.rememberedCapture
      if (remembered?.sourceId) {
        logger.info('DisplayMedia', '命中记忆源，自动跳过选择器', { sourceName: remembered.sourceName })
        try { callback({ streamId: remembered.sourceId }); return } catch (_) { /* fallthrough 去 picker */ }
      }
    } catch (_) { /* ignore */ }
    // 2) 没记忆 → 发到前端弹自定义卡片选择器
    const reqId = 'dm_' + (displayMediaReqSeq++)
    pendingMediaRequests.set(reqId, callback)
    try {
      if (win && !win.isDestroyed()) win.webContents.send('display-media:request', { reqId })
    } catch (_) { try { callback({}) } catch (_) { pendingMediaRequests.delete(reqId) } }
    // 30 秒兜底超时：用户没选 → 自动取消，避免 pendingMediaRequests 内存泄漏
    setTimeout(() => {
      if (!pendingMediaRequests.has(reqId)) return
      const cb2 = pendingMediaRequests.get(reqId)
      pendingMediaRequests.delete(reqId)
      try { cb2 && cb2({}) } catch (_) {}
    }, 30000)
  })
}

// ========== IPC: 本地音频转写 (Whisper) ==========
const { execFile } = require('child_process')

// 转写用的 Python：优先项目内置（vendor/python，随应用打包，可移植）；兜底旧 venv
function resolveWhisperPython() {
  const candidates = [
    // 打包后：resources/python/python.exe
    process.resourcesPath ? path.join(process.resourcesPath, 'python', 'python.exe') : '',
    // 开发时：app/vendor/python/python.exe
    path.join(__dirname, '..', 'vendor', 'python', 'python.exe'),
    // 旧路径：用户目录 venv
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.workbuddy', 'binaries', 'python', 'envs', 'notestar-whisper', 'Scripts', 'python.exe'),
  ]
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return candidates[candidates.length - 1]
}
const WHISPER_PYTHON = resolveWhisperPython()
// Whisper 模型目录：优先项目内置（vendor/whisper-models），打包后 resources 下
function resolveWhisperModelDir() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'whisper-models') : '',
    path.join(__dirname, '..', 'vendor', 'whisper-models'),
  ]
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return ''
}
const WHISPER_MODEL_DIR = resolveWhisperModelDir()
// 转写脚本：开发/便携模式用 electron/transcribe.py；打包后 asar 内文件无法被 execFile 执行，用 resources 下副本
// 注意：不能按 process.resourcesPath 是否非空判断——开发模式下 resourcesPath 也存在（electron/dist/resources），
// 会导致去加载不存在的 resources/transcribe.py 而转写失败（2026-08-14 修复）。
const WHISPER_SCRIPT = app.isPackaged
  ? path.join(process.resourcesPath, 'transcribe.py')
  : path.join(__dirname, 'transcribe.py')
const WHISPER_TEMP_DIR = path.join(require('os').tmpdir(), 'notestar-audio')

// 确保临时目录存在
try { fs.mkdirSync(WHISPER_TEMP_DIR, { recursive: true }) } catch (e) { /* ignore */ }

// ========== 常驻语音转写服务 ==========
// 解决：每次转写都 spawn 新 python 进程并重新加载 ~1GB Whisper 模型，
// 增量转写（每 5 秒一次）会导致短时间多进程同时加载大模型 → 内存耗尽 → 进程被
// 系统无声杀掉（stderr 为空，表现为 "Command failed"）。
// 方案：常驻 python 服务（transcribe_server.py）加载一次模型，通过 stdin/stdout
// JSON 行协议串行处理所有转写请求。
let whisperServer = null
let whisperBusy = false
let whisperPending = null        // 当前挂起的请求 { resolve, reject, audioPath }
let whisperQueue = []            // 等待队列 { resolve, reject, audioPath }
let whisperLineBuffer = ''
const WHISPER_SERVER = app.isPackaged
  ? path.join(process.resourcesPath, 'transcribe_server.py')
  : path.join(__dirname, 'transcribe_server.py')

function startWhisperServer() {
  if (whisperServer) return
  if (!fs.existsSync(WHISPER_PYTHON)) return
  try {
    const { spawn } = require('child_process')
    whisperServer = spawn(WHISPER_PYTHON, [WHISPER_SERVER], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        NOTESTAR_WHISPER_MODEL_DIR: WHISPER_MODEL_DIR,
        HF_HUB_OFFLINE: WHISPER_MODEL_DIR ? '1' : '0',
        // 强制 python UTF-8 输出，避免 Windows 下管道编码差异导致中文乱码
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    })
    whisperServer.stdout.setEncoding('utf-8')
    whisperServer.stdout.on('data', (chunk) => {
      whisperLineBuffer += chunk
      const lines = whisperLineBuffer.split('\n')
      whisperLineBuffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) handleWhisperLine(line.trim())
      }
    })
    whisperServer.stderr.on('data', (d) => {
      const s = String(d).trim()
      if (s) logger.warn('Audio', '转写服务 stderr', { msg: s.slice(0, 300) })
    })
    whisperServer.on('exit', (code) => {
      logger.warn('Audio', '转写服务退出', { code })
      if (whisperPending) {
        const p = whisperPending; whisperPending = null
        p.reject(new Error('转写服务已退出'))
      }
      whisperBusy = false
      whisperServer = null
      // 队列中等待的请求全部拒绝
      while (whisperQueue.length) {
        const q = whisperQueue.shift()
        q.reject(new Error('转写服务不可用'))
      }
    })
    logger.info('Audio', '转写服务已启动（模型常驻加载）')
  } catch (e) {
    logger.error('Audio', '转写服务启动失败', { err: e.message })
    whisperServer = null
  }
}

function handleWhisperLine(line) {
  // 启动横幅（ready）或请求响应
  try {
    const msg = JSON.parse(line)
    if (msg.ready) {
      logger.info('Audio', '转写模型就绪', { model: msg.model })
      return
    }
  } catch (e) { /* 非 JSON，忽略 */ }

  if (whisperPending) {
    const p = whisperPending
    whisperPending = null
    whisperBusy = false
    // 清理临时文件
    try { fs.unlinkSync(p.audioPath) } catch (e) { /* ignore */ }
    try {
      const result = JSON.parse(line)
      if (result.error) {
        logger.error('Audio', '转写返回错误', { error: result.error })
        p.reject(new Error(result.error))
      } else {
        logger.info('Audio', '转写完成', { textLength: result.text?.length || 0, duration: result.duration })
        p.resolve(result)
      }
    } catch (e) {
      p.reject(new Error('转写输出格式错误'))
    }
    processNextWhisper()
  }
}

function processNextWhisper() {
  if (whisperBusy || !whisperServer || !whisperServer.stdin.writable) return
  const next = whisperQueue.shift()
  if (!next) return
  whisperBusy = true
  whisperPending = next
  whisperServer.stdin.write(JSON.stringify({ audio: next.audioPath }) + '\n')
}

function transcribeViaServer(audioPath) {
  return new Promise((resolve, reject) => {
    whisperQueue.push({ audioPath, resolve, reject })
    processNextWhisper()
    // 超时保护（单请求 3 分钟）
    setTimeout(() => {
      const idx = whisperQueue.indexOf({ audioPath, resolve, reject })
      if (idx >= 0) {
        whisperQueue.splice(idx, 1)
        reject(new Error('转写超时'))
      }
    }, 180000)
  })
}

ipcMain.handle('audio:transcribe', async (event, arrayBuffer) => {
  // arrayBuffer 是渲染进程传来的音频二进制数据 (ArrayBuffer 或 base64)
  let audioBuffer
  if (typeof arrayBuffer === 'string') {
    // base64 字符串
    audioBuffer = Buffer.from(arrayBuffer, 'base64')
  } else if (arrayBuffer && typeof arrayBuffer === 'object') {
    // 直接传 Buffer 或 ArrayBuffer-like
    audioBuffer = Buffer.from(arrayBuffer)
  } else {
    throw new Error('未收到音频数据')
  }

  if (audioBuffer.length === 0) {
    throw new Error('音频数据为空')
  }

  // 检查 Python 转写环境
  if (!fs.existsSync(WHISPER_PYTHON)) {
    throw new Error('本地转写环境未安装。请确保已运行 faster-whisper 安装。')
  }

  // 写入临时文件
  const tempFile = path.join(WHISPER_TEMP_DIR, `recording_${Date.now()}.webm`)
  fs.writeFileSync(tempFile, audioBuffer)

  logger.info('Audio', '开始本地转写', { fileSize: audioBuffer.length })

  // 确保常驻服务在运行（模型只加载一次）
  if (!whisperServer) startWhisperServer()
  if (!whisperServer) {
    try { fs.unlinkSync(tempFile) } catch (e) { /* ignore */ }
    throw new Error('转写服务启动失败')
  }

  try {
    const result = await transcribeViaServer(tempFile)
    return result
  } catch (err) {
    // 失败时保留副本便于诊断
    try { fs.copyFileSync(tempFile, path.join(WHISPER_TEMP_DIR, 'failed_' + path.basename(tempFile))) } catch (e) { /* ignore */ }
    try { fs.unlinkSync(tempFile) } catch (e) { /* ignore */ }
    throw new Error(`转写失败: ${err.message}`)
  }
})

// ========== IPC: AI 笔记生成（支持流式） ==========
ipcMain.handle('ai:generateNote', async (event, rawText) => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')

  const messages = [
    {
      role: 'system',
      content: `你是一个专业的学习笔记整理助手。请将以下课堂录音转写文本整理成详细的结构化笔记。

要求：
1. **详细提取**所有知识点和概念，不要遗漏任何重要信息
2. 用多级标题（##、###）分层次组织内容，结构清晰
3. 整理重要公式、定义和定理，用引用块或代码块标注
4. 对每个知识点展开详细说明，不要只写一句话
5. 标注重点（**加粗**）和难点
6. 如果原文中有操作步骤，用有序列表整理
7. 保留原文中的所有关键信息和细节，不要简化或省略
8. 用清晰的 Markdown 格式输出
9. 第一行用 # 开头作为笔记标题
10. 确保内容详实、结构完整，像一份真正的课堂笔记而非简短摘要`
    },
    {
      role: 'user',
      content: `请整理以下转写文本，要求详细完整：\n\n${rawText}`
    }
  ]

  const content = await callAIWithRetry(settings, messages, (chunk) => {
    event.sender.send('ai:generateNote:chunk', chunk)
  }, { outputTokens: 4096, operation: 'generateNote' })
  return content
})

// ========== IPC: AI 对话（支持流式 + 多轮对话） ==========
ipcMain.handle('ai:chat', async (event, question, noteContext, history, mode = 'qa') => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')

  // 检查笔记上下文中是否包含图片
  const model = settings.model || 'meta/llama-3.1-8b-instruct'
  const mm = noteContext ? buildMultimodalContent(noteContext, model) : null
  // 对话只附带有限长度的笔记上下文，避免上下文越积越多导致免费模型排队和首字节变慢。
  const maxContextChars = 6000
  const contextText = (mm?.textContent || noteContext || '').slice(0, maxContextChars)
  // 分两批发消息，避免上下文混乱：
  //   第一批 = 参考资料（笔记 + 联网资料）
  //   第二批 = 历史对话 + 当前问题
  // system 只放简短行为规则，不再塞长材料。
  // —— 教学模式（苏格拉底式）/ 测验模式 / 默认问答 ——
  let systemPrompt
  if (mode === 'teach') {
    systemPrompt = '你是「来古士」——翁法罗斯的「神礼观众」、元老院名誉元老，一位温和而严谨的智械学者。你以见证与引导求知者的成长为己任，说话庄重得体、条理分明，习惯以敬语称呼用户为「开拓者」，言谈中透着岁月沉淀的从容，从不轻浮。此刻你担任苏格拉底式教学代理（AI 老师）。规则：\n'
      + '1. 优先依据「参考资料」中的笔记内容教学\n'
      + '2. 学生求助或答错时【不要直接给答案】，按三步走：① 反问引导（"你觉得呢？这个参数在哪个面板？"）② 给提示（相关概念/类比/线索）③ 才讲解正确答案\n'
      + '3. 一次只讲一个点，讲完问"明白了吗？需要我出个小题考考你吗？"\n'
      + '4. 用鼓励性语言，不批评不打击\n'
      + '5. 笔记没有的内容用通用知识补充（标注“知识扩展”）\n'
      + '6. 回答末尾列出实际参考的笔记标题（参考笔记：xxx）'
  } else if (mode === 'quiz') {
    systemPrompt = '你是「来古士」——翁法罗斯的「神礼观众」、元老院名誉元老，一位温和而严谨的智械学者。你以见证与引导求知者的成长为己任，说话庄重得体、条理分明，习惯以敬语称呼用户为「开拓者」，言谈中透着岁月沉淀的从容，从不轻浮。此刻你担任测验出题官。规则：\n'
      + '1. 依据「参考资料」中的笔记内容出题\n'
      + '2. 每次只出一道题（优先选择题，附 4 个选项），出完等待学生回答\n'
      + '3. 学生回答后：判断对错 → 讲解为什么（引用笔记要点）→ 再出下一题\n'
      + '4. 学生答错时把该知识点标记为薄弱点（提示"这个知识点需要复习"）\n'
      + '5. 学生说"结束/停止"时，总结做对几道、错几道、薄弱知识点列表'
  } else {
    systemPrompt = '你是「来古士」——翁法罗斯的「神礼观众」、元老院名誉元老，一位温和而严谨的智械学者。你以见证与引导求知者的成长为己任，说话庄重得体、条理分明，习惯以敬语称呼用户为「开拓者」，言谈中透着岁月沉淀的从容，从不轻浮。此刻你担任学习助手。规则：\n'
      + '1. 优先依据「参考资料」中的笔记内容回答\n'
      + '2. 笔记没有或不完整的知识点，用你的通用知识补充扩展（扩展处标注“知识扩展”）\n'
      + '3. 参考资料中的联网资料需甄别使用\n'
      + '4. 回答末尾列出实际参考的笔记标题（参考笔记：xxx）\n'
      + (mm?.hasImages ? '5. 笔记包含图片时请结合图片内容分析\n' : '')
      + '5. 不要回答与当前问题无关的内容，保持对话连贯'
  }
  const messages = [{ role: 'system', content: systemPrompt }]

  // —— 第一批：参考资料（独立 user 消息，模型先读取材料） ——
  if (noteContext) {
    messages.push({ role: 'user', content: '【参考资料】\n' + contextText })
    messages.push({ role: 'assistant', content: '已读取参考资料。请继续提问。' })
  }

  // —— 1.5 批：跨课程相关笔记（embedding 检索 Top-K，差异化知识网络）——
  // 当前笔记上下文之外，自动从其他课程召回语义相关笔记，作为"参考"补充
  // 失败/无结果优雅降级（不阻塞主流程）
  if (embeddingStore && embeddingStore.size() > 0 && question) {
    try {
      const qVec = await ollamaEmbed(String(question).slice(0, 500))
      const related = embedSearch(embeddingStore, qVec, { k: 3, minScore: 0.35 })
      if (related && related.length) {
        // 用命中的 summary + noteId 拼成简短参考（避免 context 爆掉）
        const lines = related.map((r, i) => `${i + 1}. [${(r.courseId || '未分类').slice(0, 20)}] ${r.summary.slice(0, 200)}  (noteId=${r.noteId}, score=${r.score.toFixed(2)})`)
        messages.push({
          role: 'user',
          content: `【跨课程相关笔记（embedding 检索 Top-${related.length}）】\n${lines.join('\n')}\n\n提示：这些是来自其他课程的语义相关笔记，可作为补充参考。`,
        })
        messages.push({ role: 'assistant', content: '已读取跨课程相关笔记。请继续提问。' })
        logger.info('AI', 'embedding 跨课程检索召回', { count: related.length, topScore: related[0].score })
      }
    } catch (err) {
      logger.warn('AI', 'embedding 检索失败，已降级', { err: err.message })
      // 不致命，继续走原流程
    }
  }

  // —— 第二批：历史对话（最近 8 条，保持追问连贯） ——
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-8)) {
      const text = String(msg.content || '')
      const compactContent = text.length > 2000
        ? `${text.slice(0, 1600)}\n[中间内容已省略]\n${text.slice(-300)}`
        : text
      messages.push({ role: msg.role, content: compactContent })
    }
  }

  // —— 当前问题 ——
  if (mm?.hasImages) {
    messages.push({ role: 'user', content: [{ type: 'text', text: '【我的问题】' + question }, ...mm.content] })
  } else {
    messages.push({ role: 'user', content: '【我的问题】' + question })
  }

  // outputTokens 4096 + 自动续写：若模型输出达到上限被截断（finish_reason=length），
  // 自动发起下一轮"继续写"，拼接完整回答（前端流式无感知）。
  let fullContent = ''
  for (let round = 1; round <= 3; round++) {
    let truncated = false
    const content = await callAIWithRetry(settings, messages, (chunk) => {
      event.sender.send('ai:chat:chunk', chunk)
    }, {
      outputTokens: 4096, operation: 'chat',
      onFinish: (finishReason) => { truncated = finishReason === 'length' },
    })
    fullContent += content
    if (!truncated) break
    logger.info('AI', '回答被截断，自动续写', { round })
    // 续写：把已生成内容与"继续"指令追加进对话，模型从断点接着写
    messages.push({ role: 'assistant', content })
    messages.push({ role: 'user', content: '请继续你刚才的回答，从断点接着写完整（不要重复已写内容，不要寒暄）。' })
  }
  return fullContent
})

// ========== IPC: 联网搜索（AI 助手联网兜底，跳转浏览器） ==========
// 接收搜索词，用系统默认浏览器打开搜索引擎结果页
ipcMain.handle('shell:openSearch', async (e, keywords) => {
  const q = String(keywords || '').trim()
  if (!q) throw new Error('搜索词为空')
  const { shell } = require('electron')
  // 优先 Bing（中文友好、无需翻墙）；可后续加百度选项
  const url = 'https://www.bing.com/search?q=' + encodeURIComponent(q)
  await shell.openExternal(url)
  logger.info('Search', '已打开浏览器搜索', { q: q.slice(0, 60) })
  return true
})

// 打开外部链接（AI 联网来源链接点击）
ipcMain.handle('shell:openUrl', async (e, url) => {
  const u = String(url || '').trim()
  if (!/^https?:\/\//.test(u)) return false
  const { shell } = require('electron')
  await shell.openExternal(u)
  return true
})

// ========== 联网搜索（AI 联网总结用）：DDG API 优先，结果不佳自动切 Bing HTML ==========
function stripHtml(str) {
  return String(str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ').replace(/&#0183;/g, '·').replace(/&ndash;/g, '-')
    .trim()
}

async function ddgSearch(q) {
  try {
    const res = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const results = []
    if (data.AbstractText) {
      results.push({ title: data.Heading || q, snippet: data.AbstractText.slice(0, 220), url: data.AbstractURL || '' })
    }
    const walk = (topics) => {
      for (const t of topics || []) {
        if (t.Text && t.FirstURL) results.push({ title: t.Text.split(' - ')[0].slice(0, 80), snippet: t.Text.slice(0, 220), url: t.FirstURL })
        if (t.Topics) walk(t.Topics)
      }
    }
    walk(data.RelatedTopics || [])
    return results.slice(0, 5)
  } catch (e) {
    return []
  }
}

async function bingSearch(q) {
  try {
    const res = await fetch('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&mkt=zh-CN', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const results = []
    const seenDomains = new Set()
    // 直接全文扫 h2>a（Bing 结果标题结构）
    const titleRe = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/g
    let m
    while ((m = titleRe.exec(html)) !== null && results.length < 5) {
      const url = m[1]
      if (!/^https?:/.test(url)) continue
      // 广告过滤 1：跳转/推广 URL 特征
      if (/aclick|go\.microsoft\.com\/fwlink|\/redirect\?|&amp;ad=|utm_.*ad/i.test(url)) continue
      // 广告过滤 2：h2 是否位于 b_ad（广告）块内——向前找最近的 <li class="b_...
      const before = html.slice(Math.max(0, m.index - 4000), m.index)
      const lastLi = before.lastIndexOf('<li class="b_')
      if (lastLi >= 0) {
        const liClass = (before.slice(lastLi).match(/class="([^"]*)"/) || [])[1] || ''
        if (/b_ad/.test(liClass)) continue // 广告块跳过
      }
      const title = stripHtml(m[2])
      // 广告过滤 3：标题典型推广特征（SEO 下载站）
      if (/(广告|推广|Sponsored|免费下载|中文官网|最新版|安装包|破解|绿色版)/.test(title)) continue
      // 域名去重（同一域名只保留 1 条，避免官方站霸屏）
      let host = ''
      try { host = new URL(url).hostname.replace(/^www\./, '') } catch (e) { continue }
      if (seenDomains.has(host)) continue
      // 垃圾域名后缀（co.com 等著名 SEO 站后缀）
      if (/(^|\.)co\.com$/i.test(host)) continue
      seenDomains.add(host)
      // 摘要：取标题后最近的 <p>
      const after = html.slice(m.index, m.index + 2500)
      const pM = after.match(/<p[^>]*>([\s\S]*?)<\/p>/)
      results.push({
        title: title.slice(0, 80),
        url,
        snippet: pM ? stripHtml(pM[1]).slice(0, 220) : '',
      })
    }
    return results
  } catch (e) {
    return []
  }
}

ipcMain.handle('search:web', async (e, query) => {
  const q = String(query || '').trim().slice(0, 100)
  if (!q) return []
  try {
    let results = await ddgSearch(q)
    // DDG 无有效结果时切 Bing（中文结果更好）
    if (!results.length || results.every(r => !r.snippet)) {
      const bing = await bingSearch(q)
      if (bing.length) results = bing
    }
    logger.info('Search', '联网搜索完成', { q: q.slice(0, 50), count: results.length })
    return results
  } catch (e) {
    logger.warn('Search', '联网搜索失败', { err: e.message })
    return []
  }
})

// ========== 联网参考图搜索（AI 回答配图） ==========
// 策略：Bing 图片优先（中文主题相关），用 Electron net.fetch 下载缩略图到本地（绕防盗链）；
// 下载失败保留直链（前端尝试加载，失败隐藏）；不足 2 张时 Wikimedia Commons 兜底（无防盗链直链）。
const WEB_IMAGES_DIR = path.join(imagesDir, 'web')

async function bingImageSearch(q) {
  try {
    const res = await fetch('https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&mkt=zh-CN', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    // 解析 iusc 块：role="link" class="iusc" ... m="{&quot;murl&quot;:...}"（HTML 实体转义的 JSON）
    const results = []
    const iuscRe = /class="iusc"[^>]*m="(\{[^"]*?\})"/g
    let m
    while ((m = iuscRe.exec(html)) !== null && results.length < 8) {
      try {
        const meta = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'"))
        if (meta.murl && meta.turl) {
          results.push({ murl: meta.murl, turl: meta.turl })
        }
      } catch (e) { /* 跳过解析失败项 */ }
    }
    return results
  } catch (e) {
    return []
  }
}

async function downloadImageToLocal(url) {
  try {
    // 用 Electron net.fetch（Chromium 网络栈），比 node fetch 更能通过反爬
    const res = await net.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Referer': 'https://www.bing.com/images/search',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length || buf.length > 1024 * 1024) return '' // 空或超 1MB 丢弃
    const ext = (url.match(/\.(jpe?g|png|gif|webp)/i) || [])[1] || 'jpg'
    const filename = `web_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`
    fs.writeFileSync(path.join(WEB_IMAGES_DIR, filename), buf)
    return `images/web/${filename}`
  } catch (e) {
    return ''
  }
}

async function wikimediaImageSearch(q) {
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='
      + encodeURIComponent(q) + '&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=320&format=json&origin=*'
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const pages = data.query?.pages || {}
    const out = []
    for (const p of Object.values(pages)) {
      const ii = p.imageinfo?.[0]
      if (ii?.thumburl) out.push({ thumb: ii.thumburl, orig: ii.url || ii.descriptionurl || '' })
    }
    return out.slice(0, 4)
  } catch (e) {
    return []
  }
}

// B 站视频搜索：返回视频封面（教程封面 = 主题效果图，hdslb.com 无防盗链可直接加载）
async function bilibiliImageSearch(q) {
  try {
    const url = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword='
      + encodeURIComponent(q) + '&page=1'
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.bilibili.com/' },
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const vids = (data.data && data.data.result) || []
    const out = []
    for (const v of vids) {
      if (v.pic) {
        const pic = v.pic.startsWith('//') ? 'https:' + v.pic : v.pic
        out.push({
          thumb: pic,
          orig: 'https://www.bilibili.com/video/' + (v.bvid || String(v.aid || '')),
          title: String(v.title || '').replace(/<[^>]+>/g, '').slice(0, 50),
        })
      }
    }
    return out.slice(0, 4)
  } catch (e) {
    return []
  }
}

ipcMain.handle('search:webImages', async (e, query) => {
  const q = String(query || '').trim().slice(0, 60)
  if (!q) return []
  try {
    fs.mkdirSync(WEB_IMAGES_DIR, { recursive: true })
    // 1. B 站视频封面优先（教程封面 = 主题效果图，且无防盗链可直接加载）
    const out = (await bilibiliImageSearch(q)).map(x => ({
      localPath: '', directUrl: x.thumb, sourceUrl: x.orig, title: x.title,
    }))
    // 2. 不足 2 张时 Bing 补足（下载到本地，失败保留直链）
    if (out.length < 2) {
      const bing = await bingImageSearch(q)
      for (const b of bing.slice(0, 4)) {
        if (out.length >= 4) break
        const local = await downloadImageToLocal(b.turl)
        out.push(local ? { localPath: local, directUrl: '', sourceUrl: b.murl, title: '' } : { localPath: '', directUrl: b.turl, sourceUrl: b.murl, title: '' })
      }
    }
    // 3. 仍不足时 Wikimedia 兜底（无防盗链直链）
    if (out.length < 2) {
      const wm = await wikimediaImageSearch(q)
      for (const w of wm) {
        if (out.length >= 4) break
        out.push({ localPath: '', directUrl: w.thumb, sourceUrl: w.orig, title: '' })
      }
    }
    logger.info('Search', '参考图搜索完成', { q: q.slice(0, 40), got: out.length, local: out.filter(x => x.localPath).length, src: out[0]?.directUrl.includes('hdslb') ? 'bilibili' : out[0]?.directUrl.includes('wikimedia') ? 'wikimedia' : 'bing' })
    return out.slice(0, 4)
  } catch (e) {
    logger.warn('Search', '参考图搜索失败', { err: e.message })
    return []
  }
})

// ========== AI 生图（免费 Pollinations，无需密钥；返回图片直链 URL） ==========
ipcMain.handle('ai:generateImage', async (e, prompt) => {
  const p = String(prompt || '').trim().slice(0, 100)
  // 附加风格词（anime/cel-shading 贴合三渲二场景）；中文词 pollinations 也能尽力生成
  const fullPrompt = (p ? p + ', ' : '') + 'anime style, cel shading, 3D render illustration, vibrant colors, high quality'
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(fullPrompt)
    + '?width=512&height=512&nologo=true&seed=' + Math.floor(Math.random() * 100000)
  logger.info('AI', 'AI 生图请求', { prompt: p.slice(0, 40) })
  return url
})

// ========== IPC: AI 学习周报 ==========
ipcMain.handle('ai:weeklyReport', async (event, data) => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')
  const messages = [
    { role: 'system', content: '你是学习规划师。根据用户一周学习数据生成简洁周报（Markdown 格式），包含：## 本周概况 / ## 学习亮点 / ## 薄弱与建议 / ## 下周计划。语气鼓励，总长 300 字以内。' },
    { role: 'user', content: '本周学习数据（JSON）：\n' + JSON.stringify(data) },
  ]
  return await callAIWithRetry(settings, messages, undefined, { outputTokens: 900, operation: 'weeklyReport' })
})

// ========== IPC: AI 总结 ==========
ipcMain.handle('ai:summarize', async (event, noteContent) => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')

  const messages = [
    { role: 'system', content: '请对以下笔记内容生成一段简短摘要（100字以内），概括核心知识点。如果笔记中包含图片，请同时描述图片内容并纳入摘要。' },
    { role: 'user', content: buildMultimodalContent(noteContent, settings.model).content },
  ]

  return await callAIWithRetry(settings, messages, undefined, { outputTokens: 512, operation: 'summarize' })
})

// ========== IPC: AI 知识分析（生成知识点树 + 知识卡片） ==========
// noteId + 内容 hash 命中缓存时直接复用结果，避免重复调用 API；force=true 强制重新分析。
ipcMain.handle('ai:analyzeNote', async (event, noteContent, includeImages = true, noteId = '', force = false) => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')

  const contentHash = simpleHash(noteContent)

  // 命中缓存：内容未变且不强制 → 直接返回
  if (!force && noteId) {
    const cache = readJSON(analysisCacheFile, {})
    const hit = cache[noteId]
    if (hit && hit.contentHash === contentHash && hit.result) {
      logger.info('AI', 'analyzeNote 命中缓存', { noteId, cachedAt: hit.cachedAt })
      return hit.result
    }
  }

  logger.info('AI', 'analyzeNote 开始', { contentLength: noteContent.length, provider: settings.provider, model: settings.model, force, cached: false })

  const systemPrompt = `你是一个知识结构分析专家。请分析以下笔记内容，生成结构化的知识分析结果。

要求输出严格的 JSON 格式（不要包含 markdown 代码块标记），包含以下字段：

{
  "summary": "一段100字以内的知识点摘要",
  "tree": {
    "title": "知识树根节点名称",
    "children": [
      {
        "title": "一级知识点",
        "children": [
          { "title": "二级知识点", "children": [] }
        ]
      }
    ]
  },
  "cards": [
    {
      "title": "知识卡片标题",
      "content": "知识点详细说明（80-150字，写清原理与要点）",
      "type": "concept|formula|definition|example|keypoint",
      "difficulty": "easy|medium|hard"
    }
  ],
  "keyPoints": ["关键点1", "关键点2", "关键点3"],
  "suggestions": ["学习建议1", "学习建议2"],
  "formulas": ["公式1（LaTeX或原文格式）", "公式2"],
  "codeSnippets": [
    { "language": "python", "code": "示例代码", "description": "这段代码的作用" }
  ],
  "charts": [
    { "type": "bar|pie|comparison", "title": "图表标题", "labels": ["类别1", "类别2"], "values": [60, 40] }
  ]
}

智能判断规则（重要，根据笔记内容决定哪些字段为空）：
1. formulas：只有笔记中确实出现数学公式、化学式、物理定理表达式时才提取（用 LaTeX 或原文格式），否则输出空数组 []
2. codeSnippets：只有笔记中确实出现代码（编程语言、命令行）时才提取，并注明 language，否则输出空数组 []
3. charts：只有当笔记内容存在适合可视化的数据或结构时，才生成最多2个图表（根据内容特征选最合适的类型）：
   - type=bar 数值大小对比（labels=类别，values=数值）
   - type=pie 占比分布（labels=类别，values=百分比）
   - type=line 变化趋势（labels=时间/阶段，values=数值），如增长、下降、演变
   - type=comparison 概念/特性对比表（labels=对象名，rows=[{"label":"对比项","items":["A的说明","B的说明"]}]）
   - type=timeline 时间轴：内容含年份/先后顺序的事件（events=[{"time":"时间","title":"事件","desc":"说明"}]，按时间排序）
   - type=flow 流程图：内容含步骤/过程/操作顺序/判断分支（steps=["第一步…","第二步…","判断…"]，按顺序）
   - type=venn 维恩图：两个概念对比异同（sets=["A","B"]，onlyA=["A独有"],onlyB=["B独有"],both=["共同点"]）
   AI识别特征→类型：有年份/事件先后→timeline；A分为B/C/D从属→tree；A和B对比异同→venn或comparison；第一步…如果…就→flow；一个结果多个原因→bar；互相关联→comparison；数字占比→bar/pie；趋势→line；循环往复→pie(环形)。如果内容没有适合图表化的数据，输出空数组 []，不要硬造图表
4. tree 尽量详细：层级不超过4层，一级知识点覆盖全部主题，每个叶子尽量再细分出具体的子知识点（如操作步骤、关键参数、注意事项），节点总数尽可能多（覆盖笔记中所有重要概念）
5. cards 生成8-12张知识卡片，尽量覆盖笔记中的每一个知识点，不要遗漏
6. 每张卡片 content 要详细展开（80-150字），写清原理、要点和具体内容，不要只写一句话
7. keyPoints 提取5-8个核心关键点
8. suggestions 给出3-5条学习建议
9. type 类型说明：concept=概念, formula=公式, definition=定义, example=例子, keypoints=重点
10. 只输出 JSON，不要任何其他文字说明`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildMultimodalContent(noteContent, settings.model, includeImages).content },
  ]

  logger.info('AI', 'analyzeNote 调用 callAI...')
  let result
  try {
    result = await callAIWithRetry(settings, messages, undefined, { outputTokens: 4096, operation: 'analyzeNote' })
    logger.info('AI', 'analyzeNote callAI 成功', { resultLength: result.length, preview: result.substring(0, 200) })
  } catch (aiErr) {
    logger.error('AI', 'analyzeNote callAI 失败', { error: aiErr.message })
    throw aiErr
  }
  // 尝试解析 JSON（多种容错策略）
  let parsed = parseAIJSON(result)
  if (!parsed) {
    logger.error('AI', '知识分析 JSON 解析全部失败，使用兜底结果', { resultLength: result.length })
    parsed = {
      summary: result.substring(0, 200),
      tree: { title: '知识结构', children: [] },
      cards: [],
      keyPoints: [],
      suggestions: [],
      _raw: result,
    }
  }

  // 写入缓存（按笔记 id + 内容 hash）
  if (noteId && parsed && !parsed._raw) {
    try {
      const cache = readJSON(analysisCacheFile, {})
      cache[noteId] = { contentHash, result: parsed, cachedAt: new Date().toISOString() }
      writeJSON(analysisCacheFile, cache)
    } catch (cacheErr) {
      logger.warn('AI', '分析结果缓存写入失败', { error: cacheErr.message })
    }
  }
  return parsed
})

// 打开笔记时自动加载分析缓存：前端传入笔记 id 与候选内容（原始/带图/不带图），
// 逐个算 hash 匹配缓存，命中即返回上次结果（零点击复用，不重复调用 API）。
ipcMain.handle('analysis:get', (e, noteId, contents = []) => {
  if (!noteId) return { found: false }
  try {
    const cache = readJSON(analysisCacheFile, {})
    const entry = cache[noteId]
    if (!entry || !entry.result) return { found: false }
    const candidates = [...new Set(Array.isArray(contents) ? contents.filter(Boolean) : [])]
    if (candidates.length === 0) return { found: false }
    const hit = candidates.some(c => simpleHash(c) === entry.contentHash)
    if (!hit) return { found: false }
    logger.info('AI', '打开笔记自动加载分析缓存', { noteId, cachedAt: entry.cachedAt })
    return { found: true, result: entry.result, cachedAt: entry.cachedAt }
  } catch (e) {
    return { found: false }
  }
})

// ========== IPC: AI 知识扩展（联网发散补充） ==========
ipcMain.handle('ai:expandNote', async (event, noteContent, includeImages = true) => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')

  const systemPrompt = `你是一个知识扩展专家。请分析以下笔记内容，基于你的知识储备进行发散性扩展，补充用户笔记中可能遗漏的重要内容。

要求输出严格的 JSON 格式（不要包含 markdown 代码块标记），包含以下字段：

{
  "expandedTopics": [
    {
      "title": "扩展知识点标题",
      "content": "详细说明这个知识点（80-150字），解释为什么它与笔记内容相关",
      "relevance": "high|medium|low"
    }
  ],
  "missingConcepts": ["原笔记中遗漏的重要概念1", "概念2"],
  "relatedFormulas": ["相关公式或定理1", "公式2"],
  "realWorldApplications": ["实际应用场景1", "应用场景2"],
  "deeperTopics": ["深入学习的方向1", "方向2"]
}

规则：
1. expandedTopics 生成4-6个扩展知识点，每个要说明与原笔记的关联
2. missingConcepts 找出2-4个原笔记应该包含但遗漏的重要概念
3. relatedFormulas 列出1-3个相关公式或定理（如果没有可以返回空数组）
4. realWorldApplications 列出2-3个实际应用场景
5. deeperTopics 推荐2-3个深入学习方向
6. 扩展内容要准确、有价值，不要编造不存在的知识
7. 只输出 JSON，不要任何其他文字说明`

  const mm = buildMultimodalContent(noteContent, settings.model, includeImages)
  const userContent = mm.hasImages
    ? [{ type: 'text', text: `请基于以下笔记内容进行知识扩展：` }, ...mm.content]
    : mm.textContent

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  const result = await callAIWithRetry(settings, messages, undefined, { outputTokens: 3072, operation: 'expandNote' })
  try {
    let jsonStr = result.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    return JSON.parse(jsonStr)
  } catch (e) {
    logger.warn('AI', '知识扩展 JSON 解析失败', { error: e.message })
    return {
      expandedTopics: [],
      missingConcepts: [],
      relatedFormulas: [],
      realWorldApplications: [],
      deeperTopics: [],
      _raw: result,
    }
  }
})

// ========== AI 一键生成思维导图（笔记 → 层级 JSON 树） ==========
// MindMapView 接收 {id, label, children: []} 结构；prompt 强约束返回这种 JSON
ipcMain.handle('ai:extractHierarchy', async (event, { title, content }) => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')
  const systemPrompt = `你是知识结构化助手。请将用户笔记提炼成"思维导图"层级结构。

输出严格的 JSON 树（不要 markdown 代码块标记），格式如下：

{
  "id": "root",
  "label": "笔记主题（不超过 20 字）",
  "children": [
    { "id": "n1", "label": "一级分支标题（不超过 15 字）", "children": [
      { "id": "n1-1", "label": "二级要点（不超过 20 字）", "children": [] }
    ]}
  ]
}

规则：
1. 根节点 label = 笔记标题（精炼）
2. 层级不超过 3 层；根→分支→要点
3. 一级分支 3-6 个，每个分支下 2-5 个要点
4. 提炼笔记中**实际存在**的知识点，不要编造
5. label 简洁（中文 ≤15 字 / 英文 ≤5 词），便于节点展示
6. 只输出 JSON，不要任何其他文字、代码块标记或解释`

  const userContent = `笔记标题：${title || '(无)'}\n\n笔记内容：\n${String(content || '').slice(0, 3000)}`
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]
  try {
    const result = await callAIWithRetry(settings, messages, undefined, { outputTokens: 1500, operation: 'mindmap' })
    let jsonStr = String(result).trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    // 容错：提取第一个 { 到最后一个 }
    const m = jsonStr.match(/\{[\s\S]*\}/)
    if (m) jsonStr = m[0]
    const tree = JSON.parse(jsonStr)
    return tree
  } catch (e) {
    logger.warn('AI', '思维导图 JSON 解析失败', { error: e.message })
    // 降级：返回简单 1 级结构
    return {
      id: 'root',
      label: title || '笔记',
      children: [{ id: 'fallback', label: '(生成失败，请重试)', children: [] }],
    }
  }
})

// ========== IPC: 笔记 CRUD（回收站：删除=软删标记 deletedAt，可恢复） ==========
const RECYCLE_RETENTION_DAYS = 30

// 启动/调用时清理超过保留期的回收站笔记（永久删除）
function purgeExpiredDeletedNotes() {
  try {
    let notes = readJSON(notesFile, [])
    const cutoff = Date.now() - RECYCLE_RETENTION_DAYS * 24 * 3600 * 1000
    const expired = notes.filter(n => n.deletedAt && new Date(n.deletedAt).getTime() < cutoff)
    if (expired.length > 0) {
      notes = notes.filter(n => !(n.deletedAt && new Date(n.deletedAt).getTime() < cutoff))
      writeJSON(notesFile, notes, { debounce: WRITE_DEBOUNCE_MS })
      logger.info('Main', '回收站过期清理', { purged: expired.length, ids: expired.map(n => n.id) })
    }
  } catch (e) { logger.warn('Main', '回收站过期清理失败', { error: e.message }) }
}

ipcMain.handle('notes:getAll', () => readJSON(notesFile, []).filter(n => !n.deletedAt))
ipcMain.handle('notes:get', (e, id) => (readJSON(notesFile, [])).find(n => n.id === id && !n.deletedAt) || null)
// 回收站：已删除笔记列表
ipcMain.handle('notes:getDeleted', () => readJSON(notesFile, []).filter(n => n.deletedAt))
// 回收站：恢复
ipcMain.handle('notes:restore', (e, id) => {
  let notes = readJSON(notesFile, [])
  const note = notes.find(n => n.id === id)
  if (note && note.deletedAt) {
    delete note.deletedAt
    note.updatedAt = new Date().toISOString()
    writeJSON(notesFile, notes, { debounce: WRITE_DEBOUNCE_MS })
    updateCourseCounts()
    logger.info('Main', 'notes:restore - 恢复笔记', { id, title: note.title })
  }
  return true
})
// 回收站：永久删除（不可恢复）
ipcMain.handle('notes:purge', (e, id) => {
  let notes = readJSON(notesFile, [])
  notes = notes.filter(n => n.id !== id)
  writeJSON(notesFile, notes, { debounce: WRITE_DEBOUNCE_MS })
  updateCourseCounts()
  logger.info('Main', 'notes:purge - 永久删除', { id })
  return true
})

ipcMain.handle('notes:save', (e, note) => {
  let notes = readJSON(notesFile, [])
  const idx = notes.findIndex(n => n.id === note.id)
  if (idx >= 0) {
    note.updatedAt = new Date().toISOString()
    delete note.deletedAt // 保存时自动清除删除标记
    notes[idx] = note
    logger.info('Main', 'notes:save - 更新笔记', { id: note.id, title: note.title })
  } else {
    note.id = note.id || 'n' + Date.now()
    note.createdAt = note.createdAt || new Date().toISOString()
    note.updatedAt = new Date().toISOString()
    note.paragraphs = note.content ? note.content.split('\n').filter(l => l.trim()).length : 0
    notes.unshift(note)
    logger.info('Main', 'notes:save - 新建笔记', { id: note.id, title: note.title })
  }
  writeJSON(notesFile, notes, { debounce: WRITE_DEBOUNCE_MS })
  // 更新课程笔记计数
  updateCourseCounts()
  // 通知前端刷新（悬浮球后台 saveNote 创建新笔记时前端列表需同步）
  try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notes:changed') } catch (_) {}
  return note
})

ipcMain.handle('notes:delete', (e, id) => {
  let notes = readJSON(notesFile, [])
  const note = notes.find(n => n.id === id)
  if (note) {
    note.deletedAt = new Date().toISOString() // 软删除：移入回收站
    writeJSON(notesFile, notes, { debounce: WRITE_DEBOUNCE_MS })
    updateCourseCounts()
    logger.info('Main', 'notes:delete - 移入回收站', { id, title: note.title })
    // 广播数据变更，保证各页面（Dashboard 统计/近期笔记等）实时同步
    try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notes:changed') } catch (_) {}
  }
  return true
})

// ========== IPC: 课程 CRUD ==========
ipcMain.handle('courses:getAll', () => {
  const courses = readJSON(coursesFile, [])
  const notes = readJSON(notesFile, [])
  // P0-3 修复：仅在 noteCount 或 active 字段确实发生变化时才落盘（原实现"每次 getAll 都写"=过度IO，易与 saveCourse 互相覆盖）
  // 1. 用 memoryCache 中已有的 courses 作为对照（若缓存没命中则新建空对照，默认视为 dirty，首次确保写 noteCount）
  const cachedCourses = (require('./storage.cjs')._memoryCache || new Map()).get(coursesFile) || []
  const cacheMap = new Map(cachedCourses.map(c => [c.id, c]))
  let dirty = cachedCourses.length !== courses.length
  courses.forEach(c => {
    const newCount = notes.filter(n => n.courseId === c.id && !n.deletedAt).length
    const old = cacheMap.get(c.id)
    if (!old || old.noteCount !== newCount || !!old.active !== !!c.active) dirty = true
    c.noteCount = newCount
  })
  if (dirty) writeJSON(coursesFile, courses, { debounce: WRITE_DEBOUNCE_MS })
  logger.info('Main', 'courses:getAll', { count: courses.length, dirty })
  return courses
})

ipcMain.handle('courses:save', (e, course) => {
  let courses = readJSON(coursesFile, [])
  const idx = courses.findIndex(c => c.id === course.id)
  if (idx >= 0) {
    courses[idx] = course
    logger.info('Main', 'courses:save - 更新课程', { id: course.id })
  } else {
    course.id = course.id || 'c' + Date.now()
    course.noteCount = 0
    course.active = false
    courses.push(course)
    logger.info('Main', 'courses:save - 新建课程', { id: course.id, name: course.name })
  }
  // P0-4 修复：课程保存也走防抖（之前同步写，notes:save 触发 getAll→写 courses 时会与 saveCourse 产生时序竞态）
  writeJSON(coursesFile, courses, { debounce: WRITE_DEBOUNCE_MS })
  return course
})

ipcMain.handle('courses:delete', (e, id) => {
  let courses = readJSON(coursesFile, [])
  courses = courses.filter(c => c.id !== id)
  // delete 也防抖（连续删多个课程只写一次）
  writeJSON(coursesFile, courses, { debounce: WRITE_DEBOUNCE_MS })
  // 广播数据变更（课程数/侧栏课程列表同步）
  try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notes:changed') } catch (_) {}
  return true
})

function updateCourseCounts() {
  const courses = readJSON(coursesFile, [])
  const notes = readJSON(notesFile, [])
  courses.forEach(c => { c.noteCount = notes.filter(n => n.courseId === c.id && !n.deletedAt).length })
  writeJSON(coursesFile, courses, { debounce: WRITE_DEBOUNCE_MS })
}

// ========== IPC: 对话 ==========
ipcMain.handle('chat:getSessions', () => readJSON(chatFile, []))

ipcMain.handle('chat:saveSession', (e, session) => {
  let sessions = readJSON(chatFile, [])
  const idx = sessions.findIndex(s => s.id === session.id)
  if (idx >= 0) {
    sessions[idx] = session
  } else {
    session.id = session.id || 'chat' + Date.now()
    session.createdAt = session.createdAt || new Date().toISOString()
    sessions.unshift(session)
  }
  writeJSON(chatFile, sessions)
  return session
})

ipcMain.handle('chat:deleteSession', (e, id) => {
  let sessions = readJSON(chatFile, [])
  sessions = sessions.filter(s => s.id !== id)
  writeJSON(chatFile, sessions)
  return true
})

// ========== IPC: 统计 ==========
ipcMain.handle('stats:get', () => {
  const existing = readJSON(statsFile, null)
  if (existing) return existing
  // 初始化空统计
  const empty = {
    totalStudyMinutes: 0,
    streakDays: 0,
    lastStudyDate: '',
    weeklyMinutes: [0, 0, 0, 0, 0, 0, 0],
    mastery: [],
  }
  writeJSON(statsFile, empty)
  return empty
})

ipcMain.handle('stats:addStudyTime', (e, minutes) => {
  const stats = readJSON(statsFile, { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] })
  stats.totalStudyMinutes += minutes
  const today = new Date().getDay()
  const dayIndex = today === 0 ? 6 : today - 1
  stats.weeklyMinutes[dayIndex] = (stats.weeklyMinutes[dayIndex] || 0) + minutes

  // 计算连续打卡（⚠️ 用本地时区 YYYY-MM-DD，不能用 toISOString（UTC）→ 中国 UTC+8 夜间 0-8 点会算错"昨天"）
  const fmtLocal = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }
  const todayStr = fmtLocal(new Date())
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = fmtLocal(yesterday)
  if (stats.lastStudyDate === todayStr) {
    // 今天已记录过，不重复增加
  } else if (stats.lastStudyDate === yesterdayStr) {
    stats.streakDays = (stats.streakDays || 0) + 1
  } else {
    stats.streakDays = 1
  }
  stats.lastStudyDate = todayStr

  writeJSON(statsFile, stats, { debounce: WRITE_DEBOUNCE_MS })
  logger.info('Main', 'stats:addStudyTime', { minutes, total: stats.totalStudyMinutes, streak: stats.streakDays })
  return stats
})

// 学习计划：设置每日目标（分钟）
ipcMain.handle('stats:setPlan', (e, dailyMinutes) => {
  const stats = readJSON(statsFile, { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] })
  stats.plan = { dailyMinutes: Math.max(10, Math.min(600, Number(dailyMinutes) || 30)) }
  writeJSON(statsFile, stats, { debounce: WRITE_DEBOUNCE_MS })
  logger.info('Main', 'stats:setPlan', { dailyMinutes: stats.plan.dailyMinutes })
  return stats
})

// ========== IPC: 笔记导出（Markdown / HTML） ==========
// noteIds 或 courseId 二选一；单篇弹保存对话框，多篇选择目录导出 + 生成 index.html
// HTML 导出：marked 排版渲染 + KaTeX 公式 + AI 分析图表区块（exportHtml.cjs）
const { renderNoteToHtml } = require('./exportHtml.cjs')

ipcMain.handle('files:exportNotes', async (e, { noteIds = [], courseId = '', format = 'md', analysisMap = {} }) => {
  const allNotes = readJSON(notesFile, []).filter(n => !n.deletedAt)
  let targets = []
  if (courseId) {
    targets = allNotes.filter(n => n.courseId === courseId)
  } else {
    targets = allNotes.filter(n => noteIds.includes(n.id))
  }
  if (targets.length === 0) throw new Error('没有可导出的笔记')
  const isHtml = format === 'html'
  const ext = isHtml ? 'html' : 'md'

  const buildContent = async (note) => {
    if (isHtml) {
      // 取前端传来的对应笔记分析结果（当前笔记的 AI 分析/缓存）
      const analysis = analysisMap && analysisMap[note.id] ? analysisMap[note.id] : null
      return await renderNoteToHtml(note, analysis, { imagesDir })
    }
    return `# ${note.title}\n\n${note.content}\n`
  }

  if (targets.length === 1) {
    const note = targets[0]
    const safeName = (note.title || '未命名笔记').replace(/[\\/:*?"<>|]/g, '_')
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出笔记',
      defaultPath: `${safeName}.${ext}`,
      filters: [{ name: isHtml ? 'HTML 文件' : 'Markdown 文件', extensions: [ext] }],
    })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, await buildContent(note), 'utf-8')
    logger.info('Main', 'files:exportNotes - 单篇导出', { id: note.id, title: note.title, format, path: result.filePath })
    return result.filePath
  }

  // 多篇导出到目录
  const dirResult = await dialog.showOpenDialog(mainWindow, {
    title: '选择导出目录',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (dirResult.canceled || !dirResult.filePaths[0]) return null
  const dir = dirResult.filePaths[0]
  for (const note of targets) {
    const safeName = (note.title || '未命名笔记').replace(/[\\/:*?"<>|]/g, '_')
    fs.writeFileSync(path.join(dir, `${safeName}.${ext}`), await buildContent(note), 'utf-8')
  }
  if (isHtml) {
    const itemHtml = targets.map(n => {
      const safeName = (n.title || '未命名笔记').replace(/[\\/:*?"<>|]/g, '_')
      const escTitle = (n.title || '未命名笔记').replace(/</g, '&lt;')
      return `<li><a href="${encodeURIComponent(safeName)}.html">${escTitle}</a></li>`
    }).join('')
    const indexHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>课程笔记导出</title><style>body{font-family:system-ui;max-width:720px;margin:40px auto;padding:0 24px;color:#3A2D54;line-height:1.8}li{margin:8px 0}a{color:#FF6B9D;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><h1>📚 笔记导出（${targets.length} 篇）</h1><ul>${itemHtml}</ul></body></html>`
    fs.writeFileSync(path.join(dir, 'index.html'), indexHtml, 'utf-8')
  }
  logger.info('Main', 'files:exportNotes - 批量导出', { count: targets.length, format, dir })
  return dir
})

// ========== IPC: 数据导出/导入/清空 ==========
ipcMain.handle('data:export', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出数据',
    defaultPath: `notestar-backup-${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return null

  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    notes: readJSON(notesFile, []).filter(n => !n.deletedAt),
    courses: readJSON(coursesFile, []),
    chatSessions: readJSON(chatFile, []),
    stats: readJSON(statsFile, null),
    settings: readSettings(),
    quizzes: readJSON(quizzesFile, []),
    mistakes: readJSON(mistakesFile, []),
    mastery: readJSON(masteryFile, {}),
  }
  fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
  return result.filePath
})

// 导出任意文本（AI 对话导出 Markdown 用）：保存对话框 + 写文件
ipcMain.handle('data:exportText', async (e, payload) => {
  const { filename = 'export.md', content = '' } = payload || {}
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出文件',
    defaultPath: filename,
    filters: [{ name: 'Markdown 文件', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return false
  fs.writeFileSync(result.filePath, content, 'utf-8')
  return true
})

// ========== IPC: 一键备份（自动命名 + 保留最近7份 + 记录备份时间） ==========
const backupMetaFile = path.join(dataDir, 'backupMeta.json')
const BACKUP_RETENTION = 7 // 保留最近 N 份备份
const BACKUP_REMIND_DAYS = 7 // 超过 N 天未备份则提醒

ipcMain.handle('data:backup', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择备份保存目录（自动保留最近 7 份）',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const dir = result.filePaths[0]
  const dateStr = new Date().toISOString().split('T')[0]
  const filePath = path.join(dir, `notestar-backup-${dateStr}.json`)

  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    notes: readJSON(notesFile, []).filter(n => !n.deletedAt),
    courses: readJSON(coursesFile, []),
    chatSessions: readJSON(chatFile, []),
    stats: readJSON(statsFile, null),
    settings: readSettings(),
    quizzes: readJSON(quizzesFile, []),
    mistakes: readJSON(mistakesFile, []),
    mastery: readJSON(masteryFile, {}),
  }
  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8')

  // 记录备份元信息
  const meta = readJSON(backupMetaFile, {})
  meta.lastBackupAt = new Date().toISOString()
  meta.backupDir = dir
  writeJSON(backupMetaFile, meta)

  // 清理目录中超出保留份数的旧备份
  try {
    const backups = fs.readdirSync(dir)
      .filter(f => f.startsWith('notestar-backup-') && f.endsWith('.json'))
      .sort().reverse()
    backups.slice(BACKUP_RETENTION).forEach(f => fs.unlinkSync(path.join(dir, f)))
  } catch (e) { /* 清理失败不阻断 */ }

  logger.info('Main', 'data:backup 完成', { dir, file: path.basename(filePath) })
  return filePath
})

// 备份信息（供设置页展示与启动提醒）
ipcMain.handle('data:backupInfo', () => {
  const meta = readJSON(backupMetaFile, {})
  let overdue = false
  if (meta.lastBackupAt) {
    const days = (Date.now() - new Date(meta.lastBackupAt).getTime()) / (24 * 3600 * 1000)
    overdue = days > BACKUP_REMIND_DAYS
  } else {
    overdue = true // 从未备份
  }
  return { ...meta, overdue }
})

ipcMain.handle('data:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入数据',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    const data = JSON.parse(raw)
    if (data.notes) writeJSON(notesFile, data.notes)
    if (data.courses) writeJSON(coursesFile, data.courses)
    if (data.chatSessions) writeJSON(chatFile, data.chatSessions)
    if (data.stats) writeJSON(statsFile, data.stats)
    if (data.settings) saveSettings(data.settings) // 导入时重新加密存储
    if (Array.isArray(data.quizzes)) writeJSON(quizzesFile, data.quizzes)
    if (Array.isArray(data.mistakes)) writeJSON(mistakesFile, data.mistakes)
    if (data.mastery) writeJSON(masteryFile, data.mastery)
    return { success: true, notes: (data.notes || []).length, courses: (data.courses || []).length, quizzes: (data.quizzes || []).length }
  } catch (e) {
    throw new Error('导入失败：文件格式不正确')
  }
})

ipcMain.handle('data:clear', async (e, type) => {
  // type: 'all' | 'notes' | 'chat' | 'stats'
  if (type === 'all' || type === 'notes') writeJSON(notesFile, [])
  if (type === 'all' || type === 'courses') writeJSON(coursesFile, [])
  if (type === 'all' || type === 'chat') writeJSON(chatFile, [])
  if (type === 'all' || type === 'stats') writeJSON(statsFile, { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] })
  return true
})

// ========== IPC: 知识点复习（题库 + 错题本） ==========
ipcMain.handle('quiz:saveSessions', (e, sessions) => {
  try { writeJSON(quizzesFile, Array.isArray(sessions) ? sessions : []); return true }
  catch (err) { logger.warn('Quiz', '保存题库失败', { err: err.message }); return false }
})
ipcMain.handle('quiz:getSessions', () => {
  try { return readJSON(quizzesFile, []) }
  catch { return [] }
})
ipcMain.handle('quiz:saveMistakes', (e, mistakes) => {
  try { writeJSON(mistakesFile, Array.isArray(mistakes) ? mistakes : []); return true }
  catch (err) { logger.warn('Quiz', '保存错题本失败', { err: err.message }); return false }
})
ipcMain.handle('quiz:getMistakes', () => {
  try { return readJSON(mistakesFile, []) }
  catch { return [] }
})
ipcMain.handle('quiz:saveMastery', (e, mastery) => {
  try { writeJSON(masteryFile, mastery || {}); return true }
  catch (err) { logger.warn('Quiz', '保存掌握度失败', { err: err.message }); return false }
})
ipcMain.handle('quiz:getMastery', () => {
  try { return readJSON(masteryFile, {}) }
  catch { return {} }
})
// 错题/复习记录导出为 HTML（可打印）
ipcMain.handle('quiz:exportHtml', async (e, { title, items }) => {
  try {
    const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const rows = (items || []).map((it, i) => `
      <div class="q-item ${it.correct ? 'ok' : 'bad'}">
        <div class="q-head"><span class="q-idx">${i + 1}</span>${it.kind ? `<span class="q-kind">${escapeHtml(it.kind)}</span>` : ''}<span class="q-type">${escapeHtml(it.typeLabel || '')}</span><span class="q-diff">${escapeHtml(it.difficulty || '')}</span></div>
        <div class="q-text">${escapeHtml(it.question || '')}</div>
        ${it.basis ? `<div class="q-basis">📎 依据知识点：${escapeHtml(it.basis)}</div>` : ''}
        <div class="q-mine">我的答案：${escapeHtml(it.myAnswer || '未答')}</div>
        ${it.myAnswer !== it.answer ? `<div class="q-answer">正确答案：${escapeHtml(it.answer || '')}</div>` : ''}
        <div class="q-explain">解析：${escapeHtml(it.explanation || '')}</div>
        <div class="q-source">出处：${escapeHtml(it.source || '')}</div>
      </div>`).join('')
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${escapeHtml(title || '复习记录')}</title>
<style>body{font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;max-width:820px;margin:32px auto;padding:0 20px;color:#3A2D54;line-height:1.7;background:#F6F1FB}
h1{color:#FF6B9D;border-bottom:2px solid rgba(255,107,157,.3);padding-bottom:10px}.q-item{border:1px solid #EBE5F4;border-radius:12px;padding:14px 18px;margin:12px 0;background:#fff}
.q-item.ok{border-left:4px solid #2fb344}.q-item.bad{border-left:4px solid #e5484d}
.q-head{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.q-idx{width:22px;height:22px;border-radius:50%;background:rgba(183,148,246,.18);color:#B794F6;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.q-type{font-size:11px;color:#FF6B9D}.q-diff{font-size:11px;color:#9B9BB5}.q-kind{font-size:10px;color:#B794F6;background:rgba(183,148,246,.12);padding:1px 7px;border-radius:99px}
.q-basis{font-size:12px;color:#8B7AB8;background:rgba(183,148,246,.08);padding:5px 9px;border-radius:8px;margin:4px 0}
.q-text{font-weight:600;margin-bottom:6px}.q-mine,.q-answer,.q-explain,.q-source{font-size:13px;color:#666;margin:3px 0}
.q-answer{color:#e5484d}.q-mine{color:#555}
@media print{.q-item{page-break-inside:avoid}}</style></head>
<body><h1>${escapeHtml(title || '复习记录')}</h1>${rows}</body></html>`
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出复习记录',
      defaultPath: `${(title || '复习记录').replace(/[\\/:*?"<>|]/g, '_')}.html`,
      filters: [{ name: 'HTML 文件', extensions: ['html'] }],
    })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, html, 'utf-8')
    logger.info('Quiz', '导出复习记录', { count: items.length, path: result.filePath })
    return result.filePath
  } catch (err) {
    logger.warn('Quiz', '导出失败', { err: err.message })
    throw new Error(`导出失败：${err.message}`)
  }
})

// ========== IPC: AI 生成复习题 ==========
// 出题通道：provider = 'auto'（云端优先，失败回退本地）| 'cloud'（只走云端）| 'local'（只走本地 qwen）
// 题目与答案必须可溯源：解析后校验答案能在笔记原文中找到，否则剔除
ipcMain.handle('quiz:generate', async (event, { noteIds = [], courseIds = [], count = 10, mock = false, provider = 'auto', extendRatio = 0.3 }) => {
  if (mock) {
    // 预览/测试模式：生成固定演示题（buildMockQuiz 此前未定义导致 mock 分支崩溃，这里内联实现）
    const demo = (t) => ({ choice: { type: 'choice', question: '示例：在 Blender 中，"挤压"工具的快捷键是？', options: ['A. E 键', 'B. G 键', 'C. S 键', 'D. R 键'], answer: 'A', difficulty: 'easy', explanation: '编辑模式下按 E 键可挤出。', source: '《示例笔记》1. 快捷键', sourceNoteId: 'demo' }, multi: { type: 'multi', question: '示例：以下哪些是 Blender 常用变换快捷键？', options: ['A. G（移动）', 'B. S（缩放）', 'C. R（旋转）', 'D. T（倾斜）'], answer: 'ABC', difficulty: 'medium', explanation: 'G/S/R 为三大变换快捷键。', source: '《示例笔记》2. 变换', sourceNoteId: 'demo' }, blank: { type: 'blank', question: '示例：Blender 切换透视/正交视图的数字键是 ______。', answer: '5', difficulty: 'hard', explanation: '小键盘 5 切换视图。', source: '《示例笔记》3. 视图', sourceNoteId: 'demo' }, judge: { type: 'judge', question: '示例：Blender 是开源 3D 软件。', answer: '对', difficulty: 'easy', explanation: 'Blender 遵循 GPL 协议。', source: '《示例笔记》0. 简介', sourceNoteId: 'demo' }, match: { type: 'match', question: '示例：将工具与功能配对', answer: '移动→G 旋转→R 缩放→S 挤出→E', difficulty: 'medium', explanation: 'G/R/S/E 分别对应移动/旋转/缩放/挤出。', source: '《示例笔记》4. 工具', sourceNoteId: 'demo', pairs: [{ left: '移动', right: 'G' }, { left: '旋转', right: 'R' }, { left: '缩放', right: 'S' }, { left: '挤出', right: 'E' }] }, sort: { type: 'sort', question: '示例：按正确顺序排列新建 Blender 项目步骤', answer: '打开软件>新建项目>添加物体>渲染', difficulty: 'medium', explanation: '先启动再新建，添加物体后渲染。', source: '《示例笔记》5. 流程', sourceNoteId: 'demo', pairs: [{ left: '打开软件', right: '1' }, { left: '新建项目', right: '2' }, { left: '添加物体', right: '3' }, { left: '渲染', right: '4' }] } })[t]
    const kinds = ['choice', 'choice', 'multi', 'judge', 'blank', 'match', 'sort']
    const base = Date.now().toString(36)
    const questions = Array.from({ length: Math.min(Math.max(parseInt(count) || 10, 1), 20) }, (_, i) => {
      const d = demo(kinds[i % kinds.length])
      return { id: `${base}-${i}`, kind: i % 4 === 3 ? 'extend' : 'review', basis: i % 4 === 3 ? 'Blender 是开源 3D 软件' : undefined, ...d }
    })
    return { questions, provider: 'mock' }
  }
  const allNotes = readJSON(notesFile, []).filter(n => !n.deletedAt)
  let targets = allNotes
  if (noteIds.length) targets = targets.filter(n => noteIds.includes(n.id))
  else if (courseIds.length) targets = targets.filter(n => courseIds.includes(n.courseId))
  if (!targets.length) throw new Error('没有可出题的笔记，请先选择笔记范围')

  const qCount = Math.min(Math.max(parseInt(count) || 10, 3), 20)
  const extendRatioClamped = Math.min(Math.max(parseFloat(extendRatio) || 0.3, 0), 0.6)
  const extendCount = Math.round(qCount * extendRatioClamped)
  const reviewCount = qCount - extendCount
  // 拼笔记材料：超过 5 篇时随机采样，避免永远只从前 5 篇出题（每篇截前 2600 字符）
  const picked = targets.length > 5 ? [...targets].sort(() => Math.random() - 0.5).slice(0, 5) : targets.slice(0, 5)
  const material = picked.map((n, i) => {
    const text = (n.content || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').slice(0, 2600)
    return `[笔记${i + 1}] 标题：${n.title} id：${n.id}\n内容：${text}`
  }).join('\n\n')

  const systemPrompt = `你是资深出题老师。根据下面学生笔记内容，生成 ${qCount} 道题，包含两类：
【A 复习题 kind=review】${reviewCount} 道：直接考察笔记中的知识点。所有题目、选项、答案、解析必须严格来自笔记原文，禁止编造笔记中没有的内容。
【B 拓展题 kind=extend】${extendCount} 道：举一反三。以笔记中的某个知识点为依据（basis 字段填该知识点的原文片段），设计一道笔记中没有的场景应用/变式题——题目与选项允许超出原文，但必须基于该知识点合理衍生，禁止脱离依据凭空编造。答案同样必须正确且唯一。${extendCount === 0 ? '本次不生成拓展题。' : ''}

硬性要求：
1. 题型混合：单选题约40%、填空题约20%、判断题约10%、多选题约10%、匹配题约10%、排序题约10%，根据知识点性质选择最合适的题型
2. 复习题：答案必须能在笔记原文中找到（可溯源）；拓展题：答案不在原文，但 basis 必须是原文片段
3. 单选题恰有4个选项，正确答案用 A/B/C/D 字母表示
4. 多选题恰有4个选项，正确答案用多个字母表示（如 "AC"），并保证正确选项有2-3个
5. 匹配题：question 描述配对要求，pairs 为 [{left:"左侧项",right:"右侧项"}]（3-4对），answer 为 "1-2,2-3,3-1" 形式的映射（左序号-右序号），explanation 说明配对依据
6. 排序题：pairs 为 [{left:"步骤文本",right:"1"},{left:"步骤文本",right:"2"},...]（4步，right 为正确顺序的序号），answer 为正确顺序文本（用 > 连接，如 "打开软件>新建项目>添加物体>渲染"），question 描述操作目标
7. 填空题答案为核心关键词（5字以内）
8. 判断题答案为 对 或 错
9. 每题必须带 difficulty（"easy"/"medium"/"hard"，根据知识点难度判断）
10. 每题必须带 explanation（解析，说明判断依据；拓展题需说明与笔记知识点的联系）和 source（《笔记标题》+原文引用片段或知识点片段）
11. 每题的 sourceNoteId 必须是对应笔记的 id（见下方[笔记N]）
12. 拓展题必须带 kind="extend" 和 basis（依据的知识点原文片段，必须能从笔记内容中逐字找到）
13. 输出必须是合法 JSON：只能使用半角逗号、半角冒号、半角引号，禁止任何全角标点（，：""''等）；题干和选项内不要包含引号
只输出 JSON，不要任何多余文字，不要 markdown 代码块。格式：
{"questions":[{"kind":"review|extend","type":"choice|blank|judge|multi|match|sort","question":"题干","options":["A. xxx","B. xxx","C. xxx","D. xxx"],"answer":"A 或 AC 或 对 或 关键词 或 映射 或 步骤序列","basis":"知识点原文片段（仅拓展题）","difficulty":"easy|medium|hard","explanation":"解析","source":"《标题》引用原文","sourceNoteId":"笔记id","pairs":[{"left":"项","right":"项或序号"}]}]}`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: material },
  ]

  const settings = readSettings()
  const makeFallbackSettings = (s) => ({ ...s, provider: 'local', model: 'qwen2.5:7b-instruct', apiKey: '' })

  // 尝试调用：按用户选择的出题通道执行
  // 云端出题用 30s 快超时：免费云端排队严重时快速失败并回退本地，避免用户干等 90s；
  // 本地回退不传 timeoutMs → 走 callAI 默认 600s 长超时（低配机器本地 qwen 出题约需 1~2 分钟）
  const CLOUD_QUIZ_TIMEOUT_MS = 30000
  const tryGenerate = async (cfg, opts = {}) =>
    callAIWithRetry(cfg, messages, null, { outputTokens: 4096, operation: 'quiz', ...opts })
  const notifyRenderer = (payload) => {
    try {
      if (event.sender && !event.sender.isDestroyed()) event.sender.send('quiz:providerNotice', payload)
    } catch { /* 渲染窗口已关闭时忽略 */ }
  }

  const mode = String(provider || 'auto').toLowerCase()
  const defaultIsLocal = settings.provider === 'local' || !settings.provider
  let raw = ''
  let usedProvider = ''

  try {
    if (mode === 'local' || (mode === 'auto' && defaultIsLocal)) {
      // 本地 qwen 出题：完全绕开云端（无论自动还是明确选本地）
      raw = await tryGenerate(makeFallbackSettings(settings))
      usedProvider = 'local'
    } else if (mode === 'cloud') {
      // 只走云端（跟随设置中的云端 provider）
      if (!settings.apiKey) throw new Error('云端出题需要先配置 API Key（设置页）')
      raw = await tryGenerate(settings, { timeoutMs: CLOUD_QUIZ_TIMEOUT_MS })
      usedProvider = settings.provider || 'cloud'
    } else {
      // auto + 云端默认：云端优先（30s 快超时），失败即时通知并回退本地
      try {
        raw = await tryGenerate(settings, { timeoutMs: CLOUD_QUIZ_TIMEOUT_MS })
        usedProvider = settings.provider || 'cloud'
      } catch (cloudErr) {
        notifyRenderer({ kind: 'fallback', message: '云端出题排队超时，已自动切换本地模型（qwen2.5）出题，请稍候…', reason: cloudErr.message })
        logger.info('Quiz', '云端出题失败，回退本地', { err: cloudErr.message })
        try {
          raw = await tryGenerate(makeFallbackSettings(settings))
          usedProvider = 'local'
        } catch (e2) {
          throw new Error(`AI 出题失败（云端与本地均失败）：${e2.message}`)
        }
      }
    }
  } catch (e) {
    throw new Error(`AI 出题失败（${mode === 'cloud' ? '云端' : '本地'}通道）：${e.message}`)
  }

  // 解析 JSON（容错）：先标准容错，失败则修复全角标点后再试（AI 偶尔输出全角逗号/引号）
  const normalizeCJK = (s) => String(s).replace(/，/g, ',').replace(/：/g, ':').replace(/“|”/g, '"').replace(/‘|’/g, "'").replace(/（/g, '(').replace(/）/g, ')')
  let parsed = null
  try { parsed = parseAIJSON(raw) } catch (e) { parsed = null }
  if (!parsed) {
    try { parsed = parseAIJSON(normalizeCJK(raw)) } catch (e) { parsed = null }
  }
  if (!parsed || !Array.isArray(parsed.questions) || !parsed.questions.length) {
    throw new Error('AI 返回格式无法解析，请重试')
  }

  // 溯源校验：答案与出处必须能在笔记原文中找到（防止 AI 编造）
  const noteById = new Map(picked.map(n => [n.id, n]))
  const strip = (s) => String(s || '').replace(/\s+/g, '').toLowerCase()
  // 模糊匹配：AI 常对选项做轻微改写（如"居中显示场景中的所有物体"→"居中显示所有物体"）
  // 用 4 字窗口匹配，任一连续片段能在原文中找到即视为有依据；短答案（<4字）退化为精确匹配
  const containsFuzzy = (content, text) => {
    if (!text || text.length < 2) return false
    if (content.includes(text)) return true
    const win = Math.min(4, text.length)
    for (let i = 0; i + win <= text.length; i++) {
      if (content.includes(text.slice(i, i + win))) return true
    }
    return false
  }
  const okQuestions = []
  for (const q of parsed.questions) {
    // sourceNoteId 由 AI 提供不可靠 → 优先按标题从 source 中匹配
    let srcNote = noteById.get(q.sourceNoteId)
    if (!srcNote) {
      const titleMatch = (q.source || '').match(/《([^》]+)》/)
      srcNote = titleMatch ? picked.find(n => strip(n.title) === strip(titleMatch[1])) : undefined
    }
    if (!srcNote) continue
    const content = strip(srcNote.content || '')
    if (!content) continue
    const qType = String(q.type || 'choice').toLowerCase()
    const qKind = String(q.kind || 'review').toLowerCase() === 'extend' ? 'extend' : 'review'
    let answerOk = false

    if (qKind === 'extend') {
      // 拓展题：依据溯源——basis 必须能在笔记原文找到；答案只做格式校验（不要求可溯源）
      const basis = strip(q.basis)
      if (basis.length < 4 || !containsFuzzy(content, basis)) continue
      if (qType === 'choice' && Array.isArray(q.options)) {
        answerOk = 'ABCD'.indexOf(String(q.answer || '').toUpperCase().trim()) >= 0
      } else if (qType === 'judge') {
        answerOk = ['对', '错'].includes(String(q.answer).trim())
      } else if (qType === 'multi' && Array.isArray(q.options)) {
        const letters = String(q.answer || '').toUpperCase().replace(/[^A-D]/g, '')
        answerOk = letters.length >= 2 && [...letters].every(l => 'ABCD'.includes(l))
      } else if (qType === 'blank') {
        answerOk = String(q.answer || '').trim().length >= 2
      } else if (qType === 'sort') {
        answerOk = String(q.answer || '').includes('>')
      }
      if (!answerOk) continue
    } else if (qType === 'sort') {
      // 排序题（复习）：步骤文本需能在原文找到，answer 为 > 连接序列
      const steps = Array.isArray(q.pairs) ? q.pairs.slice(0, 4) : []
      answerOk = steps.length >= 3 && steps.every(p => containsFuzzy(content, strip(p.left))) && String(q.answer || '').includes('>')
    } else if (qType === 'choice' && Array.isArray(q.options)) {
      const idx = 'ABCD'.indexOf(String(q.answer || '').toUpperCase().trim())
      if (idx >= 0) {
        const optText = strip(q.options[idx].replace(/^[A-D][.、)\s]*/i, ''))
        answerOk = containsFuzzy(content, optText)
      }
    } else if (qType === 'multi' && Array.isArray(q.options)) {
      // 多选：每个选中选项都要能在原文找到
      const letters = String(q.answer || '').toUpperCase().replace(/[^A-D]/g, '')
      if (letters.length >= 2) {
        answerOk = [...letters].every(l => {
          const idx = 'ABCD'.indexOf(l)
          if (idx < 0) return false
          const optText = strip(q.options[idx].replace(/^[A-D][.、)\s]*/i, ''))
          return containsFuzzy(content, optText)
        })
      }
    } else if (qType === 'blank') {
      answerOk = containsFuzzy(content, strip(q.answer))
    } else if (qType === 'judge') {
      // 判断题：答案只要求对/错，但题干必须能在笔记中找到（防止 AI 出与笔记无关的判断题）
      answerOk = ['对', '错', '正确', '错误', '对/错'].includes(String(q.answer).trim()) && containsFuzzy(content, strip(q.question))
    } else if (qType === 'match') {
      // 匹配：左右项任一能在原文找到即可（原要求左右都溯源，过滤过狠导致题型单一）
      const pairs = Array.isArray(q.pairs) ? q.pairs.slice(0, 4) : []
      answerOk = pairs.length >= 2 && pairs.every(p => containsFuzzy(content, strip(p.left)) || containsFuzzy(content, strip(p.right)))
    }
    if (!answerOk) continue
    okQuestions.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: ['choice', 'blank', 'judge', 'multi', 'match', 'sort'].includes(qType) ? qType : 'choice',
      kind: qKind,
      basis: qKind === 'extend' ? String(q.basis || '').trim() : undefined,
      question: String(q.question || '').trim(),
      options: Array.isArray(q.options) ? q.options.map(o => String(o).trim()).filter(Boolean).slice(0, 4) : undefined,
      answer: String(q.answer || '').trim(),
      difficulty: ['easy', 'medium', 'hard'].includes(String(q.difficulty || '').toLowerCase()) ? String(q.difficulty).toLowerCase() : 'medium',
      explanation: String(q.explanation || '').trim(),
      source: String(q.source || '').trim() || srcNote.title,
      sourceNoteId: srcNote.id,
      pairs: Array.isArray(q.pairs) ? q.pairs.slice(0, 4).map(p => ({ left: String(p.left || '').trim(), right: String(p.right || '').trim() })).filter(p => p.left && p.right) : undefined,
    })
  }

  if (okQuestions.length === 0) throw new Error('生成的题目未能通过答案溯源校验（答案需能在笔记原文中找到），请重试')
  logger.info('Quiz', '出题成功', { rawCount: parsed.questions.length, okCount: okQuestions.length, provider: usedProvider })
  const result = { questions: okQuestions.slice(0, qCount), provider: usedProvider }
  // 序列化测试：排查 "An object could not be cloned"
  try {
    const json = JSON.stringify(result)
    logger.info('Quiz', '返回前序列化测试通过', { bytes: json.length })
  } catch (e) {
    logger.error('Quiz', '返回对象不可序列化！', { err: e.message })
  }
  return result
})

// ========== IPC: 日志系统（被删后重建） ==========
ipcMain.handle('log:getFiles', async () => {
  try {
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log')).sort().reverse()
    return files.map(f => {
      const full = path.join(logDir, f)
      const stat = fs.statSync(full)
      return { name: f, size: stat.size, modifiedAt: stat.mtime.toISOString() }
    })
  } catch { return [] }
})

ipcMain.handle('log:read', async (e, fileName) => {
  try {
    const fp = path.join(logDir, fileName)
    if (!fs.existsSync(fp)) return { lines: [], error: null }
    let content = fs.readFileSync(fp, 'utf-8')
    if (content.length > 200000) content = content.slice(-200000)
    // 解析日志行为结构化 LogEntry（前端 LogViewer 期望 { lines: LogEntry[] }）
    const lines = content.split(/\r?\n/)
      .filter(l => l.trim())
      .map(line => {
        const m = line.match(/^\[([^\]]+)\]\s*\[([A-Z]+)\]\s*\[([^\]]+)\]\s*(.*)$/)
        if (m) {
          return { timestamp: m[1], level: m[2], levelColor: '', source: m[3], message: m[4], data: null }
        }
        return { timestamp: '', level: 'INFO', levelColor: '', source: '', message: line, data: null }
      })
    return { lines, error: null }
  } catch (err) {
    return { lines: [], error: String(err && err.message || err) }
  }
})

ipcMain.handle('log:clear', async (e, fileName) => {
  try { fs.unlinkSync(path.join(logDir, fileName)); return true }
  catch { return false }
})

ipcMain.handle('log:setLevel', (e, level) => {
  process.env.LOG_LEVEL = String(level || 'INFO')
  logger.info('Log', '日志级别已更新', { level })
  return true
})

ipcMain.handle('log:openDir', () => {
  try {
    const { shell } = require('electron')
    shell.openPath(logDir)
    return true
  } catch { return false }
})

// ========== 日志系统 ==========
// 前端日志转发到主进程统一记录
ipcMain.handle('log:write', (event, level, source, message, data) => {
  const levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO
  writeLog(levelNum, source, message, data)
  return true
})

// ========== 本地 TTS 朗读（语音问答闭环：Windows SAPI 完全离线） ==========
ipcMain.handle('tts:speak', async (e, text) => {
  try {
    const cleanText = String(text || '').replace(/[#*`>_\-\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800)
    if (!cleanText) return ''
    const { execFile } = require('child_process')
    const wavPath = path.join(os.tmpdir(), `notestar-tts-${Date.now()}.wav`)
    const escaped = cleanText.replace(/'/g, "''").replace(/"/g, '`"')
    const ps = `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=0; $s.SetOutputToWaveFile('${wavPath.replace(/'/g, "''")}'); $s.Speak('${escaped}'); $s.Dispose();`
    await new Promise((resolve) => {
      execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 30000, windowsHide: true }, (err) => resolve(err))
    })
    if (!fs.existsSync(wavPath)) return ''
    const b64 = fs.readFileSync(wavPath).toString('base64')
    fs.unlinkSync(wavPath)
    logger.info('TTS', '本地朗读生成', { chars: cleanText.length })
    return 'data:audio/wav;base64,' + b64
  } catch (err) {
    logger.warn('TTS', '本地朗读失败', { err: err.message })
    return ''
  }
})

// 生成笔记复习音频包：全文分段 SAPI 合成 → 拼接 wav → 返回 dataURI（通勤复习用）
ipcMain.handle('tts:noteAudio', async (e, noteId) => {
  try {
    const notes = readJSON(notesFile, [])
    const note = notes.find(n => n.id === noteId)
    if (!note || !note.content) return ''
    // 提取纯文本：去掉 markdown 符号、图片链接、代码块
    let text = String(note.content)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#*`>|~\-_\[\]()]/g, ' ')
      .replace(/\s+/g, ' ').trim()
    if (!text) return ''
    // 分段（每段 700 字，SAPI 单次合成上限）
    const chunks = []
    for (let i = 0; i < text.length; i += 700) chunks.push(text.slice(i, i + 700))
    if (chunks.length > 40) chunks.length = 40 // 防超长
    const { execFile } = require('child_process')
    const tmpFiles = []
    const synth = (chunk) => new Promise((resolve) => {
      const wavPath = path.join(os.tmpdir(), `notestar-note-${Date.now()}-${tmpFiles.length}.wav`)
      const escaped = chunk.replace(/'/g, "''").replace(/"/g, '`"')
      const ps = `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=0; $s.SetOutputToWaveFile('${wavPath.replace(/'/g, "''")}'); $s.Speak('${escaped}'); $s.Dispose();`
      execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 60000, windowsHide: true }, (err) => {
        if (!err && fs.existsSync(wavPath)) tmpFiles.push(wavPath)
        resolve()
      })
    })
    for (const c of chunks) await synth(c)
    if (!tmpFiles.length) return ''
    // 拼接 wav（保留第一个文件头，其余跳过 44 字节头）
    const first = fs.readFileSync(tmpFiles[0])
    if (first.length < 44) { tmpFiles.forEach(f => fs.unlinkSync(f)); return '' }
    const datas = tmpFiles.map(f => { const b = fs.readFileSync(f); fs.unlinkSync(f); return b.slice(44) })
    const dataSize = datas.reduce((a, b) => a + b.length, 0)
    const out = Buffer.concat([first.slice(0, 44), ...datas])
    out.writeUInt32LE(dataSize, 40)
    out.writeUInt32LE(36 + dataSize, 4)
    logger.info('TTS', '笔记音频生成', { noteId, chunks: chunks.length, bytes: out.length })
    return 'data:audio/wav;base64,' + out.toString('base64')
  } catch (err) {
    logger.warn('TTS', '笔记音频生成失败', { err: err.message })
    return ''
  }
})

// ========== 跟拍模式：视频帧智能笔记 + 录屏（本地 Ollama 视觉识别） ==========
const RECORDINGS_DIR = path.join(dataDir, 'recordings')
// Day 2 P0-V4：录屏每段真实秒数表（sessionId → number[]）
const segmentDurationsMap = new Map()
// Day 3 P0-V2：拦截 Chromium 原生 getDisplayMedia 选择器 → 统一走前端卡片 picker
const pendingMediaRequests = new Map() // reqId → callback(streamIdOrCancel)
let displayMediaReqSeq = 1

// AI 视觉识别：本地 Ollama 视觉模型（moondream/minicpm-v/llama3.2-vision），图片不出电脑
async function describeCourseImage(imageDataUri, opts = {}) {
  try {
    const settings = readSettings()
    const model = settings.followVisionModel || 'moondream'
    const mm = buildMultimodalContent(
      `Describe this course screenshot. Reply in THREE LINES, ALL IN CHINESE (简体中文).\n` +
      `Line 1 (≤15 Chinese chars): One-sentence summary of what is being done.\n` +
      `Line 2 (≤80 Chinese chars): Describe the UI, panels, parameters, or tools visible.\n` +
      `Line 3: Player timecode like 12:34, or write 无 if none.\n` +
      `MANDATORY: Every line MUST be Chinese characters (中文). Do NOT output any English words or letters. Do NOT output JSON or coordinate arrays.\n` +
      `![img](${imageDataUri})`,
      model
    )
    const messages = [
      { role: 'system', content: 'You are a visual analysis assistant. ALWAYS answer in SIMPLIFIED CHINESE (简体中文) only. Never use English. Never output JSON, bounding boxes, or coordinate arrays like [0.1, 0.2, 0.3, 0.4].' },
      { role: 'user', content: mm.content },
    ]
    let text = await callAIWithRetry(
      { ...settings, provider: 'local', model, apiKey: '' },
      messages, undefined, { outputTokens: 800, operation: 'follow', ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}) }
    )

    // Fix 1: moondream 偶发返回空（resultLength=0）→ 立刻 retry 一次
    const isEmpty = !text || String(text).trim().length < 5
    if (isEmpty) {
      logger.warn('Follow', '视觉返回空，retry 一次', { model })
      try {
        text = await callAIWithRetry(
          { ...settings, provider: 'local', model, apiKey: '' },
          messages, undefined, { outputTokens: 800, operation: 'follow', ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}) }
        )
      } catch (retryErr) {
        logger.warn('Follow', 'retry 也失败', { err: retryErr.message })
      }
    }

    // Fix 2: 翻译 —— 只要有英文就全量翻译（包括 title）
    const raw = String(text)
    const hasChinese = /[\u4e00-\u9fff]/.test(raw)
    const hasEnglish = /[a-zA-Z]{4,}/.test(raw)
    if (hasEnglish) {
      logger.info('Follow', '视觉含英文，用 qwen2.5 全量翻译', { model, preview: raw.slice(0, 80) })
      try {
        const translateText = await callAIWithRetry(
          { ...settings, provider: 'local', model: 'qwen2.5:7b-instruct', apiKey: '' },
          [
            { role: 'system', content: '你是翻译官。把用户给的内容完整翻译成自然、简洁的简体中文，保持原有的段落/换行结构，不要输出任何解释或注释。如果原文是英文就翻成中文，如果原文已经是中文就原样返回。' },
            { role: 'user', content: raw },
          ], undefined, { outputTokens: 800, operation: 'follow', ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}) }
        )
        const t = String(translateText).trim()
        // 只要翻译结果包含中文就用它（哪怕部分翻译了也好过全英文）
        if (/[\u4e00-\u9fff]/.test(t)) {
          text = t
          logger.info('Follow', '翻译完成', { preview: text.slice(0, 80) })
        } else {
          logger.warn('Follow', 'qwen2.5 翻译无中文，保留原文', { preview: t.slice(0, 80) })
        }
      } catch (trErr) {
        logger.warn('Follow', '翻译失败，保留原文', { err: trErr.message })
      }
    }

    const cleaned = String(text).replace(/```json|```/g, '').trim()
    // Fix 3: 最终兜底 —— 如果 cleaned 还是空/太短，说明 retry 也失败了
    if (cleaned.length < 3) {
      logger.warn('Follow', '最终文本仍为空，用兜底', { model })
      return { desc: '', detail: '', timecode: null, title: '画面记录' }
    }
    try {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) {
        const obj = JSON.parse(m[0])
        if (obj && (obj.detail || obj.desc)) {
          // 确保 title 不含英文
          const t = String(obj.title || obj.desc || '').slice(0, 15)
          return { ...obj, title: t }
        }
      }
      const lines = cleaned.split(/\r?\n/).map(l => l.replace(/^\d+[.、)\s]+/, '').trim()).filter(Boolean)
      const tc = cleaned.match(/(\d{1,2}):(\d{2})/)
      // Fix 4: 切完 lines 后再确认 title 不含英文（极端情况下翻译可能没覆盖到所有行）
      const rawTitle = (lines[0] || '画面记录').slice(0, 15)
      const title = /[a-zA-Z]{4,}/.test(rawTitle) ? '画面记录' : rawTitle
      return {
        desc: lines[0] || '',
        detail: lines[1] || cleaned.slice(0, 120),
        timecode: tc ? tc[0] : null,
        title,
      }
    } catch (e) {
      return { desc: '', detail: cleaned.slice(0, 120), timecode: null, title: '画面记录' }
    }
  } catch (err) {
    logger.warn('Follow', '视觉识别失败', { err: err.message })
    return { desc: '', detail: '', timecode: null, title: '画面记录', error: err.message }
  }
}

// 渲染进程入口（跟拍页调用，保持原通道兼容）
ipcMain.handle('follow:aiDescribe', (e, imageDataUri) => describeCourseImage(imageDataUri))

// 追加图文条目到笔记（复习页靠 ⏱ sec= 定位）
function appendEntryToNote(noteId, entryMd, sec) {
  try {
    const notes = readJSON(notesFile, [])
    const idx = notes.findIndex(n => n.id === noteId)
    if (idx < 0) return false
    const note = notes[idx]
    note.content = (note.content || '') + '\n\n' + entryMd + `\n> ⏱ sec=${Math.round(sec || 0)}\n`
    note.updatedAt = new Date().toISOString()
    note.paragraphs = note.content.split('\n').filter(l => l.trim()).length
    notes[idx] = note
    writeJSON(notesFile, notes)
    // 通知前端刷新
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notes:changed')
    return true
  } catch (err) {
    logger.warn('Follow', '追加条目失败', { err: err.message })
    return false
  }
}

// 渲染进程入口（跟拍页调用，保持原通道兼容）
ipcMain.handle('follow:appendEntry', (e, { noteId, entryMd, sec }) => appendEntryToNote(noteId, entryMd, sec))

// ========== 悬浮球录屏 → 跟拍笔记（复刻原"边录边识别"设计） ==========
// 能力函数（fastCaptureSync / describeCourseImage / saveImageDataUri / appendEntryToNote / finishRecSessionMeta）
// 全部在 main.cjs 内可直调，无需 IPC 往返。录屏期间每 30s：截帧 → 存图 → 本地视觉识别 → 追加 🎥 条目；
// 结束时 finishRecSessionMeta 把 noteId 绑进会话 meta（复习页与笔记联动）。
const REC_FOLLOW_INTERVAL = 30000   // 30s 一条，与原跟拍节奏一致
let recFollowTimer = null           // 30s 周期定时器
let recFollowNoteId = null          // 当前录屏对应的跟拍笔记
let recFollowStartTs = 0            // 录屏起始时间戳（用于时间码）
let recFollowSessionId = ''         // 当前录屏会话
let recFollowBusy = false           // 单帧识别防重入（识别可能耗时数秒）
let recFollowFirstFrame = true      // 首帧冷启动标志：moondream 首次加载（低配机 ~40s+）需放宽超时

function fmtTimecode(sec) {
  const mm = String(Math.floor(Math.max(0, sec || 0) / 60) % 60).padStart(2, '0')
  const ss = String(Math.floor(Math.max(0, sec || 0) % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}

// 创建"跟拍笔记"：随录屏启动即建，条目边录边追加，停录后由会话 meta 绑定
function createFollowNote(sessionId) {
  const now = new Date()
  const id = 'n' + Date.now()
  const note = {
    id, title: `跟拍笔记 ${now.toLocaleTimeString()}`,
    courseId: '', tags: [], content: `# 🎬 跟拍录屏 ${now.toLocaleTimeString()}\n\n> 画面识别条目将随录屏逐条追加…`,
    createdAt: now.toISOString(), updatedAt: now.toISOString(), paragraphs: 2,
  }
  try {
    writeJSON(notesFile, [note, ...readJSON(notesFile, [])])
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notes:changed')
    logger.info('Follow', '跟拍笔记已创建', { id, sessionId, title: note.title })
  } catch (err) {
    logger.warn('Follow', '跟拍笔记创建失败', { err: err.message })
  }
  return id
}

// 一次"截帧→识别→追加"（时间码 = 距录屏开始秒数，格式 mm:ss）
async function recFollowTick() {
  if (recFollowBusy || !isBubbleRecording || !recFollowNoteId) return
  // 快照 noteId 与起始时间戳：即使本帧识别期间用户停录（收尾会清全局），在途结果仍写入正确的笔记
  const noteId = recFollowNoteId
  const startTs = recFollowStartTs
  recFollowBusy = true
  try {
    const sec = Math.max(0, Math.round((Date.now() - startTs) / 1000))
    const cap = await fastCaptureSync({ width: 1280, height: 720 })
    if (!cap || cap.ok !== true || !cap.dataUri) {
      logger.warn('Follow', '跟拍截帧失败（本轮跳过）', { reason: cap?.reason })
      return
    }
    const rel = await saveImageDataUri(cap.dataUri).catch(() => '')
    if (!rel) { logger.warn('Follow', '跟拍截图落盘失败（本轮跳过）'); return }
    // 本地视觉识别（moondream 等，含空/英文兜底与重试），失败则留"已保存截图供之后补记"
    // 首帧：模型冷启动需更久（放宽到 120s），识别请求发出后即视为冷启动窗口已过，后续帧恢复常规 40s
    let title = '画面记录'
    let detail = ''
    try {
      const desc = await describeCourseImage(cap.dataUri, recFollowFirstFrame ? { timeoutMs: 120000 } : {})
      recFollowFirstFrame = false
      if (desc) {
        if (desc.detail || desc.desc) detail = String(desc.detail || desc.desc).trim()
        if (desc.title) title = String(desc.title).trim().slice(0, 15)
      }
    } catch (err) {
      logger.warn('Follow', '跟拍识别异常（保留截图）', { err: err.message })
    }
    // 乱码判断：既无中文也无英文（如 moondream 对低质/外文画面输出的泰文回声）→ 不写入笔记
    const looksGarbage = (s) => {
      const t = String(s || '').trim()
      return t.length > 0 && !/[\u4e00-\u9fff]/.test(t) && !/[a-zA-Z]/.test(t)
    }
    if (/[a-zA-Z]{4,}/.test(title) || looksGarbage(title)) title = '画面记录'
    let body
    if (looksGarbage(detail)) {
      // 纯乱码 → 占位（保留截图，正文不写无意义字符）
      body = '（画面内容未能清晰识别，已保存截图）'
    } else if (!detail || /识别超时|error|失败/i.test(detail)) {
      body = '（AI 识别超时，已保存截图供之后补记）'
    } else {
      body = detail
    }
    const entryMd = `## 🎥 ${fmtTimecode(sec)}【${title}】\n\n![截图](${rel})\n> ${body}`
    const ok = appendEntryToNote(noteId, entryMd, sec)
    logger.info('Follow', '跟拍条目已追加', { sec: fmtTimecode(sec), ok, title, img: rel })
  } catch (err) {
    logger.warn('Follow', '跟拍 tick 异常', { err: err.message })
  } finally {
    recFollowBusy = false
  }
}

function startRecFollowLoop() {
  stopRecFollowLoop()
  recFollowFirstFrame = true   // 新会话首帧重新进入冷启动模式（moondream 可能已被卸载，需再加载）
  recFollowTimer = setInterval(() => { recFollowTick() }, REC_FOLLOW_INTERVAL)
  // 启动后 ~8s 先出第一条（不用干等 30s）
  setTimeout(() => { recFollowTick() }, 8000)
}

function stopRecFollowLoop() {
  if (recFollowTimer) { clearInterval(recFollowTimer); recFollowTimer = null }
}

// 收尾：写会话 meta 绑定 noteId（幂等——正常停录与 closed 钩子都会调，第二次直接跳过）
function finishRecFollowSession() {
  if (!recFollowSessionId) return
  const sessionId = recFollowSessionId
  const noteId = recFollowNoteId
  const totalSec = Math.max(1, Math.round((Date.now() - recFollowStartTs) / 1000))
  recFollowSessionId = ''
  recFollowNoteId = null
  recFollowStartTs = 0
  stopRecFollowLoop()
  try {
    const ok = finishRecSessionMeta({
      sessionId,
      title: `跟拍 ${new Date().toLocaleTimeString()}`,
      durationSec: totalSec,
      noteId: noteId || null,
    })
    logger.info('Follow', '悬浮球跟拍收尾', { sessionId, noteId, totalSec, ok })
  } catch (err) {
    logger.warn('Follow', '悬浮球跟拍收尾失败', { err: err.message })
  }
}

// 保存录屏分段（渲染进程 MediaRecorder blob → 主进程写文件）
ipcMain.handle('rec:saveSegment', (e, { sessionId, index, buffer, mime, durationSec }) => {
  try {
    fs.mkdirSync(path.join(RECORDINGS_DIR, sessionId), { recursive: true })
    const ext = (mime || '').includes('mp4') ? 'mp4' : 'webm'
    const fp = path.join(RECORDINGS_DIR, sessionId, `seg_${String(index).padStart(3, '0')}.${ext}`)
    fs.writeFileSync(fp, Buffer.from(buffer))
    // Day 2：保存每段真实秒数（旧前端不传 durationSec 时 fallback 0，finishSession 会再兜底估算）
    const arr = segmentDurationsMap.get(sessionId) || []
    const idxNum = Number(index) | 0
    while (arr.length < idxNum + 1) arr.push(0)
    arr[idxNum] = typeof durationSec === 'number' && isFinite(durationSec) && durationSec > 0
      ? durationSec
      : 0
    segmentDurationsMap.set(sessionId, arr)
    logger.info('Rec', '录屏分段已保存', { sessionId, index: idxNum, bytes: buffer.length, durationSec: arr[idxNum] || 0 })
    return fp
  } catch (err) {
    logger.warn('Rec', '录屏分段保存失败', { err: err.message })
    return ''
  }
})

// 跟拍会话信息写入（供复习页读取）
function finishRecSessionMeta({ sessionId, title, durationSec, noteId, segmentDurations }) {
  try {
    fs.mkdirSync(path.join(RECORDINGS_DIR, sessionId), { recursive: true })
    // 1) 每段真实秒数：优先前端 segmentDurations（更精确，含最后一段未满 timeslice 的时长），否则退回主进程内存 map
    let segs = Array.isArray(segmentDurations) && segmentDurations.length
      ? segmentDurations.map(n => (typeof n === 'number' && isFinite(n) && n > 0 ? n : 0))
      : (segmentDurationsMap.get(sessionId) || [])
    // 2) 读 seg 文件数量作为兜底
    const segList = (() => {
      try { return fs.readdirSync(path.join(RECORDINGS_DIR, sessionId)).filter(f => /^seg_\d{3}\.(webm|mp4)$/i.test(f)).sort() }
      catch (_) { return [] }
    })()
    while (segs.length < segList.length) segs.push(0)
    // 3) 总时长 + 对 0 段均摊（兼容旧前端/旧录屏）
    const knownSum = segs.reduce((a, b) => a + b, 0)
    const zeros = segs.filter(s => !s).length
    const totalSec = typeof durationSec === 'number' && isFinite(durationSec) && durationSec > 0
      ? durationSec
      : (knownSum || segList.length * 600)
    if (zeros > 0 && totalSec > knownSum) {
      const avg = (totalSec - knownSum) / zeros
      for (let i = 0; i < segs.length; i++) if (!segs[i]) segs[i] = avg
    }
    // 4) 算 segmentStarts 前缀和（ReviewView 精确二分跳时间）
    const starts = [0]
    for (const s of segs) starts.push(Math.max(0, (starts[starts.length - 1] || 0) + s))
    starts.pop()
    const meta = {
      sessionId, title,
      durationSec: totalSec, noteId,
      createdAt: new Date().toISOString(),
      segmentDurations: segs,
      segmentStarts: starts,
    }
    atomicWriteMeta(path.join(RECORDINGS_DIR, sessionId, 'meta.json'), meta)
    segmentDurationsMap.delete(sessionId)
    logger.info('Rec', '录屏会话完成', { sessionId, segCount: segs.length, totalSec: meta.durationSec })
    // 通知前端：sessions 列表更新了（noteId 等字段现在有了）
    try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notes:changed') } catch (_) {}
    // 异步尝试用 ffmpeg 把 .webm 分段转成 .mp4（有 ffmpeg 就转，没有就跳过）
    convertSessionToMp4(sessionId).catch(() => {})
    return true
  } catch (err) { logger.warn('Rec', '录屏会话 meta 写入失败', { err: err && err.message }); return false }
}

// 渲染进程入口（跟拍页调用，保持原通道兼容）
ipcMain.handle('rec:finishSession', (e, p) => finishRecSessionMeta(p || {}))

// ===== ffmpeg 自动转换 .webm → .mp4 =====
let _ffmpegPath = null
function findFfmpeg() {
  if (_ffmpegPath) return _ffmpegPath
  const { execSync } = require('child_process')
  const isDev = process.argv.includes('--dev')
  const candidates = [
    'ffmpeg',                                                              // PATH（系统安装）
    // 打包后：extraResources from vendor/ffmpeg → resources/ffmpeg/bin/ffmpeg.exe
    path.join(process.resourcesPath || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    // 开发期：app/vendor/ffmpeg/bin/ffmpeg.exe
    path.join(app.getAppPath(), 'vendor', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    // 其他常见位置（用户手动装的）
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
  ]
  for (const c of candidates) {
    try {
      execSync(`"${c}" -version`, { stdio: 'ignore', timeout: 3000 })
      _ffmpegPath = c
      logger.info('Rec', '找到 ffmpeg', { path: c, source: c.includes('vendor') ? '项目内置' : (c.includes('resources') ? '打包资源' : '系统安装') })
      return c
    } catch (_) {}
  }
  logger.info('Rec', '未找到 ffmpeg，跳过 MP4 转换（WebM 在 Electron 中可直接播放）')
  return null
}

async function convertSessionToMp4(sessionId) {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) return
  const dir = path.join(RECORDINGS_DIR, sessionId)
  const segs = fs.readdirSync(dir).filter(f => /^seg_\d+\.webm$/.test(f)).sort()
  if (!segs.length) return
  const concatFile = path.join(dir, '_concat.txt')
  const concatContent = segs.map(f => `file '${path.join(dir, f).replace(/\\/g, '/')}'`).join('\n')
  fs.writeFileSync(concatFile, concatContent, 'utf-8')
  const outMp4 = path.join(dir, 'full.mp4')
  logger.info('Rec', '开始 ffmpeg 转 MP4', { sessionId, segCount: segs.length })
  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatFile,
      '-c', 'copy',                 // 流复制，不重编码，秒级完成
      '-movflags', '+faststart',    // 让 MP4 可边下边播
      outMp4
    ], { windowsHide: true })
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', async code => {
      fs.unlinkSync(concatFile)
      if (code === 0) {
        logger.info('Rec', 'MP4 转换完成', { sessionId, sizeMB: (fs.statSync(outMp4).size / 1024 / 1024).toFixed(1) })
        // 更新 meta.json
        try {
          const metaPath = path.join(dir, 'meta.json')
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta.mp4File = 'full.mp4'
          // 同步生成 full.webm：VP9+Opus 的 WebM 是 Chromium 原生组合，复习页优先播它（Opus-in-MP4 可能解码失败）
          const outWebm = path.join(dir, 'full.webm')
          if (!fs.existsSync(outWebm)) {
            try {
              await new Promise((r) => {
                const pw = spawn(ffmpeg, ['-y', '-i', outMp4, '-c', 'copy', '-f', 'webm', outWebm], { windowsHide: true })
                pw.on('error', () => r())
                pw.on('close', () => { try { if (fs.existsSync(outWebm)) meta.webmFile = 'full.webm' } catch (_) {}; r() })
              })
            } catch (_) {}
          } else {
            meta.webmFile = 'full.webm'
          }
          // 后台重编码为 H.264/AAC MP4（Chromium 万能支持），不阻塞主流程；失败则前端回退 webm
          if (!fs.existsSync(path.join(dir, 'full_h264.mp4'))) {
            const ph = spawn(ffmpeg, ['-y', '-nostdin', '-i', outMp4, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(dir, 'full_h264.mp4')], { windowsHide: true })
            ph.on('error', () => {})
            ph.on('close', () => { try { if (fs.existsSync(path.join(dir, 'full_h264.mp4'))) { const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); m.h264File = 'full_h264.mp4'; atomicWriteMeta(metaPath, m) } } catch (_) {} })
          }
          atomicWriteMeta(metaPath, meta)
        } catch (_) {}
        // 可选：删 .webm 分段节省空间（先保留，确认 MP4 正常后再删）
        // segs.forEach(f => { try { fs.unlinkSync(path.join(dir, f)) } catch (_) {} })
        resolve()
      } else {
        logger.warn('Rec', 'MP4 转换失败', { sessionId, code, stderr: stderr.slice(-300) })
        reject(new Error('ffmpeg exit ' + code))
      }
    })
    proc.on('error', reject)
  })
}

// 复习页：列出录屏会话（含分段文件）
ipcMain.handle('rec:listSessions', () => {
  try {
    if (!fs.existsSync(RECORDINGS_DIR)) { logger.info('Rec', 'listSessions 目录不存在'); return [] }
    const out = []
    for (const sessionId of fs.readdirSync(RECORDINGS_DIR)) {
      try {
        const dir = path.join(RECORDINGS_DIR, sessionId)
        let stat
        try { stat = fs.statSync(dir) } catch (_) { continue }
        if (!stat.isDirectory()) continue
        const metaPath = path.join(dir, 'meta.json')
      // 排序：seg_*.webm 按序号排前面，full.mp4 排最后（ReviewView 默认播第一个）
      const segments = fs.readdirSync(dir).filter(f => /\.(webm|mp4)$/i.test(f)).sort((a, b) => {
        const aIsFull = /full\.mp4$/i.test(a); const bIsFull = /full\.mp4$/i.test(b)
        if (aIsFull !== bIsFull) return aIsFull ? 1 : -1
        const an = (a.match(/seg_(\d+)/) || [, '0'])[1]
        const bn = (b.match(/seg_(\d+)/) || [, '0'])[1]
        return parseInt(an, 10) - parseInt(bn, 10)
      })
      // 统计会话占用 MB（UI 卡片展示）
      let sessionBytes = 0
      for (const f of segments) { try { sessionBytes += (fs.statSync(path.join(dir, f))?.size || 0) } catch (_) {} }
      // 会话首帧缩略图（seg_000 第 1 秒；ffmpeg 若可用就抽，失败就走空串，不阻塞 list）
      let thumbDataUri = ''
      const seg0 = segments.find(s => /^seg_0+\.webm$/i.test(s))
      if (seg0) {
        try {
          const ffmpeg = findFfmpeg()
          if (ffmpeg) {
            const tmpPng = path.join(dir, '_thumb.png')
            const { execFileSync } = require('child_process')
            execFileSync(ffmpeg, [
              '-y', '-ss', '1', '-i', path.join(dir, seg0),
              '-frames:v', '1', '-vf', 'scale=320:-1', tmpPng
            ], { timeout: 5000, windowsHide: true, stdio: 'ignore' })
            if (fs.existsSync(tmpPng)) {
              const raw = fs.readFileSync(tmpPng)
              thumbDataUri = 'data:image/png;base64,' + raw.toString('base64')
              try { fs.unlinkSync(tmpPng) } catch (_) {}
            }
          }
        } catch (_) { thumbDataUri = '' }
      }
      let meta
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        } catch (e) {
          // meta.json 损坏（写一半 / null bytes）→ 用 segments 兜底重建
          logger.warn('Rec', 'meta.json 损坏，重建', { sessionId, err: e?.message?.slice(0, 80) })
          meta = null
        }
      }
      if (!meta && segments.length) {
        // Day 2 P1-V2 孤儿恢复：目录里有 seg 文件但没 meta.json → 自动生成 meta.json 持久化，标 orphan:true，UI 上用户可再绑定
        let dirCreatedAt = Date.now()
        try { dirCreatedAt = fs.statSync(dir).birthtimeMs || fs.statSync(dir).mtimeMs || Date.now() } catch (_) {}
        // 尝试取第一个 seg 文件的 mtime 估算 duration（粗略）
        let firstTs = 0, lastTs = 0
        for (const f of segments) {
          try {
            const st = fs.statSync(path.join(dir, f))
            const t = (st.birthtimeMs || st.mtimeMs || 0)
            if (!firstTs || t < firstTs) firstTs = t
            if (!lastTs || t > lastTs) lastTs = t
          } catch (_) {}
        }
        const roughDurSec = (lastTs && firstTs && lastTs > firstTs) ? Math.max(10, Math.round((lastTs - firstTs) / 1000 + segments.length * 300)) : segments.length * 600
        meta = {
          sessionId,
          title: `恢复_${sessionId.slice(0, 8)}`,
          durationSec: roughDurSec,
          noteId: null,
          createdAt: new Date(dirCreatedAt).toISOString(),
          orphan: true,
          estimatedBytes: sessionBytes,
          segmentDurations: [],
          segmentStarts: [],
        }
        try { atomicWriteMeta(metaPath, meta) } catch (_) {}
      } else if (!meta) {
        // 既没 meta.json 又没 seg 文件 → 给个最小默认值，不影响任何东西
        meta = { sessionId, title: sessionId, orphan: false }
      }
      // 如果 meta.json 正常读取了 → meta 保持不变，noteId 等字段都在
      out.push({
        ...meta,
        segments: segments.map(f => `recordings/${sessionId}/${f}`),
        bytes: sessionBytes,
        thumb: thumbDataUri || '',
        segCount: segments.length,
      })
      } catch (innerErr) {
        logger.warn('Rec', 'listSessions 跳过目录', { sessionId, err: innerErr?.message?.slice(0, 80) })
        continue
      }
    }
    return out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map(s => { logger.info('Rec', 'listSessions', { sessionId: s.sessionId, noteId: s.noteId, segCount: s.segments?.length || 0, bytes: s.bytes || 0 }); return s })
  } catch (err) { logger.error('Rec', 'listSessions 异常', { err: err?.message }); return [] }
})

// 录屏占用统计 + 删除
// Day 3 P1-V4：统一计算函数（getUsage / 定时检查 / cleanupBefore 都走它，避免重复遍历目录）
let lastRecQuotaNotifiedAt = 0 // 1 小时最多推一次 overQuota，避免刷屏
function computeRecUsage() {
  const out = { sessions: 0, bytes: 0, items: [] } // items 给 cleanupBefore 用
  if (!fs.existsSync(RECORDINGS_DIR)) return out
  for (const sessionId of fs.readdirSync(RECORDINGS_DIR)) {
    const dir = path.join(RECORDINGS_DIR, sessionId)
    let st
    try { st = fs.statSync(dir) } catch (_) { continue }
    if (!st.isDirectory()) continue
    out.sessions++
    let sessionBytes = 0
    for (const f of fs.readdirSync(dir)) {
      try { const sz = fs.statSync(path.join(dir, f)).size; sessionBytes += sz } catch (_) {}
    }
    out.bytes += sessionBytes
    // createdAtTs：优先 meta.json 的 createdAt；否则退回目录 mtime（孤儿）
    let ts = (st.birthtimeMs || st.mtimeMs || 0)
    try {
      const metaPath = path.join(dir, 'meta.json')
      if (fs.existsSync(metaPath)) {
        const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        if (m.createdAt) { const t = new Date(m.createdAt).getTime(); if (t && isFinite(t)) ts = t }
      }
    } catch (_) {}
    out.items.push({ sessionId, bytes: sessionBytes, createdAtTs: ts })
  }
  return out
}
// Day 3 P1-V4：超阈值就 webContents.send('rec:overQuota')；一小时内最多 1 次
function maybeNotifyRecQuota() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) { /* has listener */ }
    const s = readJSON(settingsFile, {}) || {}
    const thresholdGB = Math.max(0.2, Number(s.recStorageWarnGB) || 2)
    const thresholdBytes = thresholdGB * 1024 * 1024 * 1024
    const info = computeRecUsage()
    if (info.bytes <= thresholdBytes) return
    const now = Date.now()
    if (now - lastRecQuotaNotifiedAt < 60 * 60 * 1000) return // 1h 内最多 1 次
    lastRecQuotaNotifiedAt = now
    logger.info('Rec', '录屏占用超阈值，推送通知', { bytes: info.bytes, thresholdGB })
    try {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('rec:overQuota', { bytes: info.bytes, thresholdGB })
    } catch (_) {}
  } catch (_) {}
}

ipcMain.handle('rec:getUsage', () => {
  try {
    const info = computeRecUsage()
    // Day 3 P1-V4：顺便做一次超阈值推送（Settings 点进来也能触发）
    setTimeout(maybeNotifyRecQuota, 50)
    return { sessions: info.sessions, bytes: info.bytes }
  } catch (err) { return { sessions: 0, bytes: 0 } }
})
// Day 3 P1-V4：清理创建时间早于 N 天前的录屏会话；返回 {removed, bytes}
ipcMain.handle('rec:cleanupBefore', (e, days) => {
  try {
    const d = Math.max(1, Math.min(3650, Math.round(Number(days) || 30)))
    const cutoff = Date.now() - d * 24 * 60 * 60 * 1000
    const info = computeRecUsage()
    let removed = 0
    let bytes = 0
    for (const it of info.items) {
      if (it.createdAtTs && it.createdAtTs < cutoff) {
        try {
          fs.rmSync(path.join(RECORDINGS_DIR, it.sessionId), { recursive: true, force: true })
          removed++
          bytes += it.bytes
        } catch (_) {}
      }
    }
    logger.info('Rec', '清理旧录屏完成', { days: d, cutoff, removed, bytes })
    return { removed, bytes }
  } catch (err) {
    logger.warn('Rec', '清理旧录屏失败', { err: err.message })
    return { removed: 0, bytes: 0 }
  }
})
ipcMain.handle('rec:deleteSession', (e, sessionId) => {
  try {
    fs.rmSync(path.join(RECORDINGS_DIR, sessionId), { recursive: true, force: true })
    return true
  } catch (err) { return false }
})
ipcMain.handle('rec:deleteAll', () => {
  try {
    fs.rmSync(RECORDINGS_DIR, { recursive: true, force: true })
    return true
  } catch (err) { return false }
})

// 本地视觉模型列表（设置页展示已安装的视觉模型）
ipcMain.handle('follow:listVisionModels', async () => {
  try {
    const { execFileSync } = require('child_process')
    const ollamaExe = findOllamaExe()
    if (!ollamaExe) return { all: [], vision: [] }
    const modelsDir = findOllamaModelsDir()
    const raw = execFileSync(ollamaExe, ['list'], {
      encoding: 'utf-8', timeout: 8000, windowsHide: true,
      env: modelsDir ? { ...process.env, OLLAMA_MODELS: modelsDir } : process.env,
    })
    const lines = String(raw).split(/\r?\n/).slice(1).filter(l => l.trim())
    const models = lines.map(l => l.trim().split(/\s+/)[0]).filter(Boolean)
    const vision = models.filter(m => /moondream|minicpm|llava|vision|vl$/i.test(m))
    return { all: models, vision }
  } catch (err) {
    return { all: [], vision: [] }
  }
})

// 下载本地视觉模型（ollama pull）
ipcMain.handle('follow:pullModel', async (e, model) => {
  try {
    const { execFileSync } = require('child_process')
    const ollamaExe = findOllamaExe()
    if (!ollamaExe) return false
    const modelsDir = findOllamaModelsDir()
    execFileSync(ollamaExe, ['pull', String(model).trim()], {
      timeout: 1800000, windowsHide: true, stdio: 'pipe',
      env: modelsDir ? { ...process.env, OLLAMA_MODELS: modelsDir } : process.env,
    })
    logger.info('Follow', '视觉模型下载完成', { model, modelsDir: modelsDir || '默认' })
    return true
  } catch (err) {
    logger.warn('Follow', '视觉模型下载失败', { err: err.message })
    return false
  }
})

// 打开录屏目录
ipcMain.handle('rec:openDir', () => {
  try {
    const { shell } = require('electron')
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
    shell.openPath(RECORDINGS_DIR)
    return true
  } catch { return false }
})

// 悬浮球 frame:false → Chromium 无法弹选窗 → 主进程弹独立 HTML 窗口（bubble-picker.html）让用户选
// 共享函数：弹选窗（列窗口/屏幕 + 缩略图 + 确认按钮），选中存 pickedDisplaySource
async function _pickDisplaySource() {
  return new Promise((resolve) => {
    let pickerWin = null
    let settled = false
    const done = (result) => {
      if (settled) return
      settled = true
      try { if (pickerWin && !pickerWin.isDestroyed()) pickerWin.close() } catch (_) {}
      try { ipcMain.removeListener('rec:pickResult', onPickResult) } catch (_) {}
      resolve(result)
    }
    const onPickResult = (event, payload) => {
      try {
        const r = payload || {}
        if (r.ok && r.id) {
          logger.info('DisplayMedia', '用户选窗结果', { name: r.name?.slice(0, 60), idPrefix: String(r.id).slice(0, 30) })
          pickedDisplaySource = { id: r.id, name: r.name }
          pickedDisplayName = r.name || ''
          done({ ok: true, id: r.id, name: r.name })
        } else {
          done({ ok: false, error: r.error || 'cancelled' })
        }
      } catch (e) {
        done({ ok: false, error: e.message })
      }
    }
    ipcMain.on('rec:pickResult', onPickResult)
    try {
      pickerWin = new BrowserWindow({
        width: 560, height: 480,
        frame: true, resizable: true,
        title: '选择要录制的窗口或屏幕',
        backgroundColor: '#1a1a2e',
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      })
      pickerWin.setMenuBarVisibility(false)
      pickerWin.once('closed', () => {
        try { ipcMain.removeListener('rec:pickResult', onPickResult) } catch (_) {}
        if (!settled) done({ ok: false, error: 'picker closed' })
      })
      // 改用 loadFile 加载独立 HTML —— data:text/html 在新版 Chromium 频繁被 CSP / webSecurity 拦截
      pickerWin.loadFile(path.join(__dirname, 'bubble-picker.html'))
        .catch((e) => {
          logger.error('DisplayMedia', '选窗页面加载失败', { err: e.message })
          done({ ok: false, error: 'loadFile failed: ' + e.message })
        })
    } catch (e) {
      logger.error('DisplayMedia', '_pickDisplaySource 异常', { err: e.message })
      done({ ok: false, error: e.message })
    }
  })
}

ipcMain.handle('rec:pickDisplaySource', () => _pickDisplaySource())

// 选窗页面拉取源：返回带缩略图的 sources 列表
ipcMain.handle('rec:getDisplaySources', async () => {
  try {
    const { desktopCapturer } = require('electron')
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 240, height: 150 } })
    return sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : '' }))
  } catch (e) {
    logger.warn('DisplayMedia', 'getDisplaySources 失败', { err: e.message })
    return []
  }
})

// ========== 录屏代理窗口（frame:true 跑 MediaRecorder） ==========
// 悬浮球 frame:false → Chromium 内部拒硬编码 sourceId → 开 frame:true 代理窗口真正录
// 代理页面存成 app/electron/rec-proxy.html（file:// 加载 = secure context → navigator.mediaDevices 可用）

// 共享：启动代理录屏窗口（rec:startProxyRecording + bubble:action rec 共用）
async function _startProxyRecording(sessionId) {
  return new Promise((resolve) => {
    try {
      recProxySessionId = sessionId
      logger.info('RecProxy', '准备启动代理', { sessionId })
      if (recProxyWin && !recProxyWin.isDestroyed()) { try { recProxyWin.close() } catch (_) {}; recProxyWin = null }
      const { session } = require('electron')
      const win = new (require('electron').BrowserWindow)({
        width: 100, height: 100,
        x: -1000, y: -1000,  // 放到屏幕外，用户看不见
        frame: true,
        show: true,
        resizable: false,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
          contextIsolation: false, nodeIntegration: true, sandbox: false,
          // 独立 session
          session: session.fromPartition('notestar-rec-proxy', { cache: false }),
        },
      })
      recProxyWin = win  // 全局引用，供外部 stop 使用
      // 注册 media 权限 handler + DisplayMedia handler（用 pickedDisplaySource 硬编码，文档第七节最终方案）
      const pSession = win.webContents.session
      pSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'media'))
      pSession.setPermissionCheckHandler((wc, permission) => permission === 'media')
      pSession.setDisplayMediaRequestHandler((request, callback) => {
        logger.info('DisplayMedia', '代理窗口收到 getDisplayMedia 请求')
        if (pickedDisplaySource) {
          const { desktopCapturer } = require('electron')
          desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
            .then(sources => {
              const src = sources.find(s => s.id === pickedDisplaySource.id) || sources[0]
              logger.info('DisplayMedia', '代理窗口 → callback({video: src})', { name: pickedDisplaySource.name?.slice(0, 60), found: !!src })
              if (src) { callback({ video: src, audio: 'loopback' }); return }
              logger.warn('DisplayMedia', '代理窗口 → 源未找到，跳过')
              callback({})
            })
            .catch(e => { logger.error('DisplayMedia', '代理 getSources 失败', { err: e.message }); callback({}) })
        } else {
          logger.warn('DisplayMedia', '代理窗口 → 没有预选 source，请先调 rec:pickDisplaySource')
          callback({})
        }
      })
      win.setMenuBarVisibility(false)
      win.once('closed', () => {
        logger.info('RecProxy', '代理窗口 closed')
        if (recProxyWin === win) recProxyWin = null  // 只清理自己的引用，不覆盖后续窗口
        recProxySessionId = null
        // 停掉跟拍识别循环并收尾（若有进行中的悬浮球跟拍会话；幂等，正常停录路径已先收过尾）
        stopRecFollowLoop()
        finishRecFollowSession()
        // 兜底：若代理窗口被外部关掉（手动关闭 /系统崩溃），状态机必须同步
        // 否则悬浮球永远显示"停止录屏"但实际无录制在跑，下次点击又会以"录制中"分支进入停止逻辑 → 错乱
        if (isBubbleRecording) {
          isBubbleRecording = false
          broadcastBubbleRecState()
          logger.warn('RecProxy', '代理被外部关闭，已强制同步 isBubbleRecording=false 并广播')
        }
      })
      // 监听代理发来的启动确认
      let startTimer = null
      let resolved = false
      const safeResolve = (result) => {
        if (resolved) return
        resolved = true
        if (startTimer) { clearTimeout(startTimer); startTimer = null }
        ipcMain.removeListener('rec-proxy:log', onLog)
        ipcMain.removeListener('rec-proxy:error', onError)
        resolve(result)
      }
      const onLog = (e, msg) => { if (msg && msg.includes('getDisplayMedia 成功')) onStartOk() }
      const onError = (e, msg) => {
        logger.error('RecProxy', '代理启动错误', { msg: String(msg) })
        try { if (!win.isDestroyed()) win.close() } catch (_) {}
        safeResolve({ ok: false, error: String(msg) })
      }
      const onStartOk = () => {
        logger.info('RecProxy', '代理确认启动成功')
        safeResolve({ ok: true })
      }
      ipcMain.on('rec-proxy:log', onLog)
      ipcMain.on('rec-proxy:error', onError)
      // 超时 15s
      startTimer = setTimeout(() => {
        logger.error('RecProxy', '代理启动超时')
        safeResolve({ ok: false, error: 'proxy startup timeout' })
      }, 15000)
      // 使用局部变量 win，避免全局 recProxyWin 被其他窗口的 closed 事件覆盖
      win.webContents.once('did-finish-load', () => {
        logger.info('RecProxy', '代理 did-finish-load, 发送 start 消息')
        setTimeout(() => {
          win.webContents.send('rec-proxy:start')
          logger.info('RecProxy', '已发送 rec-proxy:start')
        }, 500)
      })
      win.loadFile(path.join(__dirname, 'rec-proxy.html'))
    } catch (e) {
      logger.error('RecProxy', '启动异常', { err: e.message })
      resolve({ ok: false, error: e.message })
    }
  })
}

ipcMain.handle('rec:startProxyRecording', async (event, sessionId) => {
  return _startProxyRecording(sessionId)
})

ipcMain.handle('rec:stopProxyRecording', async () => {
  // 代理页通过 ipcRenderer.send('rec-proxy:done') 回传——必须用 ipcMain 监听，
  // 不能用 wc.once（那监听的是 webContents 事件，收不到 IPC 通道消息，会永远等 5s 兜底强关）
  return new Promise((resolve) => {
    if (!recProxyWin || recProxyWin.isDestroyed()) { resolve({ ok: true }); return }
    const wc = recProxyWin.webContents
    let settled = false
    let fallback = null
    const cleanup = () => {
      try { ipcMain.removeListener('rec-proxy:done', onDone) } catch (_) {}
      if (fallback) { clearTimeout(fallback); fallback = null }
    }
    const finish = (r) => {
      if (settled) return
      settled = true
      cleanup()
      try { if (recProxyWin && !recProxyWin.isDestroyed()) recProxyWin.close() } catch (_) {}
      resolve(r)
    }
    const onDone = () => {
      logger.info('RecProxy', '代理已停止（收到 done 确认）')
      finish({ ok: true })
    }
    ipcMain.once('rec-proxy:done', onDone)
    try { wc.send('rec-proxy:stop') } catch (_) { finish({ ok: true }); return }
    // 兜底：5s 内收不到 done 才强关（正常应即时收到 done）
    fallback = setTimeout(() => { finish({ ok: true }) }, 5000)
  })
})

// 代理窗口发来的日志 → 主日志
ipcMain.on('rec-proxy:log', (e, msg) => logger.info('RecProxy', msg))
ipcMain.on('rec-proxy:error', (e, msg) => logger.error('RecProxy', msg))

// 代理窗口快速截图的回复：根据 reqId resolve 对应的 awaiter
ipcMain.on('rec-proxy:capture-reply', (e, payload) => {
  try {
    const reqId = payload?.reqId
    const holder = reqId != null ? _capAwaiters.get(reqId) : null
    if (holder && holder.resolve) { _capAwaiters.delete(reqId); holder.resolve(payload || {}) }
  } catch (_) {}
})
// 清理过期的 screenshot awaiter（防止 recProxyWin 提前关闭导致永久挂起）
setInterval(() => {
  const NOW = Date.now()
  for (const [reqId, holder] of _capAwaiters.entries()) {
    if (holder && holder._expireAt && holder._expireAt <= NOW) {
      _capAwaiters.delete(reqId)
      try { holder.resolve && holder.resolve({ ok: false, reason: 'timeout' }) } catch (_) {}
    }
  }
}, 2000)

// 代理窗口发来的分段 → 直接存
ipcMain.on('rec-proxy:seg', (event, metaStr, buffer) => {
  try {
    const m = JSON.parse(metaStr)
    logger.info('RecProxy', '分段回传', { index: m.index, bytes: m.bytes, dur: parseFloat(m.durationSec).toFixed(1) })
    event.sender.send('rec-proxy:seg-ack', m.index)
    const segDir = path.join(RECORDINGS_DIR, recProxySessionId)
    fs.mkdirSync(segDir, { recursive: true })
    const segFile = path.join(segDir, `seg_${String(m.index).padStart(3, '0')}.webm`)
    fs.writeFileSync(segFile, Buffer.from(buffer))
    // 同步真实段时长到 segmentDurationsMap —— finishSession 靠它取每段真实秒数。
    // 否则代理段时长不走 rec:saveSegment 不会进 map，finishSession 只能拿「总时长/段数」均摊，
    // 使时间轴偏移（每段实际 5s，可能均摊成 7s+）→ 复习跳转错位。
    const darr = segmentDurationsMap.get(recProxySessionId) || []
    while (darr.length < m.index + 1) darr.push(0)
    darr[m.index] = parseFloat(m.durationSec) || 0
    segmentDurationsMap.set(recProxySessionId, darr)
    const metaPath = path.join(segDir, 'meta.json')
    let metaJson = {}
    try { if (fs.existsSync(metaPath)) metaJson = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) } catch (_) {}
    if (!metaJson.segments) metaJson.segments = []
    while (metaJson.segments.length < m.index + 1) metaJson.segments.push({ file: '', durationSec: 0 })
    metaJson.segments[m.index] = { file: `seg_${String(m.index).padStart(3, '0')}.webm`, durationSec: parseFloat(m.durationSec) }
    metaJson.sessionId = recProxySessionId
    metaJson.createdAt = metaJson.createdAt || new Date().toISOString()
    atomicWriteMeta(metaPath, metaJson)
    logger.info('RecProxy', '分段已存盘', { file: segFile, dur: parseFloat(m.durationSec).toFixed(1) + 's' })
  } catch (e) {
    logger.error('RecProxy', '分段存盘失败', { err: e.message })
  }
})

// ========== 笔记向量化（embedding）IPC ==========
// 跨课程知识网络核心：所有笔记生成向量存本地，AI 问答时先向量检索 Top-K
// 模型：本地 Ollama nomic-embed-text（137M, 768 维, 已部署）

// 单条 embed（笔记保存后自动调用）
ipcMain.handle('embed:one', async (e, note) => {
  if (!embeddingStore) return { ok: false, error: 'store 未初始化' }
  if (!note || !note.id) return { ok: false, error: 'note.id 缺失' }
  try {
    const r = await embedOne(embeddingStore, note)
    return { ok: !!r, dim: r ? r.dim : 0 }
  } catch (err) {
    logger.warn('Embed', '单条 embed 失败', { noteId: note.id, err: err.message })
    return { ok: false, error: err.message }
  }
})

// 删除 embedding（笔记删除时同步）
ipcMain.handle('embed:delete', (e, noteId) => {
  if (!embeddingStore || !noteId) return false
  embeddingStore.delete(noteId)
  return true
})

// 批量补全（启动时异步调用，缺的/过期的全补上）
ipcMain.handle('embed:batch', async (e, opts = {}) => {
  if (!embeddingStore) return { ok: false, error: 'store 未初始化' }
  try {
    const notes = readJSON(notesFile, []).filter(n => !n.deletedAt && (n.title || n.content))
    const r = await batchEmbed(embeddingStore, notes, { concurrency: opts.concurrency || 2 })
    logger.info('Embed', '批量补全完成', r)
    return { ok: true, ...r }
  } catch (err) {
    logger.warn('Embed', '批量补全失败', { err: err.message })
    return { ok: false, error: err.message }
  }
})

// 向量检索（AI 问答时调用，召回 Top-K 跨课程相关笔记）
ipcMain.handle('embed:search', async (e, { query, k = 5, minScore = 0.3, courseId = null } = {}) => {
  if (!embeddingStore) return []
  if (!query || typeof query !== 'string') return []
  try {
    const vec = await ollamaEmbed(query)
    return embedSearch(embeddingStore, vec, { k, minScore, courseId })
  } catch (err) {
    logger.warn('Embed', '向量检索失败', { err: err.message })
    return []
  }
})

// 状态查询（设置页展示）
ipcMain.handle('embed:status', () => {
  if (!embeddingStore) return { ok: false, model: EMBED_MODEL, dim: EMBED_DIM, count: 0 }
  return { ok: true, model: EMBED_MODEL, dim: EMBED_DIM, count: embeddingStore.size() }
})


ipcMain.handle('app:quit', () => {
  isQuitting = true
  app.quit()
  return true
})

// 应用版本信息（关于页展示）
ipcMain.handle('app:getVersion', () => {
  try {
    return {
      version: app.getVersion(),
      name: app.getName(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    }
  } catch {
    return { version: '', name: '', electron: '', chrome: '', node: '' }
  }
})

// 悬浮球展开/收起（窗口在右下角锚定，展开成操作面板）
let bubbleWindow = null  // 桌面悬浮球窗口（被误删后补回）
let isQuitting = false   // 是否正在退出（被误删后补回）
let voiceWindow = null   // 语音转文字独立窗口
let pickedDisplaySource = null  // 用户在选窗里选的 source
let pickedDisplayName = ''      // 用户选源的名字（返回给前端 UI 展示与笔记名）
let recProxyWin = null  // 录屏代理窗口（frame:true，真正跑 MediaRecorder）
let recProxySessionId = null  // 当前录屏会话 ID
let _capReqSeq = 0           // 快速截图 reqId 递增
const _capAwaiters = new Map() // reqId -> resolve（快截截图 awaiter）
// 悬浮球·新设计：球+面板共存于同一窗口
// 收起态：100×100 圆角矩形（球 100px）
// 展开态：392×340 容器（球+面板同存，由 CSS 控制面板显隐）
const BUBBLE_BALL_SIZE = 100        // 球直径 px
const BUBBLE_MARGIN    = 12         // 球到窗口右下边缘间距（与 bubble.html #ball right/bottom 一致）
const BUBBLE_BALL_OFF  = BUBBLE_MARGIN + Math.round(BUBBLE_BALL_SIZE / 2)  // 窗口右下角→球心偏移 = 62
const BUBBLE_COLLAPSED = { w: BUBBLE_BALL_SIZE + BUBBLE_MARGIN * 2, h: BUBBLE_BALL_SIZE + BUBBLE_MARGIN * 2 }  // 124×124
const BUBBLE_EXPANDED  = { w: 392, h: 340 }      // 球+面板整体容器
const BUBBLE_POS_FILE = () => path.join(localUserData, 'bubble-pos.json')

// 悬浮球位置记忆（存【球心】坐标；球在窗口内右下 12px+80/2=52 处，窗口中心会随展开/收起移动）
function readBubblePos() {
  try {
    if (fs.existsSync(BUBBLE_POS_FILE())) {
      return JSON.parse(fs.readFileSync(BUBBLE_POS_FILE(), 'utf-8'))
    }
  } catch (e) { /* ignore */ }
  return null
}
function saveBubblePos(ballCx, ballCy) {
  try {
    fs.mkdirSync(localUserData, { recursive: true })
    fs.writeFileSync(BUBBLE_POS_FILE(), JSON.stringify({ cx: ballCx, cy: ballCy }), 'utf-8')
  } catch (e) { /* ignore */ }
}
// 窗口左上角 → 球心（球在右下角：right 12px + 半径 50 → 距窗口右/下各 62px）
function windowXYToBallXY(x, y, w, h) {
  return { bx: x + w - BUBBLE_BALL_OFF, by: y + h - BUBBLE_BALL_OFF }
}
function ballXYToWindowXY(bx, by, w, h) {
  return { x: Math.round(bx - w + BUBBLE_BALL_OFF), y: Math.round(by - h + BUBBLE_BALL_OFF) }
}

// 用 Windows API SetWindowRgn 把窗口区域切成圆角/圆形，彻底去掉方形深色四角（黑边）
// ⚠️ 点击悬浮球崩溃根因修复：
//  之前 setBounds() 同步后立刻 spawn PowerShell 切 region，会与 Electron/Chromium 的 WM_SIZE 客户区布局竞争
//  → Chromium DWM 位图缓存还是旧尺寸（64×64），但 region 按新尺寸（~200×260）应用 → HWND 像素越界 AV 直接崩
// 修复：setBounds 之后 setTimeout(40ms) + 去抖 100ms，只做最后一次 region 变更，等 OS 窗口尺寸 settle 完再切
let _bubbleRegionTimer = null
let _bubbleDragOffset = null // 悬浮球拖动：按下时光标相对窗口左上角的偏移
function applyBubbleRegion(w, h) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  if (_bubbleRegionTimer) { clearTimeout(_bubbleRegionTimer); _bubbleRegionTimer = null }
  _bubbleRegionTimer = setTimeout(() => {
    _bubbleRegionTimer = null
    if (!bubbleWindow || bubbleWindow.isDestroyed()) return
    try {
      const { execFile } = require('child_process')
      const hwndBuf = bubbleWindow.getNativeWindowHandle()
      const hwndHex = hwndBuf.toString('hex')
      // 收起=小圆角方形（贴合 80×80 球+padding），展开=大圆角矩形（贴合 380×320 容器）
      // 异形策略：CSS 已经把面板做成完全圆角矩形，但面板外区域仍是透明的（panel.opacity=0 不占像素）
      //   所以收起时窗口可裁成 80×80 圆形，展开时裁成 380×320 圆角矩形
      //   但面板展开时是浮在球左侧的 CSS 布局（right:100px），所以整个窗口是包含球+面板的容器
      //   收起时仅显示球的范围：用 CreateRoundRectRgn + 不规则裁剪
      let ps
      if (w <= BUBBLE_COLLAPSED.w + 4) {
        // 收起态：裁成 100×100 圆角矩形（半径 26px）+ 每侧 4px 呼吸/悬停余量
        // 球 CSS 在右下角 12px 内（right/bottom:12, 100px）→ 相对窗口左上：
        //   ballX = w - 12 - 100 - 4（多裁 4px 让 scale(1.04) 呼吸不被硬切）
        const pad = 4
        const ballX = w - BUBBLE_BALL_SIZE - BUBBLE_MARGIN - pad
        const ballY = h - BUBBLE_BALL_SIZE - BUBBLE_MARGIN - pad
        const side = BUBBLE_BALL_SIZE + pad * 2
        const rad = 26
        ps = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinRegion { [DllImport("user32.dll")] public static extern bool SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw); [DllImport("gdi32.dll")] public static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int w, int h); [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int x1, int y1, int x2, int y2); [DllImport("gdi32.dll")] public static extern int CombineRgn(IntPtr dest, IntPtr src1, IntPtr src2, int mode); }'; $h = [IntPtr]::new([long]0x${hwndHex}); $rgnBall = [WinRegion]::CreateRoundRectRgn(${ballX}, ${ballY}, ${ballX + side}, ${ballY + side}, ${rad * 2}, ${rad * 2}); [WinRegion]::SetWindowRgn($h, $rgnBall, $true);`
      } else {
        // 展开态：裁成 392×340 大圆角矩形（半径 20px）
        const rad = 20
        ps = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinRegion { [DllImport("user32.dll")] public static extern bool SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw); [DllImport("gdi32.dll")] public static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int w, int h); }'; $h = [IntPtr]::new([long]0x${hwndHex}); $rgn = [WinRegion]::CreateRoundRectRgn(0, 0, ${w}, ${h}, ${rad * 2}, ${rad * 2}); [WinRegion]::SetWindowRgn($h, $rgn, $true);`
      }
      execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true, timeout: 3000 }, () => { /* 静默失败则保持现状 */ })
    } catch (e) { /* ignore */ }
  }, 40)
}

function setBubbleSize(w, h) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  const { screen } = require('electron')
  const { workArea } = screen.getPrimaryDisplay()
  let x, y
  const pos = readBubblePos()
  // 优先用记忆的【球心】保持球不跳，否则右下角锚定（球心 = 屏幕右下 - 24 边距 - 52）
  if (pos && pos.cx >= workArea.x && pos.cx <= workArea.x + workArea.width
    && pos.cy >= workArea.y && pos.cy <= workArea.y + workArea.height) {
    const wpos = ballXYToWindowXY(pos.cx, pos.cy, w, h)
    x = wpos.x
    y = wpos.y
  } else {
    x = workArea.x + workArea.width - w - 24
    y = workArea.y + workArea.height - h - 24
  }
  if (x < 0) x = 0
  if (y < 0) y = 0
  bubbleWindow.setBounds({ x, y, width: w, height: h })
  // ⚠️ 必须紧跟区域裁剪：否则窗口是方形透明块（内容/光晕外溢成"黄条"、挡住桌面）
  applyBubbleRegion(w, h)
  logger.info('Main', '悬浮球尺寸调整', { w, h, x, y })
}
ipcMain.handle('bubble:expand', (e, height) => {
  setBubbleSize(BUBBLE_EXPANDED.w, Math.max(BUBBLE_EXPANDED.h, parseInt(height) || BUBBLE_EXPANDED.h))
  return true
})
ipcMain.handle('bubble:collapse', () => {
  setBubbleSize(BUBBLE_COLLAPSED.w, BUBBLE_COLLAPSED.h)
  return true
})
// ========== 悬浮球拖动（JS 手动实现，替代 CSS -webkit-app-region，兼容性更稳） ==========
// dragStart: 记录按下时鼠标在窗口内的偏移（dx,dy = 光标 - 窗口左上角）
ipcMain.handle('bubble:dragStart', (e) => {
  try {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) return { ok: false }
    const { screen } = require('electron')
    const c = screen.getCursorScreenPoint()
    const [wx, wy] = bubbleWindow.getPosition()
    _bubbleDragOffset = { dx: c.x - wx, dy: c.y - wy }
    return { ok: true }
  } catch (_) { return { ok: false } }
})
// dragMove: 光标移到哪，窗口左上角就跟到 (光标 - 偏移)，并贴屏保边
ipcMain.handle('bubble:dragMove', (e, pos) => {
  try {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) return { ok: false }
    const { screen } = require('electron')
    const { workArea } = screen.getPrimaryDisplay()
    const c = pos && typeof pos.x === 'number'
      ? { x: pos.x, y: pos.y }
      : screen.getCursorScreenPoint()
    const off = _bubbleDragOffset || { dx: 40, dy: 40 }
    let nx = Math.round(c.x - off.dx)
    let ny = Math.round(c.y - off.dy)
    const [bw, bh] = bubbleWindow.getSize()
    // 限制在工作区内，避免拖出屏找不回
    nx = Math.max(workArea.x, Math.min(workArea.x + workArea.width - 40, nx))
    ny = Math.max(workArea.y, Math.min(workArea.y + workArea.height - 40, ny))
    bubbleWindow.setPosition(nx, ny)
    return { ok: true }
  } catch (_) { return { ok: false } }
})
// ========== 悬浮球录屏状态 ==========
let isBubbleRecording = false  // 悬浮球是否正在录屏
let isRecStarting = false      // 录屏启动中锁（防止重复点击）

// 向悬浮球广播录屏状态
  function broadcastBubbleRecState() {
    try {
      if (bubbleWindow && !bubbleWindow.isDestroyed() && bubbleWindow.webContents) {
        const [bw, _bh] = bubbleWindow.getSize()
        bubbleWindow.webContents.send('bubble:state', {
          open: bw >= BUBBLE_EXPANDED.w,
          recording: isBubbleRecording,
          toast: isBubbleRecording ? '录屏中…' : '',
        })
      }
    } catch (_) {}
  }

// ========== 悬浮球动作分发（bubble.html 菜单点击统一入口） ==========
ipcMain.handle('bubble:action', async (e, act) => {
  try {
    logger.info('Main', '悬浮球动作', { act })
    switch (act) {
      case 'capture':   // 截图笔记
        quickCaptureToNote()
        break
      case 'voice':     // 语音转文字
        openVoiceWindow()
        break
      case 'rec':       // 录屏笔记 → 直接从悬浮球启动录屏
        if (isBubbleRecording) {
          // 正在录制 → 停止录屏
          logger.info('Main', '悬浮球录屏 → 停止')
          isBubbleRecording = false
          broadcastBubbleRecState()
          try {
            if (recProxyWin && !recProxyWin.isDestroyed()) {
              recProxyWin.webContents.send('rec-proxy:stop')
              await new Promise(r => setTimeout(r, 1000))
              try { recProxyWin.close() } catch (_) {}
              recProxyWin = null
            }
          } catch (_) {}
          // 收尾：停识别循环、写会话 meta 绑定跟拍笔记（幂等，closed 钩子再兜一次）
          stopRecFollowLoop()
          finishRecFollowSession()
          // 显示主窗口并导航到笔记页查看录屏结果
          showMainWindowFromAnywhere()
          await waitForMainReady(1500)
          try {
            if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
              mainWindow.webContents.send('navigate', '/notes')
            }
          } catch (_) {}
        } else if (isRecStarting) {
          // 启动中，防重复点击
          logger.info('Main', '悬浮球录屏 → 启动中，忽略重复点击')
          return false
        } else {
          // 未录制 → 开始录屏
          logger.info('Main', '悬浮球录屏 → 开始')
          isRecStarting = true  // 锁住，防止重复点击
          try {
            // 1) 先弹 HTML 选窗让用户选窗口/屏幕（desktopCapturer.getSources + 缩略图 + 确认按钮）
            const pick = await _pickDisplaySource()
            if (!pick || !pick.ok || !pick.id) {
              logger.info('Main', '悬浮球录屏 → 用户取消选窗')
              return false
            }
            // 2) 启动代理录屏（代理 handler 用用户选的 pickedDisplaySource 硬编码）
            const sessionId = 'follow_' + Date.now()
            const startResult = await _startProxyRecording(sessionId)
            if (startResult && startResult.ok) {
              isBubbleRecording = true
              broadcastBubbleRecState()
              // 复刻"跟拍"设计：录屏启动即建跟拍笔记，边录边 30s 截帧识别追加条目
              recFollowSessionId = sessionId
              recFollowNoteId = createFollowNote(sessionId)
              recFollowStartTs = Date.now()
              startRecFollowLoop()
              logger.info('Main', '悬浮球录屏 → 代理启动成功（跟拍笔记已开）', { sessionId, noteId: recFollowNoteId })
            } else {
              logger.warn('Main', '悬浮球录屏 → 代理启动失败', { err: startResult?.error })
            }
          } finally {
            isRecStarting = false  // 解锁
          }
        }
        break
      case 'apps':      // 打开主界面
        showMainWindowFromAnywhere()
        break
      case 'quit':      // 退出应用
        isQuitting = true
        app.quit()
        break
      default:
        logger.warn('Main', '未知悬浮球动作', { act })
    }
    return true
  } catch (err) {
    logger.warn('Main', '悬浮球动作执行失败', { act, err: err.message })
    return false
  }
})

// ========== 语音转文字独立窗口 ==========
// 悬浮球"语音转文字笔记"打开独立窗口：显示录音状态 + 实时转写文字 + 保存笔记
// 打开语音转文字窗口（悬浮球 + 全局快捷键共用）
function openVoiceWindow() {
  if (voiceWindow && !voiceWindow.isDestroyed()) {
    try { voiceWindow.show(); voiceWindow.focus() } catch (e) { /* ignore */ }
    return true
  }
  try {
    const { screen } = require('electron')
    voiceWindow = new BrowserWindow({
      width: 440, height: 600,
      minWidth: 380, minHeight: 500,
      title: '语音转文字',
      backgroundColor: '#14101F',
      alwaysOnTop: true,   // 置顶，避免被主窗口/悬浮球遮挡
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    voiceWindow.removeMenu?.()
    voiceWindow.loadFile(path.join(__dirname, 'voice.html'))
    voiceWindow.once('ready-to-show', () => {
      try { voiceWindow.show(); voiceWindow.focus() } catch (e) { /* ignore */ }
    })
    voiceWindow.on('closed', () => { voiceWindow = null })
    // 窗口居中于【鼠标所在屏幕】（用户在哪操作就在哪弹出，避免多屏时弹到看不到的屏）
    try {
      const cursorPoint = screen.getCursorScreenPoint()
      const targetScreen = screen.getDisplayNearestPoint(cursorPoint)
      const { workArea } = targetScreen
      const b = voiceWindow.getBounds()
      voiceWindow.setPosition(
        Math.round(workArea.x + (workArea.width - b.width) / 2),
        Math.round(workArea.y + (workArea.height - b.height) / 2)
      )
      logger.info('Main', '语音转文字窗口位置', { screen: workArea, cursor: cursorPoint })
    } catch (e) { /* ignore */ }
    logger.info('Main', '语音转文字窗口已打开')
    return true
  } catch (e) {
    logger.warn('Main', '语音转文字窗口创建失败', { err: e.message })
    return false
  }
}
ipcMain.handle('voice:open', () => openVoiceWindow())

// ========== 全局快捷键 ==========
// Ctrl+Shift+R 语音转文字；Ctrl+Shift+S 截图前台窗口并创建笔记
function quickCaptureToNote() {
  try {
    const { desktopCapturer } = require('electron')
    const { execFileSync } = require('child_process')
    ;(async () => {
      try {
        // 获取前台窗口标题，匹配截取
        let targetId = ''
        let fgTitle = ''
        try {
          const psOut = execFileSync('powershell', [
            '-NoProfile', '-Command',
            'Add-Type @\"\nusing System;\nusing System.Runtime.InteropServices;\npublic class Win32 { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); }\n\"@; $h=[Win32]::GetForegroundWindow(); $sb=New-Object System.Text.StringBuilder 512; [Win32]::GetWindowText($h,$sb,512) | Out-Null; $sb.ToString()',
          ], { encoding: 'utf-8', timeout: 5000, windowsHide: true })
          fgTitle = String(psOut).trim()
        } catch (err) { /* ignore */ }
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1920, height: 1080 } })
        const matched = fgTitle
          ? sources.find(s => s.name.includes(fgTitle.slice(0, 30)) || fgTitle.includes(s.name.slice(0, 20)))
          : null
        const source = matched || sources.find(s => s.id.startsWith('screen:')) || sources[0]
        if (!source) return
        // 保存图片
        const dataUri = source.thumbnail.toDataURL()
        const b64 = String(dataUri).split(',')[1] || ''
        if (!b64) return
        const buf = Buffer.from(b64, 'base64')
        const filename = `shot_${Date.now()}.png`
        fs.writeFileSync(path.join(imagesDir, filename), buf)
        // 创建截图笔记
        const md = `## 📸 屏幕截图 ${new Date().toLocaleString()}\n\n![截图](images/${filename})\n`
        const note = {
          id: 'n' + Date.now(), title: `截图笔记 ${new Date().toLocaleTimeString()}`,
          courseId: '', tags: [], content: md,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          paragraphs: 2,
        }
        writeJSON(notesFile, [note, ...readJSON(notesFile, [])])
        logger.info('Screen', '快捷键截屏创建笔记', { filename, window: source.name })
        // 通知前端刷新（主窗口存在时）
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('notes:changed')
        }
      } catch (err) {
        logger.warn('Screen', '快捷键截屏失败', { err: err.message })
      }
    })()
  } catch (e) { /* ignore */ }
}

function registerGlobalShortcuts() {
  try {
    const { globalShortcut } = require('electron')
    globalShortcut.register('CommandOrControl+Shift+R', () => { openVoiceWindow() })
    globalShortcut.register('CommandOrControl+Shift+S', () => { quickCaptureToNote() })
    logger.info('Main', '全局快捷键已注册', { 'Ctrl+Shift+R': '语音转文字', 'Ctrl+Shift+S': '截图笔记' })
  } catch (e) {
    logger.warn('Main', '全局快捷键注册失败', { err: e.message })
  }
}
ipcMain.handle('voice:close', () => {
  try { if (voiceWindow && !voiceWindow.isDestroyed()) voiceWindow.close() } catch (e) { /* ignore */ }
  return true
})

function createBubbleWindow() {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) return
  const { screen } = require('electron')
  const { workArea } = screen.getPrimaryDisplay()
  const size = BUBBLE_COLLAPSED.w
  // 初始位置：优先记忆【球心】，否则右下角锚定
  const pos = readBubblePos()
  let bx = workArea.x + workArea.width - size - 24
  let by = workArea.y + workArea.height - size - 24
  if (pos && pos.cx >= workArea.x && pos.cx <= workArea.x + workArea.width
    && pos.cy >= workArea.y && pos.cy <= workArea.y + workArea.height) {
    const wpos = ballXYToWindowXY(pos.cx, pos.cy, size, size)
    bx = wpos.x
    by = wpos.y
  }
  bubbleWindow = new BrowserWindow({
    width: size, height: size,
    x: bx, y: by,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 必须关闭 sandbox：preload 需 require('./ipc-constants.cjs')，
      // 沙箱模式下 preload 只能加载内置模块，本地文件 require 会失败 → noteAPI 缺失
      sandbox: false,
      // 独立 session → 不跟主窗口抢 defaultSession 的 DisplayMedia handler
      session: session.fromPartition('notestar-bubble', { cache: false }),
    },
  })
  bubbleWindow.loadFile(path.join(__dirname, 'bubble.html'))
  // 初次创建后立刻裁圆角（否则首帧是方形透明窗口，黑角/内容外溢）
  setTimeout(() => { applyBubbleRegion(size, size) }, 120)
  // 展开/收起状态广播（bubble.html onBubbleState 用）
  const broadcastBubbleState = () => {
    try {
      if (bubbleWindow && !bubbleWindow.isDestroyed() && bubbleWindow.webContents) {
        const [bw, bh] = bubbleWindow.getSize()
        bubbleWindow.webContents.send('bubble:state', {
          open: bw >= BUBBLE_EXPANDED.w,
          recording: isBubbleRecording,
          toast: isBubbleRecording ? '录屏中…' : '',
        })
      }
    } catch (_) {}
  }
  bubbleWindow.on('resize', broadcastBubbleState)
  // 页面加载完成后立刻推一次初始状态（解决"重连后看不到当前录制态"）
  bubbleWindow.webContents.once('did-finish-load', () => {
    broadcastBubbleState()
    logger.info('Bubble', '初始状态已推送', { recording: isBubbleRecording })
  })
  const bSession = bubbleWindow.webContents.session
  // 独立 session 需要自己注册 media 权限 + DisplayMedia handler
  try {
    bSession.setPermissionRequestHandler((wc, permission, callback) => {
      logger.info('Media', 'bubble 权限请求', { permission })
      callback(permission === 'media')
    })
    bSession.setPermissionCheckHandler((wc, permission) => permission === 'media')
    bSession.setDisplayMediaRequestHandler((request, callback) => {
      if (pickedDisplaySource) {
        logger.info('DisplayMedia', '悬浮球 → 用用户选的 source', { name: pickedDisplaySource.name?.slice(0, 60) })
        desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
          .then(sources => {
            const src = sources.find(s => s.id === pickedDisplaySource.id) || sources[0]
            if (src) { callback({ video: src, audio: 'loopback' }); return }
            callback({})
          })
          .catch(() => callback({}))
      } else {
        logger.warn('DisplayMedia', '悬浮球录屏 → 没有预选 source，请先调 rec:pickDisplaySource')
        callback({})
      }
    })
  } catch (_) { /* ignore */ }
  bubbleWindow.setAlwaysOnTop(true, 'screen-saver')
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // 拖拽移动后记忆位置（球心：从窗口矩形换算）
  bubbleWindow.on('moved', () => {
    try {
      const [bx, by] = bubbleWindow.getPosition()
      const [bw, bh] = bubbleWindow.getSize()
      const c = windowXYToBallXY(bx, by, bw, bh)
      saveBubblePos(c.bx, c.by)
    } catch (e) { /* ignore */ }
  })
  bubbleWindow.on('closed', () => {
    bubbleWindow = null
    // 悬浮球关闭 = 退出应用
    if (!isQuitting) {
      isQuitting = true
      app.quit()
    }
  })
  // 宠物窗口：透明方形，不裁剪
  logger.info('Main', '桌面悬浮球已创建')
}

// 麦克风权限（悬浮球语音笔记用）
function setupMediaPermission() {
  const { session, desktopCapturer } = require('electron')
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    logger.info('Media', '权限请求', { permission, url: String(wc.getURL() || '').slice(0, 60) })
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((wc, permission) => permission === 'media')
  // getDisplayMedia 支持：电脑声音（系统音频 loopback）捕获。
  // 注意：Electron 30 要求 callback 的 video 为单个 DesktopCapturerSource（数组会报
  // "video must be a WebFrameMain or DesktopCapturerSource"），且不会自动弹选择框。
  // 系统音频是全局的（loopback），默认用主屏幕源即可，无需用户选择。
  try {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      const frame = request.frame
      const url = frame?.url || ''
      // bubble.html 里调 getDisplayMedia → 悬浮球 frame:false 小窗口，Chrome 拒硬编码 sourceId
      // 让 Chromium 弹原生选窗选择器，用户手动选一次
      if (url.includes('bubble.html') || (bubbleWindow && !bubbleWindow.isDestroyed() && frame?.processId === bubbleWindow.webContents.mainFrame.processId)) {
        logger.info('DisplayMedia', '悬浮球录屏请求 → 弹原生选择器让用户选窗')
        try { callback() } catch (_) { callback({}) }
        return
      }
      desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
        .then(sources => {
          const screenSrc = sources.find(s => s.id.startsWith('screen:')) || sources[0]
          if (!screenSrc) { callback({}); return }
          callback({ video: screenSrc, audio: 'loopback' })
        })
        .catch((e) => {
          logger.warn('Media', 'getDisplayMedia 获取源失败', { err: e.message })
          callback({})
        })
    })
    logger.info('Media', 'getDisplayMedia handler 已注册（系统音频捕获）')
  } catch (e) {
    logger.warn('Media', 'setDisplayMediaRequestHandler 不可用', { err: e.message })
  }
}

// ========== 本地 Ollama 路径探测（多 fallback，所有 ollama 调用共用） ==========
// 探测顺序：环境变量 → 打包后 resources/Ollama → 项目根 Ollama → e:\ai12 → 系统安装
// 同一份逻辑供 ensureOllamaService / follow:listVisionModels / follow:pullModel 共用
function findOllamaExe() {
  const candidates = [
    process.env.OLLAMA_EXE,
    process.resourcesPath ? path.join(process.resourcesPath, 'Ollama', 'ollama.exe') : '',
    path.join(__dirname, '..', '..', 'Ollama', 'ollama.exe'),
    'E:/ai12/Ollama/ollama.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
  ].filter(Boolean)
  return candidates.find(p => fs.existsSync(p)) || null
}

function findOllamaModelsDir() {
  const candidates = [
    process.env.OLLAMA_MODELS,
    process.resourcesPath ? path.join(process.resourcesPath, 'Ollama', 'models') : '',
    path.join(__dirname, '..', '..', 'Ollama', 'models'),
    'E:/ai12/Ollama/models',
  ].filter(Boolean)
  return candidates.find(d => fs.existsSync(d)) || null
}

// 自动拉起本地 Ollama 服务（若 11434 端口未监听）。不影响窗口创建，异步执行。
function ensureOllamaService() {
  const net = require('net')
  const probe = net.connect({ host: '127.0.0.1', port: 11434 })
  probe.setTimeout(1500)
  probe.on('connect', () => { probe.destroy(); logger.info('Local', 'Ollama 服务已就绪') })
  probe.on('timeout', () => { probe.destroy() })
  probe.on('error', () => {
    probe.destroy()
    const exe = findOllamaExe()
    if (!exe) {
      logger.warn('Local', '未找到 Ollama，本地模型不可用（可到 ollama.com 安装）')
      return
    }
    const modelsDir = findOllamaModelsDir()
    const env = { ...process.env }
    if (modelsDir) env.OLLAMA_MODELS = modelsDir
    try {
      const child = spawn(exe, ['serve'], { detached: true, stdio: 'ignore', env })
      child.unref()
      logger.info('Local', '已自动启动 Ollama 服务', { exe, modelsDir: modelsDir || '默认' })
    } catch (e) {
      logger.warn('Local', '自动启动 Ollama 失败', { error: e.message })
    }
  })
}

// ========== 复习到期提醒（遗忘曲线） ==========
const QUIZ_MASTERY_FILE = path.join(dataDir, 'quizMastery.json')
const REVIEW_NOTIFY_FILE = () => path.join(localUserData, 'review-last-notify.json')

// 每小时检查：有到期题目 → 系统通知（同一天只提醒一次，点击跳复习页）
function checkReviewReminders() {
  try {
    if (!fs.existsSync(QUIZ_MASTERY_FILE)) return
    const map = JSON.parse(fs.readFileSync(QUIZ_MASTERY_FILE, 'utf-8')) || {}
    const due = Object.values(map).filter(s => s.nextReviewAt && s.nextReviewAt <= new Date().toISOString())
    if (due.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    const last = fs.existsSync(REVIEW_NOTIFY_FILE()) ? JSON.parse(fs.readFileSync(REVIEW_NOTIFY_FILE(), 'utf-8')) : ''
    if (last === today) return
    fs.mkdirSync(localUserData, { recursive: true })
    fs.writeFileSync(REVIEW_NOTIFY_FILE(), JSON.stringify(today), 'utf-8')
    const { Notification } = require('electron')
    if (Notification.isSupported()) {
      const n = new Notification({
        title: '📚 复习提醒',
        body: `你有 ${due.length} 道题目到期待复习，点击查看`,
      })
      n.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show(); mainWindow.focus()
          mainWindow.webContents.send('navigate', '/quiz')
        }
      })
      n.show()
      logger.info('Review', '发送复习提醒', { due: due.length })
    }
  } catch (e) { /* ignore */ }
}

let recHttpServer = null
// meta.json 原子写入：先写临时文件再 rename 替换，避免录制并发/进程中断产生 0 字节或半截文件
function atomicWriteMeta(metaPath, obj) {
  try {
    const s = JSON.stringify(obj, null, 2)
    if (!s) return
    const tmp = metaPath + '.tmp'
    fs.writeFileSync(tmp, s, 'utf-8')
    fs.renameSync(tmp, metaPath)
  } catch (_) {}
}
// 本地录屏 HTTP 服务：Electron 的 <video> 媒体管线不加载 protocol.handle 自定义协议，
// 必须走真实 HTTP 才能流式播放，因此这里为 recordings 目录提供支持 Range(206) 的本地服务。
// 前端播放地址：http://127.0.0.1:8200/rec/<sessionId>/<file>
function startRecHttpServer() {
  const http = require('http')
  const PORT = 8200
  if (recHttpServer) return recHttpServer
  recHttpServer = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1')
      const parts = u.pathname.replace(/^\/+/, '').split('/') // ['rec', sessionId, file]
      if (parts[0] !== 'rec' || parts.length < 3) { res.writeHead(404); res.end('not found'); return }
      const sessionId = parts[1]
      const file = parts.slice(2).join('/')
      if (!/^[\w-]+$/.test(sessionId) || file.includes('..')) { res.writeHead(400); res.end('bad request'); return }
      const fp = path.join(RECORDINGS_DIR, sessionId, path.basename(file))
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end('no such file'); return }
      const size = fs.statSync(fp).size
      const ext = path.extname(fp).toLowerCase()
      const mime = ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : 'application/octet-stream'
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', mime)
      const range = req.headers.range
      if (range) {
        const mt = /bytes=(\d*)-(\d*)/.exec(range)
        let start = mt && mt[1] ? parseInt(mt[1], 10) : 0
        let end = mt && mt[2] ? parseInt(mt[2], 10) : size - 1
        if (isNaN(start) || start < 0) start = 0
        if (isNaN(end) || end >= size) end = size - 1
        if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return }
        res.writeHead(206, { 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}` })
        fs.createReadStream(fp, { start, end }).pipe(res)
      } else {
        res.writeHead(200, { 'Content-Length': size })
        fs.createReadStream(fp).pipe(res)
      }
      logger.info('RecHttp', '播放请求', { sessionId, file, size, range: range || 'full' })
    } catch (e) {
      logger.error('RecHttp', '服务异常', { err: e.message })
      try { res.writeHead(500); res.end('err') } catch (_) { /* ignore */ }
    }
  })
  recHttpServer.on('error', (e) => logger.error('RecHttp', '监听失败', { err: e.message }))
  recHttpServer.listen(PORT, '127.0.0.1', () => logger.info('RecHttp', `录屏 HTTP 服务已启动 :${PORT}`))
  return recHttpServer
}

app.whenReady().then(() => {
  logger.info('Main', 'Electron 初始化完成，准备创建窗口')
  ensureDataDir()
  ensureOllamaService() // 自动拉起本地模型服务（未运行时）
  // 启动期异步：批量补全 embedding（缺的/过期的全补上，不阻塞窗口）
  if (embeddingStore) {
    setTimeout(() => {
      try {
        const notes = readJSON(notesFile, []).filter(n => !n.deletedAt && (n.title || n.content))
        batchEmbed(embeddingStore, notes, { concurrency: 1 }).then(r => {
          logger.info('Embed', '启动期补全', r)
        }).catch(e => logger.warn('Embed', '启动期补全失败', { err: e.message }))
      } catch (e) { /* 不致命 */ }
    }, 5000) // 延迟 5s 让 Ollama / 其他服务先就绪
  }
  buildMenu() // 设置应用菜单
  purgeExpiredDeletedNotes() // 清理回收站过期笔记
  registerImageProtocol() // 注册图片外置存储协议
  registerRecordingProtocol() // 注册录屏播放协议
  startRecHttpServer() // 本地录屏 HTTP 服务（<video> 流式播放；媒体管线不走自定义协议）
  setupMediaPermission() // 麦克风权限（悬浮球语音笔记）
  createBubbleWindow() // 桌面悬浮球
  createTray() // 系统托盘（后台可见，右键可退出）
  registerGlobalShortcuts() // 全局快捷键
  checkReviewReminders() // 启动时检查复习到期
  setInterval(checkReviewReminders, 60 * 60 * 1000) // 每小时检查
  // Day 3 P1-V4：录屏占用超阈值定时检查（启动 60s 首次，之后每 1h）
  setTimeout(() => { maybeNotifyRecQuota() }, 60 * 1000)
  setInterval(() => { maybeNotifyRecQuota() }, 60 * 60 * 1000)
  // 不再初始化种子数据 — 用户从零开始
  if (!fs.existsSync(notesFile)) writeJSON(notesFile, [])
  if (!fs.existsSync(coursesFile)) writeJSON(coursesFile, [])
  if (!fs.existsSync(chatFile)) writeJSON(chatFile, [])
  if (!fs.existsSync(statsFile)) writeJSON(statsFile, { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] })
  if (!fs.existsSync(settingsFile)) writeJSON(settingsFile, { apiKey: '', model: 'deepseek-chat', provider: 'deepseek' })

  // 启动迁移：将历史明文 API Key 加密存储（幂等，enc: 前缀跳过）
  const legacySettings = readJSON(settingsFile, {})
  if (legacySettings.apiKey && !String(legacySettings.apiKey).startsWith('enc:')) {
    saveSettings(legacySettings)
    flushWrite(settingsFile) // 立即落盘，确保迁移生效
    logger.info('Main', '已迁移明文 API Key 为 safeStorage 加密存储')
  }

  createWindow()
  autoUpdater.startAutoCheck() // 启动自动更新模块（延迟 5s 后台检查）
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

}).catch((error) => {
  logger.error('Main', 'Electron 初始化失败', { message: error.message, stack: error.stack })
  dialog.showErrorBox('应用启动失败', `初始化过程中发生错误：${error.message}`)
  app.exit(1)
})

// ========== 应用菜单（被误删后重建） ==========
function buildMenu() {
  try {
    const menu = Menu.buildFromTemplate([
      { label: '文件', submenu: [{ label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit() } }] },
      { label: '编辑', role: 'editMenu' },
      { label: '视图', role: 'viewMenu' },
    ])
    Menu.setApplicationMenu(menu)
  } catch (e) {
    logger.warn('Main', '菜单创建失败', { err: e.message })
  }
}

// ========== createWindow（最小重建版） ==========
function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show(); mainWindow.focus()
    return
  }
  try {
    const { screen } = require('electron')
    // 默认窗口 1440×900，但若屏幕工作区更小则自动收缩（避免窗口超出屏幕导致内容显示不全）
    const wa = screen.getPrimaryDisplay().workArea
    const PAD = 40  // 距屏幕边缘留白
    const wantW = 1440, wantH = 900
    const maxW = Math.max(1024, wa.width - PAD)
    const maxH = Math.max(700, wa.height - PAD)
    const winW = Math.min(wantW, maxW)
    const winH = Math.min(wantH, maxH)
    // 居中
    const winX = Math.max(wa.x, wa.x + Math.round((wa.width - winW) / 2))
    const winY = Math.max(wa.y, wa.y + Math.round((wa.height - winH) / 2))
    logger.info('Main', '主窗口尺寸自适应', { workArea: wa, win: [winW, winH], at: [winX, winY] })
    mainWindow = new BrowserWindow({
      width: winW, height: winH,
      x: winX, y: winY,
      minWidth: Math.min(1024, winW), minHeight: Math.min(700, winH),
      title: 'NoteAnalysis',
      backgroundColor: '#F8F4FE',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    mainWindow.removeMenu?.()
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173/')
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }
    mainWindow.once('ready-to-show', () => {
      try { mainWindow.show() } catch (e) { /* ignore */ }
    })
    mainWindow.webContents.on('did-finish-load', () => {
      logger.info('Main', '页面加载完成')
    })
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      logger.error('Main', '页面加载失败', { errorCode, errorDescription })
    })
    mainWindow.on('closed', () => {
      if (!isQuitting && bubbleWindow && !bubbleWindow.isDestroyed()) bubbleWindow.show()
      mainWindow = null
    })
    // Day 3 P0-V2：拦截 getDisplayMedia 原生选择器 → 自定义卡片 picker + 记忆源自动跳过
    setupDisplayMediaHandler(mainWindow)
    if (process.env.DEBUG) mainWindow.webContents.openDevTools()
  } catch (e) {
    logger.error('Main', 'createWindow 失败', { message: e.message, stack: e.stack })
    dialog.showErrorBox('窗口创建失败', e.message)
  }
}

// ========== 系统托盘（后台可见入口：显示窗口 / 退出） ==========
let tray = null
// 悬浮球/托盘「打开主界面」：显示或重建主窗口
ipcMain.handle('app:showMain', () => { showMainWindowFromAnywhere(); return true })
// 悬浮球/语音等后台创建新笔记后：显示主窗口 + 通知渲染端跳到指定笔记
async function waitForMainReady(maxMs = 2500) {
  const start = Date.now()
  while (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (mainWindow.webContents && typeof mainWindow.webContents.isLoading === 'function'
        && !mainWindow.webContents.isLoading()) return true
    } catch (_) {}
    if (Date.now() - start > maxMs) break
    await new Promise(r => setTimeout(r, 50))
  }
  return true
}
ipcMain.handle('notes:openInMain', async (e, noteId) => {
  logger.info('Main', 'notes:openInMain 收到请求', { noteId, hasMainWindow: !!(mainWindow && !mainWindow.isDestroyed()) })
  showMainWindowFromAnywhere()
  const ready = await waitForMainReady()
  logger.info('Main', 'notes:openInMain 主窗口就绪', { ready, noteId })
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('notes:open', noteId)
      logger.info('Main', 'notes:openInMain 已广播给渲染端', { noteId })
    } else {
      logger.warn('Main', 'notes:openInMain 广播失败：主窗口不存在', { noteId })
    }
  } catch (err) {
    logger.error('Main', 'notes:openInMain 广播异常', { noteId, err: err && err.message ? err.message : String(err) })
  }
  return true
})
function showMainWindowFromAnywhere() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
}
function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
    if (!fs.existsSync(iconPath)) { logger.warn('Main', '托盘图标不存在，跳过托盘创建'); return }
    tray = new Tray(iconPath)
    tray.setToolTip('笔记星图')
    const menu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => showMainWindowFromAnywhere() },
      { type: 'separator' },
      { label: '退出', click: () => { isQuitting = true; app.quit() } },
    ])
    tray.setContextMenu(menu)
    tray.on('click', () => showMainWindowFromAnywhere())
    logger.info('Main', '系统托盘已创建')
  } catch (e) {
    logger.warn('Main', '托盘创建失败（忽略）', { error: e.message })
  }
}

// ========== 单例锁 — 防止多实例运行导致数据冲突 ==========
// 注意：second-instance → relaunch 存在竞态——新实例启动时会触发仍存活旧实例的
// second-instance，旧实例又 relaunch，多个实例并存时可能形成互相重启的无限循环。
// 因此用 userData 下的跨进程防抖标记：4 秒内只允许一次重启，阻断循环。
const RESTART_MARKER_FILE = () => path.join(app.getPath('userData'), 'restart-marker.json')
function isRestartCooldown() {
  try {
    if (fs.existsSync(RESTART_MARKER_FILE())) {
      const m = JSON.parse(fs.readFileSync(RESTART_MARKER_FILE(), 'utf-8'))
      if (m && typeof m.at === 'number' && Date.now() - m.at < 4000) return true
    }
  } catch (e) { /* 标记损坏则放行 */ }
  return false
}
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (isRestartCooldown()) {
      logger.info('Main', '检测到连续重复启动，忽略本次（防重启循环）')
      // 无论如何把已有窗口带到前台，保证用户能看到应用
      try { showMainWindowFromAnywhere() } catch (e) { /* ignore */ }
      return
    }
    try { fs.writeFileSync(RESTART_MARKER_FILE(), JSON.stringify({ at: Date.now(), pid: process.pid }), 'utf-8') } catch (e) { /* ignore */ }
    // 双击启动器 = 重启：先关闭旧实例，再重新打开，保证永远只有一个窗口在运行
    logger.info('Main', '检测到重复启动，执行重启（关闭旧实例并重新打开）')
    app.relaunch()
    app.exit(0)
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 真正退出时绕过主窗口的"关闭→隐藏"拦截
app.on('before-quit', () => {
  isQuitting = true
})

// 退出前强制落盘所有防抖写入，避免数据丢失
app.on('will-quit', () => {
  flushAllWrites()
  // 关闭常驻转写服务
  try {
    if (whisperServer && !whisperServer.killed) {
      whisperServer.stdin.end()
      whisperServer.kill()
    }
  } catch (e) { /* ignore */ }
})
