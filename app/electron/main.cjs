// Electron 主进程 - 本地数据后端 + AI 接口
const { app, BrowserWindow, ipcMain, dialog, safeStorage, protocol, net, Tray, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { pathToFileURL } = require('url')
const { HttpsProxyAgent } = require('https-proxy-agent')

// 禁用 Chromium sandbox：本机（搜狗输入法等注入组件/系统安全机制）与 sandbox 冲突，
// 会导致渲染进程启动即被杀（0x80000003 断点异常，reason: killed）。必须在 app ready 前生效。
app.commandLine.appendSwitch('no-sandbox')
app.disableHardwareAcceleration()

// 图片外置存储自定义协议（必须在 app ready 前注册）
protocol.registerSchemesAsPrivileged([
  { scheme: 'notestar-img', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

// ========== 日志系统 ==========
let mainWindow = null  // 提前声明，避免 TDZ 问题

const logDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR']
const LEVEL_COLORS = { DEBUG: '#9B9BB5', INFO: '#4292F5', WARN: '#F39C12', ERROR: '#E74C3C' }
let currentLogLevel = LOG_LEVELS.INFO // 默认 INFO 级别

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

  // 同时输出到控制台
  if (level >= LOG_LEVELS.ERROR) {
    console.error(logLine.trimEnd())
  } else if (level >= LOG_LEVELS.WARN) {
    console.warn(logLine.trimEnd())
  } else {
    console.log(logLine.trimEnd())
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

// GPU 兼容模式：部分 Windows 环境的 GPU 沙箱会导致渲染进程退出。
// 注意：in-process-gpu 与 disable-gpu 语义冲突，会引发渲染进程崩溃，故不启用。
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-gpu-sandbox')

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

// 统一读取设置（解密 apiKey）
function readSettings() {
  const saved = readJSON(settingsFile, { apiKey: '', model: 'deepseek-chat', provider: 'deepseek' })
  if (!saved.provider) saved.provider = 'deepseek'
  if (saved.apiKey) saved.apiKey = decryptSecret(saved.apiKey)
  return saved
}

// 统一保存设置（加密 apiKey）
function saveSettings(settings) {
  const toStore = { ...settings }
  if (toStore.apiKey) toStore.apiKey = encryptSecret(toStore.apiKey)
  writeJSON(settingsFile, toStore, { debounce: WRITE_DEBOUNCE_MS })
}

// ========== IPC: 设置 ==========
ipcMain.handle('settings:get', () => readSettings())
ipcMain.handle('settings:save', (event, settings) => {
  saveSettings(settings)
  return true
})

// ========== IPC: 测试 API 连通性 ==========
// 返回 { success: boolean, message: string, models?: string[] }
ipcMain.handle('ai:testConnection', async (event, { provider, apiKey, hostname, apiPath }) => {
  const p = provider || 'deepseek'
  const platform = AI_PLATFORMS[p] || AI_PLATFORMS.deepseek
  // 本地模型不需要 API Key
  if (!apiKey && p !== 'local') return { success: false, message: '请先填写 API Key' }

  const host = hostname || platform.hostname
  const basePath = (apiPath || platform.apiPath).replace(/\/chat\/completions.*$/, '')

  // 大多数 OpenAI 兼容平台支持 GET /v1/models 或 GET /models 获取模型列表
  // NVIDIA: /v1/models, OpenAI: /v1/models, DeepSeek: /models, 智谱: /api/paas/v4/models
  let modelsPath
  if (basePath.includes('/v1')) {
    modelsPath = basePath.replace(/\/chat\/completions$/, '') + '/models'
  } else if (basePath.includes('/v4')) {
    modelsPath = basePath.replace(/\/chat\/completions$/, '') + '/models'
  } else if (basePath.includes('/compatible-mode')) {
    modelsPath = basePath.replace(/\/chat\/completions$/, '') + '/models'
  } else {
    modelsPath = basePath + '/models'
  }

  const isLocal = platform.protocol === 'http' || p === 'local'
  const httpMod = isLocal ? require('http') : https
  const port = platform.port || (isLocal ? 80 : 443)

  logger.info('AI', '测试连通性', { provider: p, hostname: host, port, modelsPath })

  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port,
      path: modelsPath,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }
    if (!platform.noAuth) {
      options.headers['Authorization'] = `Bearer ${apiKey}`
    }

    // 云端请求使用系统代理；本地回环请求不走代理
    if (!isLocal) {
      const proxyAgent = getProxyAgent()
      if (proxyAgent) options.agent = proxyAgent
    }

    const req = httpMod.request(options, (res) => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body)
            const models = (data.data || data.models || []).map(m => m.id || m.name).filter(Boolean)
            logger.info('AI', '连通性测试成功', { modelCount: models.length })
            resolve({
              success: true,
              message: `连接成功！共 ${models.length} 个可用模型`,
              models: models,
            })
          } catch (e) {
            resolve({ success: true, message: '连接成功（但模型列表解析失败）', models: [] })
          }
        } else {
          const errPreview = body.substring(0, 200)
          logger.error('AI', '连通性测试失败', { status: res.statusCode, body: errPreview })
          resolve({
            success: false,
            message: `连接失败：HTTP ${res.statusCode}${errPreview ? ' — ' + errPreview : ''}`,
          })
        }
      })
    })

    req.on('error', (e) => {
      logger.error('AI', '连通性测试网络错误', { error: e.message })
      resolve({ success: false, message: `网络错误：${e.message}` })
    })

    req.setTimeout(10000, () => {
      req.destroy()
      resolve({ success: false, message: '连接超时（10秒），请检查网络或代理设置' })
    })

    req.end()
  })
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
ipcMain.handle('images:save', async (e, dataUri) => {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
    throw new Error('无效的图片数据')
  }
  const match = dataUri.match(/^data:(image\/(png|jpe?g|gif|webp|svg\+xml));?(base64)?,(.*)$/s)
  if (!match) throw new Error('不支持的图片格式')
  const mimeType = match[1]
  const isBase64 = !!match[2]
  const payload = match[3]

  const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }
  const ext = extMap[mimeType] || 'png'
  const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
  const filePath = path.join(imagesDir, filename)

  const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf-8')
  fs.writeFileSync(filePath, buffer)
  logger.info('File', '图片已外置存储', { filename, size: buffer.length, mimeType })
  return `images/${filename}`
})

