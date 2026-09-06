// 🚀 自动更新模块
// 配合 electron-updater + electron-builder + GitHub Releases 使用
//
// 用法：
//   发布新版本 → npm run release（需设置 GH_TOKEN 环境变量）
//   用户启动应用 → 自动检查更新 → 下载 → 提示重启安装
//
// 环境变量：
//   GH_TOKEN / GITHUB_TOKEN  — GitHub Personal Access Token（发布用）
//   UPDATE_FEED_URL          — 自定义更新源 URL（非 GitHub 时使用）

const { autoUpdater } = require('electron-updater')
const { ipcMain, BrowserWindow } = require('electron')

// 内部日志：electron-updater 的 logger 接口用 console 实现即可，不依赖外部日志模块
const log = {
  info:  (msg) => { try { console.log('[AutoUpdater]', msg) } catch (_) {} },
  warn:  (msg) => { try { console.warn('[AutoUpdater]', msg) } catch (_) {} },
  error: (msg) => { try { console.error('[AutoUpdater]', msg) } catch (_) {} },
  debug: (msg) => { try { console.log('[AutoUpdater]', msg) } catch (_) {} },
}

// ── 配置 ──────────────────────────────────────────────────────
autoUpdater.autoDownload = false          // 不自动下载，先询问用户
autoUpdater.allowPrerelease = false       // 不接收预发布版本
autoUpdater.autoInstallOnAppQuit = true   // 退出时自动安装已下载的更新

// ── 日志 ──────────────────────────────────────────────────────
autoUpdater.logger = {
  info:  (msg) => log.info(String(msg)),
  warn:  (msg) => log.warn(String(msg)),
  error: (msg) => log.error(String(msg)),
  debug: (msg) => log.debug(String(msg)),
}

// ── 状态 ──────────────────────────────────────────────────────
let updateInfo = null          // 最新版本信息
let downloadProgress = 0       // 下载进度 0-100
let updateDownloaded = false   // 是否已下载完成
let isChecking = false         // 是否正在检查

// ── 向渲染进程广播状态 ────────────────────────────────────────
function broadcastUpdateStatus() {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    try {
      if (!win.isDestroyed() && win.webContents) {
        win.webContents.send('update:status', {
          isChecking,
          updateAvailable: !!updateInfo,
          updateDownloaded,
          version: updateInfo?.version || '',
          releaseNotes: updateInfo?.releaseNotes || '',
          downloadProgress,
        })
      }
    } catch (_) { /* ignore */ }
  }
}

// ── 事件监听 ──────────────────────────────────────────────────
autoUpdater.on('checking-for-update', () => {
  isChecking = true
  log.info('正在检查更新…')
  broadcastUpdateStatus()
})

autoUpdater.on('update-available', (info) => {
  isChecking = false
  updateInfo = info
  log.info('发现新版本 ' + info.version)
  broadcastUpdateStatus()
})

autoUpdater.on('update-not-available', (info) => {
  isChecking = false
  updateInfo = null
  log.info('已是最新版本' + (info?.version ? ' ' + info.version : ''))
  broadcastUpdateStatus()
})

autoUpdater.on('error', (err) => {
  isChecking = false
  log.error('更新检查失败: ' + (err?.message || err))
  broadcastUpdateStatus()
})

autoUpdater.on('download-progress', (progressObj) => {
  downloadProgress = Math.round(progressObj.percent || 0)
  broadcastUpdateStatus()
})

autoUpdater.on('update-downloaded', (info) => {
  updateDownloaded = true
  downloadProgress = 100
  log.info('更新已下载完成 ' + (info?.version || ''))
  broadcastUpdateStatus()
})

// ── IPC 接口 ──────────────────────────────────────────────────
function setupIpc() {
  // 检查更新
  ipcMain.handle('update:check', async () => {
    try {
      isChecking = true
      broadcastUpdateStatus()
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (e) {
      isChecking = false
      log.error('checkForUpdates 异常: ' + e.message)
      broadcastUpdateStatus()
      return { ok: false, error: e.message }
    }
  })

  // 开始下载更新
  ipcMain.handle('update:download', async () => {
    try {
      autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // 退出并安装
  ipcMain.handle('update:install', async () => {
    setImmediate(() => autoUpdater.quitAndInstall())
    return { ok: true }
  })

  // 静默检查（启动时后台检查，不弹窗）
  ipcMain.handle('update:silentCheck', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (_) {
      return { ok: false }
    }
  })

  // 获取当前更新状态
  ipcMain.handle('update:getStatus', async () => {
    return {
      isChecking,
      updateAvailable: !!updateInfo,
      updateDownloaded,
      version: updateInfo?.version || '',
      downloadProgress,
    }
  })
}

// ── 启动时自动检查（后台静默） ────────────────────────────────
function startAutoCheck() {
  log.info('启动自动更新模块')
  setupIpc()

  // 延迟 5 秒后静默检查，避免影响启动性能
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)
}

module.exports = { startAutoCheck, setupIpc }