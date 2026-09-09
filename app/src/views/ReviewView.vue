<template>
  <div class="review-page">
    <div class="glow-orb glow-pink" style="width: 400px; height: 400px; top: 40px; left: -80px;"></div>
    <div class="glow-orb glow-blue" style="width: 500px; height: 500px; bottom: -120px; right: 60px;"></div>

    <div class="content-layer">
      <!-- 左：会话列表 + 播放器 -->
      <div class="review-left">
        <div class="rev-sessions">
        <div
          v-for="s in sessions"
          :key="s.sessionId"
          class="rev-session"
          :class="{ active: sessionId === s.sessionId }"
        >
          <button class="rs-card-btn" @click="loadSession(s)" :title="`打开会话 ${s.title || s.sessionId}`" :aria-label="`打开会话 ${s.title || s.sessionId}`">
            <img v-if="s.thumb" class="rs-thumb" :src="s.thumb" alt="会话缩略图">
            <div v-else class="rs-thumb rs-thumb-placeholder">🎬</div>
            <div class="rs-body">
              <span class="rs-title">{{ s.title || s.sessionId }}</span>
              <span class="rs-meta">{{ fmtDur(s.durationSec) }} · {{ s.segments.length }} 段</span>
              <span class="rs-meta">{{ fmtBytes(s.bytes || 0) }} · {{ s.orphan ? '⚠孤儿恢复' : (s.noteId ? '已关联笔记' : '未关联笔记') }}</span>
            </div>
          </button>
          <button class="rs-del-btn" @click="deleteSession(s)" :title="`删除会话 ${s.title || s.sessionId}`" aria-label="删除会话">🗑</button>
        </div>
        <button class="rev-refresh" @click="refreshSessions" title="刷新会话列表">🔄 刷新</button>
        <div v-if="!sessions.length" class="rev-empty">暂无录屏会话（悬浮球「🎥 跟拍记笔记」创建）</div>
      </div>

        <div class="rev-player-area">
          <div v-if="videoError" class="rev-video-error">
            <div class="rve-title">⚠ 视频加载失败</div>
            <div class="rve-detail">{{ videoError }}</div>
            <div class="rve-hint">协议地址：<code>{{ videoSrc }}</code></div>
            <button class="rev-refresh" @click="retryCurrentVideo">🔄 重试</button>
          </div>
          <video v-if="videoSrc && !videoError" ref="videoRef" class="rev-video" :src="videoSrc" controls @timeupdate="onTime" @error="onVideoError" @loadeddata="onVideoLoaded"></video>
          <div v-if="!videoSrc" class="rev-player-empty">⬅ 选择左侧录屏会话开始复习</div>
          <div v-if="segments.length" class="rev-seg-nav">
            <button class="seg-btn" @click="navSeg(-1)">⏪ 上段</button>
            <span class="seg-info">{{ curSegIndex + 1 }} / {{ segments.length }} 段 · {{ fmtSec(curSegOffset) }}</span>
            <button class="seg-btn" @click="navSeg(1)">下段 ⏩</button>
          </div>
        </div>
      </div>

      <!-- 右：笔记条目（联动高亮） -->
      <div class="review-right">
        <div class="rev-head">
          <h3 class="rev-title">📝 视频笔记条目</h3>
          <button class="rev-back" @click="router.back()">← 返回</button>
        </div>
        <div class="rev-entries" ref="entriesRef">
          <div
            v-for="(en, i) in entries"
            :key="i"
            class="rev-entry"
            :class="{ active: activeIdx === i }"
            @click="seekTo(en)"
          >
            <div class="rev-entry-time">{{ en.time }}</div>
            <div class="rev-entry-body" v-html="en.html"></div>
            <div class="rev-entry-sec">⏱ {{ fmtSec(en.sec) }}</div>
          </div>
          <div v-if="!entries.length" class="rev-empty">该会话暂无笔记条目</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'