// 注册图片协议：notestar-img://<filename> → data/images/<filename>
function registerImageProtocol() {
  protocol.handle('notestar-img', (req) => {
    try {
      const url = new URL(req.url)
      const filename = path.basename(url.pathname)
      const filePath = path.resolve(imagesDir, filename)
      // 安全：仅允许 images 目录内的文件
      if (!filePath.startsWith(path.resolve(imagesDir) + path.sep)) {
        return new Response('forbidden', { status: 403 })
      }
      if (!fs.existsSync(filePath)) return new Response('not found', { status: 404 })
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (e) {
      return new Response('bad request', { status: 400 })
    }
  })
  logger.info('Main', 'notestar-img 图片协议已注册')
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
// mode: 'source'（按 sourceId）/ 'foreground'（自动找活动窗口，如正在看的视频）
ipcMain.handle('screen:capture', async (e, { sourceId = '', mode = 'source' }) => {
  const { desktopCapturer } = require('electron')
  const { execFileSync } = require('child_process')
  let targetId = sourceId

  // 自动模式：用 PowerShell 获取前台窗口标题，匹配到对应 source（用户正在看的视频窗口）
  if (mode === 'foreground' && !targetId) {
    let fgTitle = ''
    try {
      const psOut = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Add-Type @\"\nusing System;\nusing System.Runtime.InteropServices;\npublic class Win32 { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); }\n\"@; $h=[Win32]::GetForegroundWindow(); $sb=New-Object System.Text.StringBuilder 512; [Win32]::GetWindowText($h,$sb,512) | Out-Null; $sb.ToString()',
      ], { encoding: 'utf-8', timeout: 5000, windowsHide: true })
      fgTitle = String(psOut).trim()
    } catch (err) { /* 拿不到就退回全屏 */ }

    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 320, height: 180 } })
    // 标题模糊匹配（去重、忽略本应用）
    const matched = fgTitle
      ? sources.find(s => s.name.includes(fgTitle.slice(0, 30)) || fgTitle.includes(s.name.slice(0, 20)))
      : null
    if (matched) {
      targetId = matched.id
      logger.info('Screen', '自动匹配活动窗口', { fgTitle, window: matched.name })
    } else {
      logger.info('Screen', '未匹配到活动窗口，退回全屏', { fgTitle })
    }
  }

  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1920, height: 1080 } })
  const source = targetId ? sources.find(s => s.id === targetId) : (sources.find(s => s.id.startsWith('screen:')) || sources[0])
  if (!source) throw new Error('未找到可截取的屏幕/窗口')

  logger.info('Screen', '截屏完成', { name: source.name, size: source.thumbnail.getSize() })
  return { name: source.name, dataUri: source.thumbnail.toDataURL() }
})

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
// 转写脚本：打包后位于 resources/transcribe.py（asar 内文件无法被 execFile 执行）
const WHISPER_SCRIPT = process.resourcesPath
  ? path.join(process.resourcesPath, 'transcribe.py')
  : path.join(__dirname, 'transcribe.py')
