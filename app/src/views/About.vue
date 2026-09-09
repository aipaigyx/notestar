<template>
  <div class="about-page">
    <!-- 背景光晕 -->
    <div class="glow-orb glow-gold" style="width: 420px; height: 420px; top: 40px; left: -80px;"></div>
    <div class="glow-orb glow-purple" style="width: 460px; height: 460px; top: 420px; right: -120px;"></div>

    <div class="content-layer">
      <div class="about-container">
        <!-- 返回 -->
        <button type="button" class="back-btn" @click="goBack">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>返回设置</span>
        </button>

        <!-- Hero：应用铭牌 -->
        <section class="hero-card">
          <div class="hero-badge" aria-hidden="true">
            <svg viewBox="0 0 96 96" width="76" height="76" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="48" cy="48" r="44" fill="#0A0418" stroke="url(#aboutGold)" stroke-width="2"/>
              <defs>
                <linearGradient id="aboutGold" x1="0" y1="0" x2="100" y2="100">
                  <stop offset="0%" stop-color="#FCE3A0"/><stop offset="100%" stop-color="#C49A45"/>
                </linearGradient>
                <radialGradient id="aboutCore" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#FFF5D6"/><stop offset="55%" stop-color="#E8B449"/><stop offset="100%" stop-color="#C49A45"/>
                </radialGradient>
              </defs>
              <!-- 星轨 -->
              <g fill="none" stroke="url(#aboutGold)" stroke-width="1.4" opacity=".75">
                <ellipse cx="48" cy="48" rx="34" ry="14" transform="rotate(-24 48 48)"/>
                <ellipse cx="48" cy="48" rx="34" ry="14" transform="rotate(42 48 48)"/>
                <ellipse cx="48" cy="48" rx="34" ry="14" transform="rotate(108 48 48)"/>
              </g>
              <!-- 中央火种/书页 -->
              <circle cx="48" cy="48" r="16" fill="url(#aboutCore)" opacity=".9"/>
              <path d="M48 38c6 5 8 9 8 13a8 8 0 1 1-16 0c0-4 2-8 8-13Z" fill="#3A2D54" opacity=".55"/>
              <path d="M48 41c4 4 6 7 6 10a6 6 0 1 1-12 0c0-3 2-6 6-10Z" fill="#FFF5D6"/>
              <!-- 四角星芒 -->
              <path d="M48 10v6M48 80v6M10 48h6M80 48h6" stroke="#FCE3A0" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 class="hero-title">笔记星图 <span class="hero-sub-en">NoteStar</span></h1>
          <p class="hero-tagline">二次元网课笔记工具 · 云端 &amp; 本地双模式 · 数据自主可控</p>
          <div class="hero-meta">
            <span class="meta-chip" v-if="appVersion">版本 v{{ appVersion }}</span>
            <span class="meta-chip">MIT License</span>
            <span class="meta-chip">Windows</span>
          </div>
        </section>

        <!-- 项目介绍 -->
        <section class="about-section">
          <div class="section-header">
            <h3 class="section-title">关于本项目</h3>
            <p class="section-desc">把「上网课 → 记笔记 → 复习巩固」的完整学习闭环，做成本地运行的二次元桌面工具</p>
          </div>
          <div class="intro-text">
            <p>
              「笔记星图」是一款二次元风格网课笔记与复习桌面工具。界面采用幻想系二次元美学（翁法罗斯主题），核心能力围绕「<strong>录屏自动跟拍成笔记</strong>」与「<strong>AI 理解与复习</strong>」展开。AI 支持<strong>云端 &amp; 本地双模式</strong>——你可以选择接入 DeepSeek / 火山引擎等云端 API，也可以使用本机 Ollama 本地模型，数据自主可控。
            </p>
            <p>
              它想解决的问题很朴素：上网课时的重点一闪而过，截屏存一堆却再也不会翻。于是工具在后台悄悄替你看课——每 30 秒截一帧画面、用本地视觉模型理解内容并写成带时间轴的图文条目，课一上完，一份可回看的「跟拍笔记」就已经躺在笔记页里。
            </p>
          </div>
        </section>

        <!-- 工作原理 -->
        <section class="about-section">
          <div class="section-header">
            <h3 class="section-title">60 秒看懂它怎么工作</h3>
          </div>
          <ol class="steps">
            <li v-for="(s, i) in howItWorks" :key="i" class="step-item">
              <span class="step-num">{{ i + 1 }}</span>
              <span class="step-body">{{ s }}</span>
            </li>
          </ol>
        </section>

        <!-- 特性一览 -->
        <section class="about-section">
          <div class="section-header">
            <h3 class="section-title">特性一览</h3>
          </div>
          <div class="feature-grid">
            <div v-for="(f, i) in features" :key="i" class="feature-card">
              <span class="feature-dot" :style="{ '--fd': f.color }" aria-hidden="true"></span>
              <span class="feature-name">{{ f.name }}</span>
              <span class="feature-desc">{{ f.desc }}</span>
            </div>
          </div>
        </section>

        <!-- 技术栈 -->
        <section class="about-section">
          <div class="section-header">
            <h3 class="section-title">技术栈</h3>
          </div>
          <div class="stack-wrap">
            <span v-for="(t, i) in stack" :key="i" class="stack-chip">{{ t }}</span>
          </div>
        </section>

        <!-- 数据与隐私 -->
        <section class="about-section">
          <div class="section-header">
            <h3 class="section-title">数据与隐私</h3>
            <p class="section-desc">本地优先不是口号——是你对数据的所有权</p>
          </div>
          <ul class="privacy-list">
            <li>所有笔记、截图、录屏会话均为<strong>本地文件</strong>（默认 <code>app/data</code>），不依赖任何云端账号</li>
            <li>AI 支持<strong>双模式</strong>：云端模式使用 DeepSeek / 火山引擎 API（需自行配置 Key）；本地模式使用本机 Ollama 服务，数据不出本机</li>
            <li>彻底清理：退出应用后删除 <code>app/data</code> 目录即可</li>
          </ul>
        </section>

        <!-- 作者 -->
        <section class="about-section author-section">
          <div class="section-header">
            <h3 class="section-title">作者</h3>
            <p class="section-desc">一个人把「学习工具」做成「二次元美学 × 本地优先」的可玩之物</p>
          </div>
          <div class="author-row">
            <div class="author-avatar" aria-hidden="true">Y</div>
            <div class="author-info">
              <div class="author-name">星萌Y小郭酱</div>
              <div class="author-role">独立开发 · Bilibili UP 主（uid 12644772）</div>
              <div class="author-bio">
                二次元 / Blender 三渲二 / 一人全栈开发。作品包括「一人全栈开发本地虚拟 AI 桌面伴侣」系列，
                也制作 AE / Maya / Blender 教程与 MAD。如果这个项目对你有帮助，欢迎一键三连或在仓库提 Issue / Star。
              </div>
              <a class="author-link" href="https://space.bilibili.com/12644772" target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 1L12 3.5V7C12 10 9.9 12.4 7 13C4.1 12.4 2 10 2 7V3.5L7 1Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                  <path d="M5 7L6.4 8.4L9 5.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>bilibili.com/12644772</span>
              </a>
            </div>
          </div>
        </section>

        <!-- 开源许可 -->
        <section class="about-section">
          <div class="section-header">
            <h3 class="section-title">开源许可</h3>
          </div>
          <div class="license-box">
            <p>本项目基于 <strong>MIT License</strong> 开源。欢迎自由使用、修改、再分发；请保留版权与许可声明。</p>
            <p>
              <strong>引用与二次开发须知</strong>：如引用本项目（代码、设计或其中任何部分内容）或基于本项目进行二次开发、再发布，
              请<strong>标明本仓库出处</strong>（附仓库链接及作者署名）。本仓库会<strong>不定时更新</strong>（持续迭代、修复与新增功能），
              引用或二次开发时请留意同步上游最新版本。
            </p>
          </div>
        </section>

        <footer class="about-footer">
          笔记星图 NoteStar · 二次元网课笔记工具 · Made with 💜 &amp; 本地大模型
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { isElectron } from '../store'

