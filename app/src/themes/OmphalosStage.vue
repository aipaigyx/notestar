<!-- 翁法罗斯皮肤舞台：背景层 + 粒子层 + 罗马柱剪影 -->
<template>
  <Teleport to="body" v-if="skinLayers.background">
    <div class="om-bg" aria-hidden="true">
      <img class="om-bg-image" :src="bgImageUrl" alt="" />
      <div class="om-bg-veil"></div>
    </div>
  </Teleport>

  <div class="om-stage" :data-theme="activeTheme">
    <!-- L1 鎏金雾光顶部 -->
    <div v-if="skinLayers.background" class="om-top-haze" aria-hidden="true"></div>
    <!-- L2 罗马柱剪影 -->
    <div v-if="skinLayers.background" class="om-columns" aria-hidden="true">
      <div v-for="i in 6" :key="i" class="om-column"></div>
    </div>
    <!-- L3 金色光尘粒子（14 颗小位移，性能友好：低配机不卡顿） -->
    <div v-if="skinLayers.particles" class="om-particles" aria-hidden="true">
      <span v-for="i in 14" :key="i" class="om-particle" :style="particleStyle(i)"></span>
    </div>
    <!-- L7 中心内容槽（slot） -->
    <div class="om-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Teleport } from 'vue'
import { useThemeEngine } from './engine'
import bgImage from '../assets/themes/omphalos/background.png'

const { activeTheme, skinLayers } = useThemeEngine()
const bgImageUrl = (bgImage as any) || ''

function particleStyle(i: number) {
  const left  = 4 + ((i * 37) % 92)      // 水平 4%..96%
  const top   = 5 + ((i * 53) % 45)      // 起始在视口上部 5%..50%（不全屏满铺）
  const size  = 2 + (i % 3)              // 2-4px 小粒子
  const delay = (i * 0.9) % 7
  const dur   = 7 + (i % 4)              // 7-10s
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${delay}s`,
    animationDuration: `${dur}s`,
    willChange: 'transform, opacity',
  } as Record<string, string>
}
</script>

<style scoped>
.om-stage { position: relative; min-height: 100vh; width: 100%; color: var(--om-text-pri); font-family: var(--om-font-cn); }
/* 让 stage 内的所有子元素浮在背景之上 */
.om-stage > *:not(.om-bg):not(.om-top-haze):not(.om-columns):not(.om-particles):not(.om-fret) {
  position: relative;
  z-index: 1;
}

/* 鎏金雾光（顶部） */
.om-top-haze { position: fixed; top: 0; left: 0; right: 0; height: 200px; z-index: -6; background: linear-gradient(180deg, rgba(232, 198, 106, 0.08) 0%, transparent 100%); pointer-events: none; }

/* L2 罗马柱 */
.om-columns { position: fixed; top: 0; bottom: 0; left: 0; right: 0; z-index: -5; display: flex; justify-content: space-around; pointer-events: none; opacity: 0.04; }
.om-column { width: 60px; background: linear-gradient(180deg, transparent 0%, #F5D472 5%, #C49A45 50%, #8B5A2B 95%, transparent 100%); position: relative; }
.om-column::before, .om-column::after { content: ''; position: absolute; left: -8px; right: -8px; height: 12px; background: #C49A45; }
.om-column::before { top: 0; border-top: 2px solid #E8C66A; }
.om-column::after  { bottom: 0; border-bottom: 2px solid #E8C66A; }

/* L3 粒子（轻量：小幅上飘，天然支持 GPU 合成） */
.om-particles { position: fixed; inset: 0; z-index: -4; pointer-events: none; }
.om-particle {
  position: absolute;
  background: radial-gradient(circle, #FFF5D6 0%, #F5D472 55%, transparent 100%);
  border-radius: 50%;
  opacity: 0;
  animation: om-float ease-in-out infinite;
}
@keyframes om-float {
  0%   { opacity: 0; transform: translate3d(0, 0, 0) scale(0.6); }
  12%  { opacity: 0.85; }
  55%  { opacity: 0.55; transform: translate3d(12px, -22vh, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(-6px, -38vh, 0) scale(1.15); }
}

/* 减少动效：粒子静止（尊重系统设置 + 极低配兜底） */
@media (prefers-reduced-motion: reduce) {
  .om-particles { display: none; }
}

/* L7 内容槽 */
.om-content { position: relative; z-index: 3; }
</style>