const WHISPER_TEMP_DIR = path.join(require('os').tmpdir(), 'notestar-audio')

// 确保临时目录存在
try { fs.mkdirSync(WHISPER_TEMP_DIR, { recursive: true }) } catch (e) { /* ignore */ }

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

  logger.info('Audio', '开始本地转写', { fileSize: audioBuffer.length, file: tempFile, python: WHISPER_PYTHON, modelDir: WHISPER_MODEL_DIR })

  return new Promise((resolve, reject) => {
    const proc = execFile(WHISPER_PYTHON, [WHISPER_SCRIPT, tempFile], {
      timeout: 300000, // 5 分钟超时
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        // 离线加载本地模型（打包后随应用分发）
        NOTESTAR_WHISPER_MODEL_DIR: WHISPER_MODEL_DIR,
        HF_HUB_OFFLINE: WHISPER_MODEL_DIR ? '1' : '0',
      }
    }, (error, stdout, stderr) => {
      // 清理临时文件
      try { fs.unlinkSync(tempFile) } catch (e) { /* ignore */ }

      if (error) {
        logger.error('Audio', '转写失败', { error: error.message, stderr: stderr?.slice(0, 500) })
        reject(new Error(`转写失败: ${error.message}`))
        return
      }

      try {
        const result = JSON.parse(stdout.trim())
        if (result.error) {
          logger.error('Audio', '转写返回错误', { error: result.error })
          reject(new Error(result.error))
        } else {
          logger.info('Audio', '转写完成', {
            textLength: result.text?.length || 0,
            duration: result.duration
          })
          resolve(result)
        }
      } catch (parseErr) {
        logger.error('Audio', '转写输出解析失败', { stdout: stdout?.slice(0, 200) })
        reject(new Error('转写输出格式错误'))
      }
    })
  })
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
ipcMain.handle('ai:chat', async (event, question, noteContext, history) => {
  const settings = readSettings()
  if (!settings.apiKey && settings.provider !== 'local') throw new Error('未配置 API Key，请先在设置中填写')

  // 检查笔记上下文中是否包含图片
  const model = settings.model || 'meta/llama-3.1-8b-instruct'
  const mm = noteContext ? buildMultimodalContent(noteContext, model) : null
  // 对话只附带有限长度的笔记上下文，避免上下文越积越多导致免费模型排队和首字节变慢。
  const maxContextChars = 6000
  const contextText = (mm?.textContent || noteContext || '').slice(0, maxContextChars)
  const systemPrompt = noteContext
    ? `你是一个学习助手AI。以下是学生的笔记内容，请基于这些笔记回答问题。如果笔记中没有相关内容，请说明并给出一般性建议。${mm?.hasImages ? '笔记中包含图片，请同时结合图片内容进行分析。' : ''}\n\n学生笔记：\n${contextText}`
    : '你是一个学习助手AI，请回答学生的学习问题。回答简洁清晰。'

  const messages = [
    { role: 'system', content: systemPrompt },
  ]

  // 历史对话限制为最近 4 条、每条最多 1,400 字符，避免长对话拖慢云端推理。
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-4)) {
      const text = String(msg.content || '')
      const compactContent = text.length > 1400
        ? `${text.slice(0, 1100)}\n[中间内容已省略]\n${text.slice(-200)}`
        : text
      messages.push({ role: msg.role, content: compactContent })
    }
  }

  // 如果笔记上下文含图片，用户消息也用多模态格式
  if (mm?.hasImages) {
    messages.push({ role: 'user', content: [{ type: 'text', text: question }, ...mm.content] })
  } else {
    messages.push({ role: 'user', content: question })
  }

  const content = await callAIWithRetry(settings, messages, (chunk) => {
    event.sender.send('ai:chat:chunk', chunk)
  }, { outputTokens: 1024, operation: 'chat' })
  return content
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
  }
  return true
})