const router = useRouter()
const appVersion = ref('')

const howItWorks = [
  '打开悬浮球，点一下「录屏笔记」→ 系统获取屏幕录制授权',
  '正常上网课，工具在后台每 30 秒自动截一帧画面',
  'AI（云端或本地模型）自动理解画面并用中文写出描述，实时追加到跟拍笔记',
  '识别结果以 🎥 mm:ss + 截图 + 描述的格式实时追加到一条跟拍笔记',
  '停止录屏 → 视频按时间轴落盘、会话与笔记互联 → 像回放视频一样按时间码看到所有重点',
  '之后 AI 助教基于笔记上下文随时讲解、生成测验、做知识图谱关联',
]

const features = [
  { name: '跟拍笔记', desc: '悬浮球录屏，每 30s 自动截帧识别，生成带时间轴图文笔记', color: '#FF8BB5' },
  { name: 'AI 双模式', desc: '支持 DeepSeek / 火山引擎云端 API，也支持本机 Ollama 本地模型', color: '#C896FF' },
  { name: '复习闭环', desc: 'AI 出题测验、沉浸式复习、到期提醒、AI 助教讲解', color: '#7DD3E8' },
  { name: '知识网络', desc: '万帷网图谱：本地向量驱动的知识点关联与跨课程检索', color: '#F5D472' },
  { name: '语音闭环', desc: 'faster-whisper 本地转写，Windows SAPI 朗读听记', color: '#5EEAD4' },
  { name: '二次元美学', desc: '翁法罗斯主题：粉紫鎏金、Bento 卡片、柔和光晕、纯代码 SVG', color: '#FFC0D5' },
]

