// 诊断用：截图黑潮侵蚀页（真实 dist 构建 + 真图 + 火焰特效）
// 复用 agent-browser 自带的 playwright-core 与已下载的 Chromium
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const OUT_DIR = path.join(__dirname, '..', '.workbuddy', 'screenshots')
const OUT = path.join(OUT_DIR, 'heirs-fire.png')

function loadPlaywright() {
  const candidates = []
  // Windows 用户级全局包目录（npm root -g 可能被托管 node 劫持，需显式兜底）
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'agent-browser', 'node_modules', 'playwright-core'))
    candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'playwright-core'))
  }
  try {
    const g = execSync('npm root -g', { encoding: 'utf8' }).trim()
    candidates.push(path.join(g, 'agent-browser', 'node_modules', 'playwright-core'))
    candidates.push(path.join(g, 'playwright-core'))
  } catch (e) { /* ignore */ }
  candidates.push('playwright-core')
  for (const c of candidates) {
    try { return { pkg: require(c), from: c } } catch (e) { /* try next */ }
  }
  throw new Error('playwright-core not found in: ' + candidates.join(' | '))
}

;(async () => {
  const { pkg: pw, from } = loadPlaywright()
  console.log('playwright-core from:', from)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await pw.chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:4173/#/heirs', { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: OUT })
  await browser.close()
  console.log('screenshot saved:', OUT)
})().catch(e => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
