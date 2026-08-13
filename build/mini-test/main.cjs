// 最小化 Electron 测试：文件日志版（GUI 进程 stdout 不可靠）
const { app, BrowserWindow } = require('electron')
const fs = require('fs')

const LOG = 'E:/blender三渲二/cx/笔记卡片/build/mini-test/run.log'
function log(msg) {
  try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + msg + '\n') } catch (e) {}
}
try { fs.writeFileSync(LOG, '=== mini test start ===\n') } catch (e) {}

log('argv: ' + JSON.stringify(process.argv.slice(1)))

app.whenReady().then(() => {
  log('app ready')
  const win = new BrowserWindow({ width: 800, height: 600, show: false })

  win.webContents.on('render-process-gone', (e, details) => {
    log('RENDER_GONE: ' + JSON.stringify(details))
  })
  win.webContents.on('console-message', (e, level, message) => {
    log('RENDERER_CONSOLE: ' + message)
  })
  win.webContents.on('did-fail-load', (e, code, desc, url) => {
    log('DID_FAIL_LOAD: ' + code + ' ' + desc + ' ' + url)
  })
  win.webContents.on('did-finish-load', () => {
    log('DID_FINISH_LOAD')
    setTimeout(() => { log('ALIVE_5S -> exit'); app.exit(0) }, 5000)
  })

  const mode = process.argv.find(a => a.startsWith('--mode='))
  if (mode === '--mode=file') {
    const distIndex = 'E:\\blender三渲二\\cx\\笔记卡片\\app\\dist\\index.html'
    log('loading file: ' + distIndex)
    win.loadFile(distIndex)
  } else {
    log('loading data url')
    win.loadURL('data:text/html,<h1>MINI TEST OK</h1>')
  }
}).catch(e => log('whenReady error: ' + e.message))

app.on('window-all-closed', () => app.quit())
