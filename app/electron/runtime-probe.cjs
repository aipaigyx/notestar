const { app } = require('electron')

console.log('[Probe] module loaded')
app.on('ready', () => console.log('[Probe] ready event'))
app.whenReady().then(() => {
  console.log('[Probe] whenReady resolved')
  setTimeout(() => app.quit(), 1000)
}).catch((error) => {
  console.error('[Probe] whenReady rejected:', error)
  app.exit(1)
})
setTimeout(() => console.log(`[Probe] after 5s ready=${app.isReady()}`), 5000)