// ========== IPC: 课程 CRUD ==========
ipcMain.handle('courses:getAll', () => {
  const courses = readJSON(coursesFile, [])
  const notes = readJSON(notesFile, [])
  courses.forEach(c => { c.noteCount = notes.filter(n => n.courseId === c.id).length })
  writeJSON(coursesFile, courses, { debounce: WRITE_DEBOUNCE_MS })
  logger.info('Main', 'courses:getAll', { count: courses.length })
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
  writeJSON(coursesFile, courses)
  return course
})

ipcMain.handle('courses:delete', (e, id) => {
  let courses = readJSON(coursesFile, [])
  courses = courses.filter(c => c.id !== id)
  writeJSON(coursesFile, courses)
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

  // 计算连续打卡
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
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
        <div class="q-head"><span class="q-idx">${i + 1}</span><span class="q-type">${escapeHtml(it.typeLabel || '')}</span><span class="q-diff">${escapeHtml(it.difficulty || '')}</span></div>
        <div class="q-text">${escapeHtml(it.question || '')}</div>
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
.q-type{font-size:11px;color:#FF6B9D}.q-diff{font-size:11px;color:#9B9BB5}
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
// 云端优先（跟随设置）；云端不可用（无 Key/失败）自动回退本地 qwen
// 题目与答案必须可溯源：解析后校验答案能在笔记原文中找到，否则剔除
ipcMain.handle('quiz:generate', async (event, { noteIds = [], courseIds = [], count = 10, mock = false }) => {
  if (mock) return { questions: buildMockQuiz(count), provider: 'mock' }
  const allNotes = readJSON(notesFile, []).filter(n => !n.deletedAt)
  let targets = allNotes
  if (noteIds.length) targets = targets.filter(n => noteIds.includes(n.id))
  else if (courseIds.length) targets = targets.filter(n => courseIds.includes(n.courseId))
  if (!targets.length) throw new Error('没有可出题的笔记，请先选择笔记范围')

  const qCount = Math.min(Math.max(parseInt(count) || 10, 3), 20)
  // 拼笔记材料（每篇截前 2600 字符，最多 5 篇）
  const picked = targets.slice(0, 5)
  const material = picked.map((n, i) => {
    const text = (n.content || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').slice(0, 2600)
    return `[笔记${i + 1}] 标题：${n.title} id：${n.id}\n内容：${text}`
  }).join('\n\n')

  const systemPrompt = `你是资深出题老师。根据下面学生笔记内容，生成 ${qCount} 道知识点复习题。
硬性要求：
1. 题型混合：单选题约50%、填空题约20%、判断题约10%、多选题约10%、匹配题约10%，根据知识点性质选择最合适的题型
2. 所有题目、选项、答案、解析必须严格来自笔记原文，禁止编造笔记中没有的内容
3. 单选题恰有4个选项，正确答案用 A/B/C/D 字母表示
4. 多选题恰有4个选项，正确答案用多个字母表示（如 "AC"），并保证正确选项有2-3个
5. 匹配题：question 描述配对要求，pairs 为 [{left:"左侧项",right:"右侧项"}]（3-4对），answer 为 "1-2,2-3,3-1" 形式的映射（左序号-右序号），explanation 说明配对依据
6. 填空题答案为核心关键词（5字以内）
7. 判断题答案为 对 或 错
8. 每题必须带 difficulty（"easy"/"medium"/"hard"，根据知识点难度判断）
9. 每题必须带 explanation（解析，说明判断依据）和 source（《笔记标题》+原文引用片段）
10. 每题的 sourceNoteId 必须是对应笔记的 id（见下方[笔记N]）
11. 输出必须是合法 JSON：只能使用半角逗号、半角冒号、半角引号，禁止任何全角标点（，：""''等）；题干和选项内不要包含引号
只输出 JSON，不要任何多余文字，不要 markdown 代码块。格式：
{"questions":[{"type":"choice|blank|judge|multi|match","question":"题干","options":["A. xxx","B. xxx","C. xxx","D. xxx"],"answer":"A 或 AC 或 对 或 关键词 或 映射","difficulty":"easy|medium|hard","explanation":"解析","source":"《标题》引用原文","sourceNoteId":"笔记id","pairs":[{"left":"左项","right":"右项"}]}]}`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: material },
  ]

  const settings = readSettings()
  const makeFallbackSettings = (s) => ({ ...s, provider: 'local', model: 'qwen2.5:7b-instruct', apiKey: '' })

  // 尝试调用：云端优先，失败回退本地
  const tryGenerate = async (cfg) => {
    return await callAIWithRetry(cfg, messages, null, { outputTokens: 4096, operation: 'quiz' })
  }

  let raw = ''
  let usedProvider = settings.provider || 'deepseek'
  try {
    raw = await tryGenerate(settings)
  } catch (e) {
    if (settings.provider !== 'local') {
      logger.info('Quiz', '云端出题失败，回退本地', { err: e.message })
      try {
        raw = await tryGenerate(makeFallbackSettings(settings))
        usedProvider = 'local'
      } catch (e2) {
        throw new Error(`AI 出题失败（云端与本地均失败）：${e2.message}`)
      }
    } else {
      throw new Error(`AI 出题失败：${e.message}`)
    }
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
    let answerOk = false
    const qType = String(q.type || 'choice').toLowerCase()
    if (qType === 'choice' && Array.isArray(q.options)) {
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
      answerOk = ['对', '错', '正确', '错误', '对/错'].includes(String(q.answer).trim())
    } else if (qType === 'match') {
      // 匹配：每对 left/right 都要在原文出现
      const pairs = Array.isArray(q.pairs) ? q.pairs.slice(0, 4) : []
      answerOk = pairs.length >= 2 && pairs.every(p => containsFuzzy(content, strip(p.left)) && containsFuzzy(content, strip(p.right)))
    }
    if (!answerOk) continue
    okQuestions.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: ['choice', 'blank', 'judge', 'multi', 'match'].includes(qType) ? qType : 'choice',
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
  return { questions: okQuestions.slice(0, qCount), provider: usedProvider }
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
    if (!fs.existsSync(fp)) return ''
    const content = fs.readFileSync(fp, 'utf-8')
    return content.length > 200000 ? content.slice(-200000) : content
  } catch { return '' }
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

// ========== IPC: 日志系统 ==========
// 前端日志转发到主进程统一记录
ipcMain.handle('log:write', (event, level, source, message, data) => {
  const levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO
  writeLog(levelNum, source, message, data)
  return true
})



ipcMain.handle('app:quit', () => {
  isQuitting = true
  app.quit()
  return true
})

// 悬浮球展开/收起（窗口在右下角锚定，展开成操作面板）
let bubbleWindow = null  // 桌面悬浮球窗口（被误删后补回）
let isQuitting = false   // 是否正在退出（被误删后补回）
const BUBBLE_COLLAPSED = { w: 64, h: 64 }
const BUBBLE_EXPANDED = { w: 236, h: 300 }

// 用 Windows API SetWindowRgn 把窗口区域切成圆角/圆形，彻底去掉方形深色四角（黑边）
function applyBubbleRegion(w, h) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  try {
    const { execFile } = require('child_process')
    const hwndBuf = bubbleWindow.getNativeWindowHandle()
    const hwndHex = hwndBuf.toString('hex')
    // 收起=圆形（半径=min/2），展开=圆角 18px 面板
    const rad = w <= 70 ? Math.floor(Math.min(w, h) / 2) : 18
    const ps = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinRegion { [DllImport("user32.dll")] public static extern bool SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw); [DllImport("gdi32.dll")] public static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int w, int h); }'; $h = [IntPtr]::new([long]0x${hwndHex}); $rgn = [WinRegion]::CreateRoundRectRgn(0, 0, ${w}, ${h}, ${rad * 2}, ${rad * 2}); [WinRegion]::SetWindowRgn($h, $rgn, $true);`
    execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true, timeout: 4000 }, () => { /* 静默失败则保持现状 */ })
  } catch (e) { /* ignore */ }
}

