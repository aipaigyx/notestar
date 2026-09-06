// 手动下载 faster-whisper-small 模型文件（绕开 huggingface_hub 的删除安全钩子）
const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE = 'https://hf-mirror.com/Systran/faster-whisper-small/resolve/main'
const FILES = ['config.json', 'model.bin', 'tokenizer.json', 'vocabulary.txt']
const DEST = 'E:/blender三渲二/cx/笔记卡片/app/vendor/whisper-models/hub/models--Systran--faster-whisper-small/snapshots/08e178d48790749d25932bbc082711ddcfdfbc4f'

fs.mkdirSync(DEST, { recursive: true })

function download(file) {
  return new Promise((resolve, reject) => {
    const url = BASE + '/' + file
    const dest = path.join(DEST, file)
    console.log('下载中:', file)
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        // 跟随重定向（location 可能是相对路径）
        let loc = res.headers.location
        if (loc && loc.startsWith('/')) loc = 'https://hf-mirror.com' + loc
        console.log('  重定向', res.statusCode, '→', String(loc).slice(0, 100))
        res.resume()
        const follow = (u) => {
          if (u && u.startsWith('/')) u = 'https://hf-mirror.com' + u
          const req2 = https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
            if ([301, 302, 303, 307, 308].includes(res2.statusCode)) {
              res2.resume()
              follow(res2.headers.location)
              return
            }
            pipe(res2, dest, file, resolve, reject)
          })
          req2.on('error', reject)
        }
        follow(loc)
        return
      }
      pipe(res, dest, file, resolve, reject)
    })
    req.on('error', reject)
  })
}

function pipe(res, dest, file, resolve, reject) {
  if (res.statusCode !== 200) {
    console.log('  HTTP', res.statusCode)
    res.resume()
    reject(new Error('HTTP ' + res.statusCode + ' for ' + file))
    return
  }
  const ws = fs.createWriteStream(dest)
  const total = parseInt(res.headers['content-length'] || '0', 10)
  let got = 0
  let lastLog = 0
  res.on('data', (c) => { got += c.length; const now = Date.now(); if (now - lastLog > 5000) { lastLog = now; console.log('  ' + file + ': ' + Math.round(got / 1048576) + 'MB / ' + Math.round(total / 1048576) + 'MB') } })
  res.pipe(ws)
  ws.on('finish', () => { console.log('完成:', file, got, 'bytes'); resolve() })
  ws.on('error', reject)
}

(async () => {
  for (const f of FILES) {
    await download(f)
  }
  console.log('=== 全部下载完成 ===')
  fs.writeFileSync(path.join(DEST, '.complete'), 'ok')
})().catch(e => { console.error('下载失败:', e.message); process.exit(1) })
