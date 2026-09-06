// ═══════════════════════════════════════════════════════════════
//  笔记星图 · 一键发行打包脚本
//  用途：在项目产出目录生成「无任何数据」的干净发行物
//    ├── 安装包/        ← electron-builder NSIS 安装 exe + latest.yml（自动更新）
//    ├── 便携版/        ← 完整绿色版：app 源码 + vendor + Ollama + 启动器 (解压即用)
//  特点：自动排除所有运行时/个人数据（data、logs、userdata、release 等）
//  用法：
//    node build/package-release.cjs
//    node build/package-release.cjs --portable=F:\dist-packages   # 便携版输出到指定盘
// ═══════════════════════════════════════════════════════════════
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')          // 项目根
const APP = path.join(ROOT, 'app')                   // 应用目录
const RELEASE = path.join(APP, 'release')            // electron-builder 输出

// 解析命令行参数：--portable=<路径> 允许把便携版输出到大容量盘
const args = process.argv.slice(2)
let portableArg = ''
for (const a of args) {
  if (a.startsWith('--portable=')) portableArg = a.slice('--portable='.length).trim()
}

const OUT = path.join(ROOT, 'dist-packages')         // 安装包/etc 输出目录（项目根下）
// 便携版输出根：默认在 OUT 下（便携版/），指定 --portable 时用指定目录
const PORTABLE_ROOT = portableArg || path.join(OUT, '便携版')

const VERSION = (() => {
  try { return require(path.join(APP, 'package.json')).version || '1.0.0' }
  catch { return '1.0.0' }
})()

// 便携版里需排除的「非纯净」目录（运行时数据 / 构建缓存 / 历史）
const EXCLUDE_DIRS = new Set([
  'node_modules/.vite', 'node_modules/.cache',
  'data', 'logs', 'userdata', 'userdata-backup', 'userdata-old',
  'release', 'dist-old', 'dist-old-1', 'src', // src 源码不随包分发
  '__pycache__',
])
const EXCLUDE_FILES = new Set(['.env', 'debug.log'])

const banner = (s) => console.log('\n' + '═'.repeat(56) + '\n  ' + s + '\n' + '═'.repeat(56))

// ── 工具：删除目录 ──────────────────────────────────────────────
function rmrf(p) {
  if (!fs.existsSync(p)) return
  fs.rmSync(p, { recursive: true, force: true })
}

// ── 递归复制目录（带排除规则）──────────────────────────────────
function copyDir(src, dest, excludeDirs, excludeFiles) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const e of entries) {
    const s = path.join(src, e.name)
    const d = path.join(dest, e.name)
    if (e.isDirectory()) {
      if (excludeDirs.has(e.name)) { console.log('    跳过目录:', path.relative(src, s)); continue }
      copyDir(s, d, excludeDirs, excludeFiles)
    } else {
      if (excludeFiles.has(e.name)) { console.log('    跳过文件:', path.relative(src, s)); continue }
      fs.copyFileSync(s, d)
    }
  }
}

// ── 纯数据目录是否存在 ─────────────────────────────────────────
const has = (p) => fs.existsSync(p)