const stack = [
  'Vue 3', 'TypeScript', 'Vite', 'Electron',
  'DeepSeek API', '火山引擎', 'Ollama',
  'moondream', 'qwen2.5', 'faster-whisper',
  'nomic-embed-text', 'KaTeX', 'Windows SAPI',
]

function goBack() {
  router.push('/settings')
}

onMounted(async () => {
  // 版本号：优先从主进程 package 读（Electron），浏览器预览下留空
  if (isElectron && window.noteAPI?.getAppVersion) {
    try {
      const info = await window.noteAPI.getAppVersion()
      appVersion.value = (info && typeof info === 'object') ? (info.version || '') : ''
    } catch { /* ignore */ }
  }
})
</script>

<style scoped>
/* ==============================================================
   翁法罗斯 · 关于页（深紫鎏金 · 与设置页同语言）
   ============================================================== */
.about-page { width: 100%; height: 100%; position: relative; overflow: hidden; }
.about-page :deep(.content-layer) { padding: 0; }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; overflow-y: auto; }

.about-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 返回按钮 */
.back-btn {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  background: rgba(232, 198, 106, 0.08);
  border: 1px solid rgba(232, 198, 106, 0.35);
  color: var(--om-text-sec, #C9BDE4);
  font-size: 13px;
  cursor: pointer;
  transition: all .2s ease;
}
.back-btn:hover { background: rgba(232, 198, 106, 0.18); color: var(--om-gold, #E8C66A); }

/* Hero */
.hero-card {
  position: relative;
  text-align: center;
  padding: 38px 28px 32px;
  background:
    radial-gradient(320px 160px at 50% -20%, rgba(232, 198, 106, 0.18) 0%, transparent 70%),
    linear-gradient(150deg, #241A4A 0%, #1A1140 100%);
  border: 1px solid rgba(232, 198, 106, 0.35);
  border-radius: 18px;
  box-shadow: 0 8px 30px rgba(10, 4, 24, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.hero-card::before, .hero-card::after {
  content: ''; position: absolute; width: 14px; height: 14px;
  border: 2px solid var(--om-gold, #E8C66A);
  pointer-events: none;
}
.hero-card::before { top: 8px; left: 8px;  border-right: none; border-bottom: none; }
.hero-card::after  { bottom: 8px; right: 8px; border-left: none; border-top: none; }

.hero-badge { display: flex; justify-content: center; margin-bottom: 14px; filter: drop-shadow(0 6px 18px rgba(232, 198, 106, 0.35)); }
.hero-title {
  font-size: 30px; font-weight: 800; letter-spacing: 3px;
  color: var(--om-gold, #E8C66A);
  text-shadow: 0 0 16px rgba(232, 198, 106, 0.4);
  display: flex; align-items: center; justify-content: center; gap: 12px;
}
.hero-sub-en {
  font-size: 14px; font-weight: 600; letter-spacing: 2px;
  color: var(--om-text-sec, #C9BDE4);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(232, 198, 106, 0.25);
  padding: 3px 10px; border-radius: 999px;
}
.hero-tagline { margin-top: 12px; font-size: 13px; letter-spacing: 2px; color: var(--om-text-mute, #8B7FC4); }
.hero-meta { margin-top: 18px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.meta-chip {
  font-size: 12px; letter-spacing: 1px;
  color: var(--om-text-sec, #C9BDE4);
  border: 1px solid rgba(232, 198, 106, 0.3);
  background: rgba(232, 198, 106, 0.07);
  padding: 4px 12px; border-radius: 999px;
}

/* 通用区块卡 */
.about-section {
  position: relative;
  background: linear-gradient(150deg, #241A4A 0%, #1A1140 100%);
  border: 1px solid rgba(232, 198, 106, 0.32);
  border-radius: 16px;
  padding: 24px 26px;
  box-shadow: 0 6px 24px rgba(10, 4, 24, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.about-section::before, .about-section::after {
  content: ''; position: absolute; width: 10px; height: 10px;
  border: 1.5px solid var(--om-gold, #E8C66A);
  pointer-events: none;
}
.about-section::before { top: 6px; left: 6px;  border-right: none; border-bottom: none; }
.about-section::after  { bottom: 6px; right: 6px; border-left: none; border-top: none; }

.section-header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed rgba(232, 198, 106, 0.25); }
.section-title {
  font-size: 17px; font-weight: 700;
  color: var(--om-gold, #E8C66A);
  letter-spacing: 2px;
  display: flex; align-items: center; gap: 10px;
}
.section-title::before { content: '✦'; color: var(--om-gold, #E8C66A); font-size: 13px; filter: drop-shadow(0 0 6px rgba(232, 198, 106, 0.6)); }
.section-desc { margin-top: 6px; font-size: 12px; color: var(--om-text-mute, #8B7FC4); line-height: 1.6; letter-spacing: .5px; }

/* 介绍正文 */
.intro-text { display: flex; flex-direction: column; gap: 12px; }
.intro-text p {
  font-size: 13.5px; line-height: 1.9;
  color: var(--om-text-sec, #C9BDE4);
  letter-spacing: .3px;
}
.intro-text strong { color: var(--om-gold, #E8C66A); font-weight: 600; }

/* 步骤列表 */
.steps { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.step-item { display: flex; align-items: flex-start; gap: 12px; }
.step-num {
  flex-shrink: 0; width: 24px; height: 24px; margin-top: 1px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  color: #0A0418;
  background: linear-gradient(135deg, var(--om-gold, #E8C66A), var(--om-gold-deep, #C49A45));
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(232, 198, 106, 0.4);
}
.step-body { font-size: 13px; line-height: 1.7; color: var(--om-text-sec, #C9BDE4); }

/* 特性网格 */
.feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.feature-card {
  display: flex; flex-direction: column; gap: 7px;
  padding: 14px 15px;
  background: rgba(10, 4, 24, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: transform .2s ease, border-color .2s ease;
}
.feature-card:hover { transform: translateY(-2px); border-color: rgba(232, 198, 106, 0.4); }
.feature-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fd); box-shadow: 0 0 8px var(--fd); }
.feature-name { font-size: 14px; font-weight: 700; color: var(--om-text-pri, #F5E0B0); letter-spacing: 1px; }
.feature-desc { font-size: 12px; line-height: 1.65; color: var(--om-text-mute, #8B7FC4); }

/* 技术栈 chips */
.stack-wrap { display: flex; flex-wrap: wrap; gap: 9px; }
.stack-chip {
  font-size: 12px; letter-spacing: .5px;
  color: var(--om-text-sec, #C9BDE4);
  background: rgba(232, 198, 106, 0.08);
  border: 1px solid rgba(232, 198, 106, 0.28);
  padding: 5px 13px; border-radius: 999px;
}

/* 隐私 */
.privacy-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.privacy-list li {
  position: relative; padding-left: 18px;
  font-size: 13px; line-height: 1.7; color: var(--om-text-sec, #C9BDE4);
}
.privacy-list li::before {
  content: ''; position: absolute; left: 2px; top: 9px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--om-gold, #E8C66A); box-shadow: 0 0 6px rgba(232, 198, 106, 0.6);
}
.privacy-list code {
  font-family: Consolas, Monaco, monospace; font-size: 12px;
  color: #F5D472; background: rgba(232, 198, 106, 0.1);
  padding: 1px 6px; border-radius: 4px;
}
.privacy-list strong { color: var(--om-gold, #E8C66A); font-weight: 600; }

/* 作者 */
.author-row { display: flex; gap: 18px; align-items: flex-start; }
.author-avatar {
  flex-shrink: 0; width: 72px; height: 72px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 32px; font-weight: 800; color: #0A0418;
  background: linear-gradient(135deg, var(--om-gold, #E8C66A), #F5D472);
  box-shadow: 0 4px 18px rgba(232, 198, 106, 0.4);
}
.author-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.author-name { font-size: 17px; font-weight: 800; color: var(--om-text-pri, #F5E0B0); letter-spacing: 1px; }
.author-role { font-size: 12px; color: var(--om-text-mute, #8B7FC4); letter-spacing: .5px; }
.author-bio { margin-top: 6px; font-size: 12.5px; line-height: 1.8; color: var(--om-text-sec, #C9BDE4); }
.author-link {
  margin-top: 10px; align-self: flex-start;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; letter-spacing: .5px;
  color: #0A0418;
  background: linear-gradient(135deg, var(--om-gold, #E8C66A), var(--om-gold-deep, #C49A45));
  box-shadow: 0 4px 14px rgba(232, 198, 106, 0.3);
  text-decoration: none;
  transition: opacity .2s ease;
}
.author-link:hover { opacity: .9; }

/* License */
.license-box { display: flex; flex-direction: column; gap: 10px; }
.license-box p {
  font-size: 13px; line-height: 1.85;
  color: var(--om-text-sec, #C9BDE4);
}
.license-box strong { color: var(--om-gold, #E8C66A); font-weight: 600; }

/* footer */
.about-footer {
  text-align: center;
  font-size: 12px; letter-spacing: 1px;
  color: var(--om-text-mute, #8B7FC4);
  opacity: .8;
  padding: 6px 0 2px;
}
</style>