const route = useRoute()
const router = useRouter()
const sessions = ref<any[]>([])
const sessionId = ref('')
const noteId = ref('')
const segments = ref<string[]>([])
const segmentStarts = ref<number[]>([])   // Day 2 P0-V4：每段真实起始秒（前缀和）。空数组说明是旧录屏 / 孤儿，退回 SEG_LEN 乘法
const segmentDurations = ref<number[]>([])
const curSegIndex = ref(0)
const curSegOffset = ref(0) // 当前段起始秒（真实时间轴上的偏移）
const videoRef = ref<HTMLVideoElement | null>(null)
const videoSrc = ref('')
const videoError = ref('')  // 视频加载错误信息（空字符串=无错误）
const entriesRef = ref<HTMLElement | null>(null)
const entries = ref<any[]>([])
const activeIdx = ref(-1)

const SEG_LEN = 600 // 仅旧录屏 / 孤儿（无 segmentStarts）兜底使用

// 视频源降级队列：重编码 H264 > WebM > MP4 > 当前 seg（逐级降级，保证必有一源可播）
const playQueue: string[] = []
let playIdx = 0
let playBaseT = 0
const recHttpUrl = (p: string) => 'http://127.0.0.1:8200/rec/' + p.replace(/^recordings\//, '')
// P1：统一"加载后 seek + 恢复播放"。所有 currentTime 赋值 / v.play() 必须走它，避免 loadedmetadata 之前 seek 丢帧
//   逻辑：loadedmetadata 触发 → seek → loadeddata/seeked 再 play；若视频一直不触发 metadata（编码/资源问题），1200ms 兜底直接走
const _afterMetaOnce = new WeakMap<HTMLVideoElement, boolean>()
function afterMetaSeek(v: HTMLVideoElement | null | undefined, sec: number, opts: { play?: boolean } = {}) {
  if (!v) return
  const play = !!opts.play
  sec = Math.max(0, sec || 0)
  // 若元数据已 ready，直接走（避免重切源时已 ready 却等事件=永远等不到）
  if (v.readyState >= 1) {
    try { v.currentTime = sec } catch (_) {}
    if (play) { try { v.play().catch(() => {}) } catch (_) {} }
    return
  }
  let done = false
  const finish = () => {
    if (done) return; done = true
    try { v.currentTime = sec } catch (_) {}
    if (play) { try { v.play().catch(() => {}) } catch (_) {} }
  }
  const onMeta = () => { v.removeEventListener('loadedmetadata', onMeta); finish() }
  v.addEventListener('loadedmetadata', onMeta)
  setTimeout(() => { if (!done) { v.removeEventListener('loadedmetadata', onMeta); finish() } }, 1200)
}
const playCurrentCandidate = () => {
  const url = playQueue[playIdx]
  if (!url) { videoError.value = '视频加载失败（所有视频源均不可用）'; return }
  videoError.value = ''
  videoSrc.value = url
  try { window.noteAPI?.logWrite?.('info', 'Review', 'set-video', { src: url, cand: `${playIdx + 1}/${playQueue.length}`, base: playBaseT }) } catch (_) {}
  setTimeout(() => {
    const v = videoRef.value
    if (!v) return
    v.load()
    afterMetaSeek(v, playBaseT, { play: true })
  }, 80)
}

// 视频错误处理：把 video.error.code 翻译成可读消息
function onVideoError() {
  const v = videoRef.value
  const err = v?.error
  // 自动降级到下一个候选源（h264→webm→mp4→seg），直到某源可播
  if (playQueue.length && playIdx < playQueue.length - 1) {
    playIdx++
    const nxt = playQueue[playIdx]
    try { window.noteAPI?.logWrite?.('warn', 'Review', 'video-source-fallback', { from: videoSrc.value, to: nxt, idx: playIdx }) } catch (_) {}
    setTimeout(() => {
      videoError.value = ''
      videoSrc.value = nxt
      setTimeout(() => {
        const v2 = videoRef.value
        if (!v2) return
        v2.load()
        afterMetaSeek(v2, playBaseT, { play: true })
      }, 50)
    }, 0)
    return
  }
  let msg = '未知错误'
  if (err) {
    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED: msg = '加载被中断'; break
      case MediaError.MEDIA_ERR_NETWORK: msg = '网络错误或协议不可用（ERR_NETWORK）'; break
      case MediaError.MEDIA_ERR_DECODE: msg = '视频解码失败（格式不支持）'; break
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = '协议不支持或文件不存在（ERR_SRC_NOT_SUPPORTED）'; break
      default: msg = `错误码 ${err.code}`
    }
  }
  videoError.value = msg
  console.error('[Review] video error', msg, err, 'src=', videoSrc.value)
  try { window.noteAPI?.logWrite?.('error', 'Review', 'video-error', { msg, code: err?.code, src: videoSrc.value, sessionId: sessionId.value }) } catch (_) {}
}
function onVideoLoaded() {
  videoError.value = ''  // 加载成功 → 清错误
  try { window.noteAPI?.logWrite?.('info', 'Review', 'video-loaded', { src: videoSrc.value, sessionId: sessionId.value }) } catch (_) {}
}
function retryCurrentVideo() {
  videoError.value = ''
  setVideoSegment(curSegIndex.value)
}

