/**
 * 黄金裔熄灭语音播放器
 * 语音文件约定：public/heirs/voices/<id>.mp3
 * 用户需自行放入对应角色的音频文件
 */

const audioCache = new Map<string, HTMLAudioElement>()
let currentAudio: HTMLAudioElement | null = null

/**
 * 播放指定角色的熄灭语音
 * @param voicePath 语音路径（如 'heirs/voices/march7.mp3'）
 * @param onError 加载失败回调
 */
export function playHeirVoice(voicePath: string, onError?: () => void): void {
  // 停止当前播放
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }

  // 从缓存取
  let audio = audioCache.get(voicePath)
  if (!audio) {
    audio = new Audio(voicePath)
    audio.preload = 'auto'
    audio.volume = 0.7
    audioCache.set(voicePath, audio)
  }

  audio.currentTime = 0
  currentAudio = audio

  audio.play().catch(() => {
    // 文件不存在/加载失败，静默忽略
    currentAudio = null
    onError?.()
  })
}

/**
 * 停止当前正在播放的语音
 */
export function stopHeirVoice(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}

/**
 * 预加载所有角色的语音文件
 */
export function preloadHeirVoices(voicePaths: string[]): void {
  for (const path of voicePaths) {
    if (!audioCache.has(path)) {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = 0.7
      audioCache.set(path, audio)
    }
  }
}