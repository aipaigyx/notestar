// NoteStar 应用启动器
// 作用：
// 1. 在启动 Electron 前彻底清除会让 Electron 误入 Node 模式的环境变量
//    （ELECTRON_RUN_AS_NODE / NODE_OPTIONS），并支持 --dev 参数切换开发模式。
// 2. 自动拉起本地 Ollama 服务（11434 端口），无需用户单独启动。
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const net = require('net')

// 1. 彻底清除可疑环境变量（存在即为空字符串也会触发 Node 模式）
delete process.env.ELECTRON_RUN_AS_NODE
delete process.env.NODE_OPTIONS

// 2. 解析参数
const args = process.argv.slice(2)
const isDev = args.includes('--dev')
if (isDev) process.env.DEV = '1'
const electronArgs = args.filter(a => a !== '--dev')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// 检测端口是否已被监听
function isPortOpen(port, host = '127.0.0.1', timeout = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (ok) => { socket.destroy(); resolve(ok) }
    socket.setTimeout(timeout)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })
}

// 在常见位置查找 ollama 可执行文件
function findOllamaExe() {
  const candidates = [
    // 项目内置（开发时：项目根 Ollama/）
    path.join(__dirname, '..', '..', 'Ollama', 'ollama.exe'),
    'E:/ai12/Ollama/ollama.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama app.exe'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
  ]
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return null
}

// 确保 Ollama 服务已启动（最多等待 30 秒冷启动）
async function ensureOllama() {
  if (await isPortOpen(11434)) {
    console.log('[启动器] Ollama 服务已在运行 (127.0.0.1:11434)')
    return true
  }
  const exe = findOllamaExe()
  if (!exe) {
    console.warn('[启动器] 未找到 Ollama，本地模型暂不可用；可继续使用云端 API')
    return false
  }

  // 模型目录优先使用可执行文件旁的 models 目录（E:/ai12/Ollama/models）
  const modelsDir = path.join(path.dirname(exe), 'models')
  console.log(`[启动器] 正在启动 Ollama 服务... ${exe}`)
  const child = spawn(exe, ['serve'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, OLLAMA_MODELS: modelsDir },
  })
  child.unref()

  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    if (await isPortOpen(11434)) {
      console.log('[启动器] Ollama 服务已就绪')
      return true
    }
  }
  console.warn('[启动器] Ollama 启动超时（30s），请检查后重试')
  return false
}

// 3. 定位 Electron 可执行文件
const electronBin = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
const appDir = path.join(__dirname, '..')

if (!fs.existsSync(electronBin)) {
  console.error('[启动器] 未找到 Electron 可执行文件: ' + electronBin)
  process.exit(1)
}

// 4. 先确保本地 Ollama 可用（不影响 Electron 启动，等待模型加载）
ensureOllama().then(() => {
  // 5. 启动 Electron（生产模式加载 dist，--dev 则加载 Vite 5173）
  const child = spawn(
    electronBin,
    [appDir, '--no-sandbox', '--disable-dev-shm-usage', ...electronArgs],
    { stdio: 'inherit', env: process.env }
  )

  child.on('error', (err) => {
    console.error('[启动器] 启动失败:', err.message)
    process.exit(1)
  })

  child.on('close', (code) => process.exit(code ?? 0))
})
