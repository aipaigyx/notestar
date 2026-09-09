import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import IPC from '../electron/ipc-constants.cjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

// 从源码正则提取硬编码通道字面量（仅限通道名形态：小写字母/数字/冒号/连字符/下划线）
function extractChannels(src) {
  const set = new Set()
  for (const m of src.matchAll(/['"]([a-z][a-z0-9:_-]*)['"]/g)) set.add(m[1])
  return set
}

describe('IPC 常量一致性（防 typo / 防漏改 / 防改名）', () => {
  const preloadSrc = read('electron/preload.js')
  const mainSrc = read('electron/main.cjs')
  const autoUpdaterSrc = read('electron/auto-updater.cjs')

  // preload 中所有 invoke/send/on 的字面量通道，必须全部出现在常量集合中
  // （含 proxy 私有通道：由 main.cjs 直接 webContents.send 到 rec-proxy.html，不经 preload）
  const proxyChannels = Object.values(IPC.proxy || {})
  const constantsSet = new Set([...IPC.INVOKE, ...IPC.EVENTS, ...proxyChannels])

  it('preload 引用的每个通道都在常量集中', () => {
    const used = extractChannels(preloadSrc)
    // preload 里除了通道名，还会有其他字符串（如 'INFO'、'Preload'、路径等），
    // 但只要是"通道名形态"且被 invoke/send/on 使用的，必须能命中常量。
    // 保守起见：从 invoke/send/on 调用行抽取。
    const chanRe = /(?:ipcRenderer\.(?:invoke|send|on)\(|removeAllListeners\()\s*'([^']+)'/g
    const invoked = new Set()
    for (const m of preloadSrc.matchAll(chanRe)) invoked.add(m[1])
    // 白名单：diagnostic 的 log:write（已含）、以及非通道字面量（方法名不在此列）。
    for (const ch of invoked) {
      expect(constantsSet.has(ch), `preload 通道 '${ch}' 未出现在 ipc-constants.cjs`).toBe(true)
    }
  })

  it('auto-updater.cjs 注册的 update 通道都在常量集', () => {
    const chanRe = /ipcMain\.handle\('([^']+)'/g
    const invoked = new Set()
    for (const m of autoUpdaterSrc.matchAll(chanRe)) invoked.add(m[1])
    for (const ch of invoked) {
      expect(constantsSet.has(ch), `auto-updater 通道 '${ch}' 不在常量集`).toBe(true)
    }
  })

  it('main.cjs 的 ipcMain.handle 通道都在常量集', () => {
    const chanRe = /ipcMain\.handle\('([^']+)'/g
    const invoked = new Set()
    for (const m of mainSrc.matchAll(chanRe)) invoked.add(m[1])
    for (const ch of invoked) {
      expect(constantsSet.has(ch), `main.cjs 通道 '${ch}' 不在常量集`).toBe(true)
    }
  })

  it('invoke 通道与事件通道无同名碰撞', () => {
    const invokeSet = new Set(IPC.INVOKE)
    const evSet = new Set(IPC.EVENTS)
    for (const ev of evSet) {
      expect(invokeSet.has(ev), `事件通道 '${ev}' 与 invoke 通道冲突`).toBe(false)
    }
  })

  it('常量集中无重复通道名', () => {
    const all = [...IPC.INVOKE, ...IPC.EVENTS]
    expect(new Set(all).size).toBe(all.length)
  })

  it('不包含意外改名：常量值与源码字面量逐个一致', () => {
    const chanRe = /(?:ipcRenderer\.(?:invoke|send)\(\s*'([^']+)')/g
    const literalVals = new Set()
    for (const m of preloadSrc.matchAll(chanRe)) literalVals.add(m[1])
    for (const m of mainSrc.matchAll(chanRe)) literalVals.add(m[1])
    // 每个源码字面量都必须能找到一个同值的常量
    for (const ch of literalVals) {
      expect(constantsSet.has(ch)).toBe(true)
    }
  })
})