// 二分：segmentStarts 里找 <= sec 的最大下标（新录屏精确跳段）
function bisectSegIndex(starts: number[], sec: number): number {
  if (!starts.length) return 0
  let lo = 0, hi = starts.length - 1
  if (sec >= starts[hi]) return hi
  if (sec < starts[0]) return 0
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= sec) lo = mid
    else hi = mid - 1
  }
  return lo
}

// 段起始秒：新录屏用 segmentStarts[i]；旧录屏兜底 i*SEG_LEN
function segOffsetAt(i: number): number {
  if (segmentStarts.value.length) return segmentStarts.value[Math.max(0, Math.min(i, segmentStarts.value.length - 1))] || 0
  return i * SEG_LEN
}

const fmtDur = (s: number) => {
  s = s || 0
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}小时${m}分` : `${m}分钟`
}
const fmtSec = (s: number) => {
  s = Math.max(0, Math.round(s || 0))
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}
// 会话卡片字节显示（B/KB/MB/GB）
const fmtBytes = (b: number) => {
  const n = Number(b || 0)
  if (n <= 0) return '0B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)}${units[i]}`
}

// 解析笔记中的跟拍条目（## 🎥/⏱ 段 + ⏱ sec=N）
const parseEntries = (content: string) => {
  const blocks = String(content || '').split(/\n(?=## 🎥|## ⏱)/)
  const out: any[] = []
  for (const b of blocks) {
    const secM = b.match(/⏱ sec=(\d+)/)
    if (!secM) continue
    const sec = parseInt(secM[1])
    const timeM = b.match(/^## 🎥\s*([^\s【]*)/) || b.match(/^## ⏱\s*([^\s【]*)/)
    const time = timeM ? timeM[1] : fmtSec(sec)
    const html = marked.parse(b.replace(/⏱ sec=\d+/, '').trim())
    out.push({ sec, time, html })
  }
  return out
}

const loadSession = async (s: any) => {
  sessionId.value = s.sessionId
  noteId.value = s.noteId || ''
  segments.value = s.segments || []
  // Day 2 P0-V4：优先 meta.segmentStarts（精确）；没有就生成一份 SEG_LEN 假表向后兼容
  if (Array.isArray(s.segmentStarts) && s.segmentStarts.length === segments.value.length) {
    segmentStarts.value = s.segmentStarts.slice()
    segmentDurations.value = Array.isArray(s.segmentDurations) ? s.segmentDurations.slice() : []
  } else {
    segmentStarts.value = segments.value.map((_, i) => i * SEG_LEN)
    segmentDurations.value = segments.value.map(() => SEG_LEN)
  }
  curSegIndex.value = 0
  curSegOffset.value = segOffsetAt(0)
  activeIdx.value = -1
  // 加载笔记条目
  if (noteId.value) {
    try {
      const note = await window.noteAPI.getNote(noteId.value)
      if (note) entries.value = parseEntries(note.content)
      else entries.value = []
    } catch (e) { entries.value = [] }
  } else {
    entries.value = []
  }
  setVideoSegment(0)
}

const setVideoSegment = (idx: number) => {
  try { window.noteAPI?.logWrite?.('info', 'Review', 'set-video-enter', { idx, segs: segments.value.length }) } catch (_) {}
  if (!segments.value.length || idx < 0 || idx >= segments.value.length) return
  curSegIndex.value = idx
  curSegOffset.value = segOffsetAt(idx)
  // 构建候选源队列，逐级降级：重编码 H264 > WebM > MP4 > 当前 seg
  playIdx = 0
  const segs = segments.value
  const fullH = segs.find(s => s.includes('full_h264.mp4'))
  const fullW = segs.find(s => s.includes('full.webm'))
  const fullM = segs.find(s => s.includes('full.mp4'))
  playQueue.length = 0
  if (fullH) playQueue.push(recHttpUrl(fullH))
  if (fullW) playQueue.push(recHttpUrl(fullW))
  if (fullM) playQueue.push(recHttpUrl(fullM))
  const curSeg = segs[idx]
  if (curSeg && !curSeg.includes('full')) playQueue.push(recHttpUrl(curSeg))
  playBaseT = (segs.some(s => s.includes('full'))) ? segOffsetAt(idx) : 0
  playCurrentCandidate()
}

const navSeg = (dir: number) => {
  const next = curSegIndex.value + dir
  if (next >= 0 && next < segments.value.length) setVideoSegment(next)
}

// 点击条目 → 跳转对应段 + seek（Day 2：有 segmentStarts 时二分精确定位）
const seekTo = (en: any) => {
  const sec = Math.max(0, en.sec || 0)
  // full 整片模式：直接跳全片绝对秒（currentTime 与条目 sec 同一时间轴）
  if (segments.value.some(seg => seg.includes('full_h264') || seg.includes('full.webm') || seg.includes('full.mp4'))) {
    const v = videoRef.value
    afterMetaSeek(v, sec, { play: true })
    return
  }
  const targetSeg = bisectSegIndex(segmentStarts.value, sec)
  const inSeg = Math.max(0, sec - segOffsetAt(targetSeg))
  if (targetSeg !== curSegIndex.value) {
    // 切段后必须等新源 load 完再 seek，否则 currentTime 写在 loadedmetadata 前会丢帧
    setVideoSegment(targetSeg)
    setTimeout(() => {
      const v = videoRef.value
      if (!v) return
      afterMetaSeek(v, inSeg, { play: true })
    }, 120)
  } else {
    const v = videoRef.value
    afterMetaSeek(v, inSeg, { play: true })
  }
}

// 播放中联动高亮条目
let scrollT: any = null
const onTime = () => {
  const v = videoRef.value
  if (!v || !entries.value.length) return
  // full 整片模式：currentTime 即全片真实时间，直接对照条目 sec；逐段模式才需加段偏移
  const fullMode = segments.value.some(seg => seg.includes('full_h264') || seg.includes('full.webm') || seg.includes('full.mp4'))
  const totalSec = fullMode ? v.currentTime : curSegOffset.value + v.currentTime
  let best = -1, bestDiff = Infinity
  for (let i = 0; i < entries.value.length; i++) {
    const diff = Math.abs(entries.value[i].sec - totalSec)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  }
  if (best !== -1 && best !== activeIdx.value) {
    activeIdx.value = best
    if (scrollT) clearTimeout(scrollT)
    scrollT = setTimeout(() => {
      const el = entriesRef.value?.querySelectorAll('.rev-entry')[best]
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 200)
  }
}

async function refreshSessions() {
  try {
    sessions.value = await window.noteAPI.recListSessions()
    // 只取有视频文件的会话（排除正在录/已空的）
    const withVideo = sessions.value.filter(s => s.segments && s.segments.length > 0)
    const sid = route.query.sessionId as string
    let target
    if (sid) {
      target = sessions.value.find(s => s.sessionId === sid) || withVideo[0]
    } else {
      target = withVideo[0] // 默认加载最新有视频的
    }
    if (target) {
      console.log('[Review] 默认加载', target.sessionId, target.segments?.length, 'segments')
      await loadSession(target)
    } else {
      console.log('[Review] 没有可用的录屏会话')
    }
  } catch (e) { /* ignore */ }
}

// 删除单个录屏会话（4.2 录屏管理 UI：单条删除 + 二次确认；避免手滑删正在看的会话）
const deleteSession = async (s: any) => {
  if (!s || !s.sessionId) return
  const sizeText = fmtBytes(s.bytes || 0)
  const userText = (window.prompt(`确定删除该录屏会话吗？\n会话：${s.title || s.sessionId}\n时长：${fmtDur(s.durationSec)}，占用：${sizeText}，段数：${s.segments?.length || 0}\n\n请输入 "删除录屏" 四个字确认删除：\n（取消或输入错误 = 不删除）`) || '').trim()
  if (userText !== '删除录屏') return
  try {
    const api = window.noteAPI
    const ok = await (api?.recDeleteSession ? api.recDeleteSession(s.sessionId) : null)
    if (ok === false) throw new Error('主进程删除失败')
    try { window.noteAPI?.logWrite?.('info', 'Review', 'delete-session', { sessionId: s.sessionId, sizeText }) } catch (_) {}
  } catch (e) {
    alert('删除会话失败：' + ((e as any)?.message || String(e)))
    return
  }
  // 删完刷新
  if (sessionId.value === s.sessionId) {
    // 若删的是正在看的：清 video、清 entries
    sessionId.value = ''
    noteId.value = ''
    segments.value = []
    segmentStarts.value = []
    segmentDurations.value = []
    curSegIndex.value = 0
    curSegOffset.value = 0
    videoSrc.value = ''
    videoError.value = ''
    entries.value = []
    activeIdx.value = -1
    playQueue.length = 0; playIdx = 0; playBaseT = 0
  }
  await refreshSessions()
}
onMounted(() => {
  refreshSessions()
  // 录屏停止（notes:changed）时自动刷新会话列表，让新录好的会话立即出现，无需手动点 🔄 或重进页面
  try { window.noteAPI?.onNotesChanged?.(() => refreshSessions()) } catch (_) {}
})
watch(() => route.fullPath, refreshSessions)
onUnmounted(() => { if (scrollT) clearTimeout(scrollT) })
</script>

<style scoped>
.review-page { padding: 28px; height: 100%; box-sizing: border-box; position: relative; overflow: hidden; }
.content-layer { position: relative; z-index: 1; display: flex; gap: 20px; height: 100%; }
.review-left { flex: 1.1; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.review-right { flex: 1; display: flex; flex-direction: column; min-width: 0; border-radius: 16px; background: var(--color-bg-card); border: 1px solid var(--color-border); overflow: hidden; }

.rev-sessions { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; position: relative; }
.rev-refresh {
  flex-shrink: 0; align-self: center; padding: 6px 10px; font-size: 12px;
  border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg-soft);
  color: var(--color-text); cursor: pointer; white-space: nowrap;
}
.rev-refresh:hover { border-color: var(--color-purple); }
.rev-session {
  flex-shrink: 0; display: flex; flex-direction: row; align-items: stretch; gap: 6px; padding: 8px;
  border-radius: 12px; background: var(--color-bg-soft); border: 1px solid var(--color-border);
  transition: border-color 0.15s, transform 0.15s;
  min-width: 0;
}
.rev-session:hover { border-color: var(--color-purple); transform: translateY(-1px); }
.rev-session.active { border-color: var(--color-pink); background: var(--color-pink-light); }
.rs-card-btn {
  display: flex; flex-direction: row; align-items: stretch; gap: 8px;
  padding: 0; background: transparent; border: none; cursor: pointer; text-align: left;
  border-radius: 8px; min-width: 0; flex: 1;
}
.rs-thumb {
  width: 128px; height: 72px; object-fit: cover; border-radius: 6px;
  background: #000; flex-shrink: 0; border: 1px solid var(--color-border);
}
.rs-thumb-placeholder {
  display: flex; align-items: center; justify-content: center; color: var(--color-text-tertiary);
  background: var(--color-bg-card); font-size: 24px;
}
.rs-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 2px 2px; flex: 1; }
.rs-title { font-size: 12px; font-weight: 700; color: var(--color-text); white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.rs-meta { font-size: 10px; color: var(--color-text-tertiary); }
.rs-del-btn {
  flex-shrink: 0; width: 28px; height: 28px; align-self: flex-start;
  border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-bg-card);
  color: var(--color-text-secondary); cursor: pointer; font-size: 13px; line-height: 1;
  transition: all 0.15s;
}
.rs-del-btn:hover { color: #fff; background: var(--color-danger, #e53935); border-color: var(--color-danger, #e53935); }

.rev-player-area { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.rev-video { width: 100%; flex: 1; border-radius: 14px; background: #000; object-fit: contain; min-height: 0; }
.rev-player-empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  border-radius: 14px; background: var(--color-bg-soft); border: 1px dashed var(--color-border);
  color: var(--color-text-tertiary); font-size: 13px;
}
.rev-video-error {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 20px;
  border-radius: 14px; background: #2a1515; border: 1px solid #ff4444;
  color: #ffaaaa; font-size: 13px; text-align: center;
}
.rve-title { font-size: 15px; font-weight: 700; color: #ff9999; }
.rve-detail { font-size: 13px; color: #ffcccc; max-width: 400px; }
.rve-hint { font-size: 11px; color: #888; font-family: monospace; word-break: break-all; max-width: 500px; }
.rev-seg-nav { display: flex; align-items: center; gap: 12px; justify-content: center; }
.seg-btn {
  padding: 5px 14px; border-radius: 10px; border: 1px solid var(--color-border);
  background: var(--color-bg-soft); color: var(--color-text); font-size: 12px; cursor: pointer;
}
.seg-btn:hover { border-color: var(--color-pink); color: var(--color-pink); }
.seg-info { font-size: 11px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }

.rev-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; border-bottom: 1px solid var(--color-border); }
.rev-title { font-size: 14px; font-weight: 800; color: var(--color-text); margin: 0; }
.rev-back {
  padding: 4px 12px; border-radius: 9px; border: none; font-size: 11px; cursor: pointer;
  background: var(--color-bg-soft); color: var(--color-text-secondary);
}
.rev-back:hover { color: var(--color-pink); }
.rev-entries { flex: 1; overflow-y: auto; padding: 10px 14px 20px; display: flex; flex-direction: column; gap: 8px; }
.rev-entry {
  padding: 10px 12px; border-radius: 12px; background: var(--color-bg-soft);
  border: 1px solid var(--color-border); cursor: pointer; transition: all 0.15s;
}
.rev-entry:hover { border-color: var(--color-purple); }
.rev-entry.active { border-color: var(--color-pink); background: var(--color-pink-light); box-shadow: 0 0 0 2px rgba(255,107,157,0.15); }
.rev-entry-time { font-size: 12px; font-weight: 800; color: var(--color-pink); margin-bottom: 4px; }
.rev-entry-body { font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.65; }
.rev-entry-body :deep(img) { max-width: 100%; border-radius: 8px; margin: 4px 0; }
.rev-entry-sec { font-size: 10px; color: var(--color-text-tertiary); margin-top: 4px; font-variant-numeric: tabular-nums; }
.rev-empty { font-size: 12px; color: var(--color-text-tertiary); text-align: center; padding: 20px; }
</style>
