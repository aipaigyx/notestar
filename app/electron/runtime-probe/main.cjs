const { app, BrowserWindow } = require('electron')

console.log('[Probe] module loaded')
app.on('ready', () => console.log('[Probe] ready event'))
app.whenReady().then(() => {
  console.log('[Probe] whenReady resolved')
  const window = new BrowserWindow({ show: false })
  window.loadURL('data:text/html,<h1>runtime probe</h1>')
  window.webContents.once('did-finish-load', () => {
    console.log('[Probe] page loaded')
    setTimeout(() => app.quit(), 500)
  })
}).catch((error) => {
  console.error('[Probe] whenReady rejected:', error)
  app.exit(1)
})
setTimeout(() => console.log(`[Probe] after 5s ready=${app.isReady()}`), 5000)