function main() {
  banner('笔记星图 一键发行打包  v' + VERSION)
  console.log('产出目录: ' + OUT + '\n')

  // 0. 清理输出目录（注意：便携版可能独立到别的盘，分别清理）
  if (PORTABLE_ROOT === path.join(OUT, '便携版')) {
    rmrf(OUT)
    fs.mkdirSync(path.join(OUT, '安装包'), { recursive: true })
  } else {
    rmrf(path.join(OUT, '安装包'))
    fs.mkdirSync(path.join(OUT, '安装包'), { recursive: true })
    rmrf(PORTABLE_ROOT)
    fs.mkdirSync(PORTABLE_ROOT, { recursive: true })
  }

  // ═══════════ 1. 构建前端 + electron-builder 安装包 ═══════════
  banner('步骤 1/3：构建前端 + 生成 NSIS 安装包')
  // 打包脚本只做「本地打包」，不做 GitHub 自动发布。
  // --publish never 强制跳过发布步骤（即使检测到 CI / GH_TOKEN），
  // 避免尝试上传到 package.json 里占位的 owner/repo 而 404/报错。
  const buildCmd = 'npx cross-env NODE_OPTIONS= ELECTRON_RUN_AS_NODE= electron-builder --win --x64 --publish never'
  try {
    execSync('npm run build', { cwd: APP, stdio: 'inherit' })
    execSync(buildCmd, { cwd: APP, stdio: 'inherit' })
  } catch (e) {
    console.error('[错误] 构建失败，请先检查代码或网络。')
    process.exit(1)
  }

  // ═══════════ 2. 收集安装包 → dist-packages/安装包 ═══════════
  banner('步骤 2/3：收集安装包产物')
  let installed = false
  if (has(RELEASE)) {
    const files = fs.readdirSync(RELEASE)
    for (const f of files) {
      // 只收安装包/更新元数据/7z 分卷，不收 win-unpacked 目录
      if (['.exe', '.7z', '.yml', '.blockmap'].includes(path.extname(f).toLowerCase())) {
        fs.copyFileSync(path.join(RELEASE, f), path.join(OUT, '安装包', f))
        console.log('  已收集:', f)
        installed = true
      }
    }
  }
  if (!installed) console.log('  (未在 app/release 找到安装包，electron-builder 可能未完成)')

  // ═══════════ 3. 组便携版（无数据）→ 便携版目录 ═══════════
  banner('步骤 3/3：组装完整便携版（含本地模型，无任何数据）')
  console.log('便携版输出: ' + PORTABLE_ROOT + '\n')
  const portDir = path.join(PORTABLE_ROOT, '笔记星图')
  const portApp = path.join(portDir, 'app')

  // 3.1 核心：electron 运行时 + node_modules + 构建产物 dist + 主进程
  for (const sub of ['node_modules', 'dist', 'electron', 'package.json', 'package-lock.json']) {
    const s = path.join(APP, sub)
    if (!has(s)) { console.warn('    缺失(跳过):', sub); continue }
    const d = path.join(portApp, sub)
    if (fs.statSync(s).isDirectory()) copyDir(s, d, EXCLUDE_DIRS, EXCLUDE_FILES)
    else fs.copyFileSync(s, d)
    console.log('  ✓ app/' + sub)
  }

  // 3.2 本地 AI 环境 vendor（python / whisper / ffmpeg）
  if (has(path.join(APP, 'vendor'))) {
    copyDir(path.join(APP, 'vendor'), path.join(portApp, 'vendor'), EXCLUDE_DIRS, EXCLUDE_FILES)
    console.log('  ✓ app/vendor（本地 AI 环境）')
  }

  // 3.3 Ollama 本地大模型（根目录）
  if (has(path.join(ROOT, 'Ollama'))) {
    // 排除运行时产生的 serve 日志 / 卸载器，只保留运行必需
    const ollExclude = new Set(['serve.err', 'serve.log', 'unins000.exe', 'unins000.dat', 'unins000.msg'])
    copyDir(path.join(ROOT, 'Ollama'), path.join(portDir, 'Ollama'), new Set(), ollExclude)
    console.log('  ✓ Ollama（本地大模型）')
  }

  // 3.4 启动器 exe
  for (const name of ['笔记星图.exe', 'NoteStarLauncher.exe']) {
    const s = path.join(ROOT, name)
    if (has(s)) { fs.copyFileSync(s, path.join(portDir, '笔记星图.exe')); console.log('  ✓ 启动器 ' + name); break }
  }

  // 3.5 使用说明
  fs.writeFileSync(path.join(portDir, '使用说明.txt'),
    '笔记星图 NoteStar 便携版 v' + VERSION + '\n\n' +
    '· 双击「笔记星图.exe」即可运行（首次启动稍慢属正常）。\n' +
    '· 便携版已包含本地 AI 环境与模型，可完全离线使用。\n' +
    '· 此版本为纯净版，不含任何个人数据；你的笔记将在首次运行后自动创建。\n' +
    '· 若杀毒软件误报，请将本目录加入白名单。\n', 'utf8')

  banner('打包完成')
  console.log('完整版可用的路径：')
  console.log('  ' + OUT + '\\安装包')
  console.log('  ' + path.join(PORTABLE_ROOT, '笔记星图'))
  console.log('\n提示：便携版全选压缩为 zip/7z 后即可分发。')
  console.log('提示：安装包目录内的 latest.yml 用于自动更新。')
}

main()