const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', 'app', 'dist')
const port = 4173

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
}

http
  .createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p === '/') p = '/index.html'
    let fp = path.join(root, path.normalize(p).replace(/^[/\\]+/, ''))
    if (!fp.startsWith(root)) {
      res.writeHead(403)
      return res.end('forbidden')
    }
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
      fp = path.join(root, 'index.html')
    }
    const ext = path.extname(fp).toLowerCase()
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
    fs.createReadStream(fp).pipe(res)
  })
  .listen(port, () => console.log('preview server: http://localhost:' + port))
