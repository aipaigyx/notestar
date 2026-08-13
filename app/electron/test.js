// 最小测试 - 检查 Electron API 是否可用
const electron = require('electron')
console.log('typeof electron:', typeof electron)
console.log('electron keys:', Object.keys(electron).slice(0, 10))
console.log('app:', typeof electron.app)

if (electron.app) {
  electron.app.whenReady().then(() => {
    console.log('Electron is ready!')
    const win = new electron.BrowserWindow({ width: 800, height: 600 })
    win.loadFile('dist/index.html')
  })
} else {
  console.log('ERROR: electron.app is undefined!')
  console.log('electron value:', electron)
  process.exit(1)
}