function setBubbleSize(w, h) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  const { screen } = require('electron')
  const { workArea } = screen.getPrimaryDisplay()
  let x = workArea.x + workArea.width - w - 24
  let y = workArea.y + workArea.height - h - 24
  if (x < 0) x = 0
  if (y < 0) y = 0
  bubbleWindow.setBounds({ x, y, width: w, height: h })
  applyBubbleRegion(w, h) // 同步切窗口形状，去黑边
  logger.info('Main', '悬浮球尺寸调整', { w, h, x, y })
}
ipcMain.handle('bubble:expand', () => {
  setBubbleSize(BUBBLE_EXPANDED.w, BUBBLE_EXPANDED.h)
  return true
})
ipcMain.handle('bubble:collapse', () => {
  setBubbleSize(BUBBLE_COLLAPSED.w, BUBBLE_COLLAPSED.h)
  return true
})

function createBubbleWindow() {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) return
  const { screen } = require('electron')
  const { workArea } = screen.getPrimaryDisplay()
  const size = 64
  bubbleWindow = new BrowserWindow({
    width: size, height: size,
    x: workArea.x + workArea.width - size - 24,
    y: workArea.y + workArea.height - size - 24,
    // 注意：应用禁用了 GPU（防崩溃），transparent 窗口在无 GPU 下鼠标命中失效，
    // 因此悬浮球用不透明窗口 + 深色圆形徽章样式，保证可点击。
    frame: false, transparent: false, resizable: false,
    backgroundColor: '#14101F',
    alwaysOnTop: true, skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  bubbleWindow.loadFile(path.join(__dirname, 'bubble.html'))
  bubbleWindow.setAlwaysOnTop(true, 'screen-saver')
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  bubbleWindow.on('closed', () => {
    bubbleWindow = null
    // 悬浮球关闭 = 退出应用
    if (!isQuitting) {
      isQuitting = true
      app.quit()
    }
  })
  // 创建后即把窗口切成圆形，避免深色方形四角（黑边）
  bubbleWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => applyBubbleRegion(BUBBLE_COLLAPSED.w, BUBBLE_COLLAPSED.h), 300)
  })
  logger.info('Main', '桌面悬浮球已创建')
}

