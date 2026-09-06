<!-- 皮肤选择器：当前激活皮肤横幅 + 沉浸装饰层开关 -->
<template>
  <div class="skin-selector">
    <!-- 当前激活皮肤横幅 -->
    <div class="skin-banner">
      <div class="skin-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="none" :stroke="omGold" stroke-width="1.4"/>
          <circle cx="18.5" cy="5.5" r="2" :fill="omAccent" opacity="0.9"/>
          <circle cx="4" cy="16.5" r="1.6" :fill="omAccent" opacity="0.6"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2l2.8 2.8M19 5l-2.8 2.8M7.8 16.2 5 19" :stroke="omGold" stroke-width="0.6" opacity="0.6"/>
        </svg>
      </div>
      <div class="skin-card-info">
        <div class="skin-name-row">
          <span class="skin-name">翁法罗斯 · 黄金星海</span>
          <span class="skin-badge">当前</span>
        </div>
        <p class="skin-desc">星穹铁道·翁法罗斯——紫夜鎏金基底、光尘粒子、罗马柱。</p>
      </div>
      <span class="skin-check" aria-hidden="true">✓</span>
    </div>

    <!-- 装饰层开关 -->
    <div class="skin-layers">
      <div class="skin-layers-title">沉浸装饰层</div>
      <div class="skin-layers-grid">
        <div v-for="lg in layers" :key="lg.key" class="skin-layer-row">
          <span class="skin-layer-name">{{ lg.name }}</span>
          <button
            type="button"
            class="skin-toggle"
            role="switch"
            :aria-checked="!!skinLayers[lg.key]"
            :aria-label="`${lg.name}：${skinLayers[lg.key] ? '开启' : '关闭'}`"
            :class="{ on: !!skinLayers[lg.key] }"
            @click="toggleLayer(lg.key)"
          >
            <span class="skin-toggle-knob"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useThemeEngine } from './engine'

const { skinLayers, toggleLayer } = useThemeEngine()

const omGold   = getComputedVar('--om-gold', '#E8C66A')
const omAccent = getComputedVar('--om-accent', '#C49A45')

const layers = [
  { key: 'background', name: '紫夜基底 + 罗马柱' },
  { key: 'particles',  name: '金色光尘粒子'      },
  { key: 'haze',       name: '鎏金雾光带'        },
]

function getComputedVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
</script>

<style scoped>
.skin-selector { display: flex; flex-direction: column; gap: 12px; }
.skin-banner { display: flex; align-items: center; gap: 14px; padding: 16px 18px; background: linear-gradient(160deg, rgba(10,4,24,0.82) 0%, rgba(26,15,53,0.7) 100%); border: 1px solid var(--om-gold); border-radius: 12px; box-shadow: inset 0 0 24px rgba(232,198,106,0.12), 0 0 0 1px rgba(232,198,106,0.2); }
.skin-card-icon { width: 46px; height: 46px; border-radius: 12px; background: radial-gradient(circle at 30% 20%, rgba(232,198,106,0.22), transparent 60%), rgba(255,255,255,0.04); border: 1px solid rgba(232,198,106,0.45); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.skin-card-info { flex: 1; }
.skin-name-row { display: flex; align-items: center; gap: 8px; }
.skin-name { font-size: 14px; font-weight: 700; color: #F5E0B0; letter-spacing: 1px; }
.skin-badge { font-size: 10px; color: #1A0F0A; background: linear-gradient(135deg, #F8E3A6, #E8C66A); padding: 2px 8px; border-radius: 20px; font-weight: 700; border: 1px solid rgba(232,198,106,0.6); }
.skin-desc { margin: 4px 0 0; font-size: 11px; color: #B9A9E0; line-height: 1.5; }
.skin-check { width: 24px; height: 24px; border-radius: 50%; background: #0A0418; border: 1px solid var(--om-gold); color: var(--om-gold); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }

.skin-layers { margin-top: 2px; padding: 14px 18px 16px; background: rgba(10,4,24,0.45); border: 1px solid rgba(232,198,106,0.22); border-radius: 12px; }
.skin-layers-title { font-size: 11px; font-weight: 700; color: #C896FF; letter-spacing: 2px; margin-bottom: 10px; }
.skin-layers-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; }
.skin-layer-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
.skin-layer-name { font-size: 12px; color: #E6DEFF; }
.skin-toggle { width: 40px; height: 22px; border-radius: 20px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); cursor: pointer; position: relative; transition: background .2s; padding: 0; }
.skin-toggle.on { background: linear-gradient(135deg, #E8C66A, #C49A45); border-color: #E8C66A; }
.skin-toggle-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .2s; }
.skin-toggle.on .skin-toggle-knob { left: 20px; }

@media (max-width: 640px) { .skin-layers-grid { grid-template-columns: 1fr; } }
</style>