// 麦克风权限（悬浮球语音笔记用）
function setupMediaPermission() {
  const { session } = require('electron')
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((wc, permission) => permission === 'media')
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
    const { spawn } = require('child_process')
    const candidates = [
      process.env.OLLAMA_EXE,
      // 项目内置（打包后 resources/Ollama/ollama.exe）
      process.resourcesPath ? path.join(process.resourcesPath, 'Ollama', 'ollama.exe') : '',
      // 开发时：项目根 Ollama/ollama.exe
      path.join(__dirname, '..', '..', 'Ollama', 'ollama.exe'),
      'E:/ai12/Ollama/ollama.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
      path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
    ].filter(Boolean)
    const exe = candidates.find(p => fs.existsSync(p))
    if (!exe) {
      logger.warn('Local', '未找到 Ollama，本地模型不可用（可到 ollama.com 安装）')
      return
    }
    // 模型目录优先用环境变量，其次项目内置 models，其次探测常见自定义目录
    const modelDirs = [
      process.env.OLLAMA_MODELS,
      process.resourcesPath ? path.join(process.resourcesPath, 'Ollama', 'models') : '',
      path.join(__dirname, '..', '..', 'Ollama', 'models'),
      'E:/ai12/Ollama/models',
      path.join(path.dirname(exe), 'models'),
    ].filter(Boolean)
    const modelsDir = modelDirs.find(d => fs.existsSync(d))
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

app.whenReady().then(() => {
  logger.info('Main', 'Electron 初始化完成，准备创建窗口')
  ensureDataDir()
  ensureOllamaService() // 自动拉起本地模型服务（未运行时）
  buildMenu() // 设置应用菜单
  purgeExpiredDeletedNotes() // 清理回收站过期笔记
  registerImageProtocol() // 注册图片外置存储协议
  setupMediaPermission() // 麦克风权限（悬浮球语音笔记）
  createBubbleWindow() // 桌面悬浮球
  createTray() // 系统托盘（后台可见，右键可退出）
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
    mainWindow = new BrowserWindow({
      width: 1440, height: 900,
      minWidth: 1024, minHeight: 700,
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
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
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
    if (process.env.DEBUG) mainWindow.webContents.openDevTools()
  } catch (e) {
    logger.error('Main', 'createWindow 失败', { message: e.message, stack: e.stack })
    dialog.showErrorBox('窗口创建失败', e.message)
  }
}

// ========== 系统托盘（后台可见入口：显示窗口 / 退出） ==========
let tray = null
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
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
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
})
