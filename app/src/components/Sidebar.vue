<template>
  <aside class="sidebar">
    <!-- 翁法罗斯导航图标共享渐变（4 套） -->
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <linearGradient id="navFeatherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FCE3A0"/><stop offset="100%" stop-color="#C49A45"/>
        </linearGradient>
        <linearGradient id="navFlameGrad" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stop-color="#E8B449"/><stop offset="50%" stop-color="#F5D472"/><stop offset="100%" stop-color="#FFF5D6"/>
        </linearGradient>
        <linearGradient id="navMobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#C896FF"/><stop offset="50%" stop-color="#5EEAD4"/><stop offset="100%" stop-color="#7DD3E8"/>
        </linearGradient>
        <linearGradient id="navMaskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FCE3A0"/><stop offset="100%" stop-color="#8B7FC4"/>
        </linearGradient>
        <linearGradient id="navStoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5E3F8E"/><stop offset="100%" stop-color="#2A1A4A"/>
        </linearGradient>
        <radialGradient id="candleFlameGrad" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stop-color="#FFE399"/><stop offset="50%" stop-color="#F5D472"/><stop offset="100%" stop-color="#E8A832"/>
        </radialGradient>
        <linearGradient id="candleWaxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#F5E0B0"/><stop offset="100%" stop-color="#C49A45"/>
        </linearGradient>
      </defs>
    </svg>
    <!-- Logo -->
    <div class="logo-section">
      <div class="logo-icon">
      <!-- 翁法罗斯动态 SVG logo（内联：让 SVG 内部 <style> 动画生效） -->
      <svg class="logo-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-label="翁法罗斯 logo">
<defs>
  <linearGradient id="logoMobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#FF9AC9"/><stop offset="35%" stop-color="#C896FF"/>
    <stop offset="70%" stop-color="#5EEAD4"/><stop offset="100%" stop-color="#7DD3E8"/>
  </linearGradient>
  <linearGradient id="logoMobShadow" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#7B5BB8" stop-opacity=".55"/><stop offset="100%" stop-color="#2A6E8E" stop-opacity=".45"/>
  </linearGradient>
  <linearGradient id="logoGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#FCE3A0"/><stop offset="50%" stop-color="#F5D472"/><stop offset="100%" stop-color="#C49A45"/>
  </linearGradient>
  <radialGradient id="logoHaloAura" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#7DD3E8" stop-opacity=".55"/><stop offset="50%" stop-color="#4FA8C5" stop-opacity=".3"/><stop offset="100%" stop-color="#1A2B6B" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="logoCoreGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset="35%" stop-color="#A8E8FF" stop-opacity=".7"/><stop offset="100%" stop-color="#4FA8C5" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="logoGoldGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#FCE3A0" stop-opacity=".95"/><stop offset="60%" stop-color="#E0B453" stop-opacity=".5"/><stop offset="100%" stop-color="#C49A45" stop-opacity="0"/>
  </radialGradient>
  <line id="logoTkMain" x1="200" y1="40" x2="200" y2="56" stroke="#FCE3A0" stroke-width="2"/>
  <line id="logoTkMinor" x1="200" y1="40" x2="200" y2="48" stroke="#E0B453" stroke-width="1.2"/>
  <polygon id="logoAncV" points="0,-12 5,0 0,12 -5,0"/>
  <polygon id="logoAncH" points="-12,0 0,-5 12,0 0,5"/>
  <polygon id="logoTooth" points="0,-2 4,0 0,2 -4,0"/>
</defs>
<!-- A. 底层深色圆盘 -->
<circle cx="200" cy="200" r="180" fill="#050715"/>
<!-- B. 4 锚点 -->
<g class="halo-gold"><circle cx="200" cy="22"  r="14" fill="url(#logoGoldGlow)"/></g>
<g class="halo-gold" style="animation-delay:.4s"><circle cx="378" cy="200" r="14" fill="url(#logoGoldGlow)"/></g>
<g class="halo-gold" style="animation-delay:.8s"><circle cx="200" cy="378" r="14" fill="url(#logoGoldGlow)"/></g>
<g class="halo-gold" style="animation-delay:1.2s"><circle cx="22"  cy="200" r="14" fill="url(#logoGoldGlow)"/></g>
<g transform="translate(200 22)"><use href="#logoAncV" fill="url(#logoGoldGlow)"/><use href="#logoAncV" fill="none" stroke="#FCE3A0" stroke-width="1.5"/><circle r="3" fill="#FFF5D6"/></g>
<g transform="translate(378 200)"><use href="#logoAncH" fill="url(#logoGoldGlow)"/><use href="#logoAncH" fill="none" stroke="#FCE3A0" stroke-width="1.5"/><circle r="3" fill="#FFF5D6"/></g>
<g transform="translate(200 378)"><use href="#logoAncV" fill="url(#logoGoldGlow)"/><use href="#logoAncV" fill="none" stroke="#FCE3A0" stroke-width="1.5"/><circle r="3" fill="#FFF5D6"/></g>
<g transform="translate(22 200)"><use href="#logoAncH" fill="url(#logoGoldGlow)"/><use href="#logoAncH" fill="none" stroke="#FCE3A0" stroke-width="1.5"/><circle r="3" fill="#FFF5D6"/></g>
<!-- C. 齿轮刻度环 28s 逆旋 -->
<g class="gear-spin" opacity=".95">
  <use href="#logoTkMain"/><use href="#logoTkMain" transform="rotate(30 200 200)"/><use href="#logoTkMain" transform="rotate(60 200 200)"/><use href="#logoTkMain" transform="rotate(90 200 200)"/><use href="#logoTkMain" transform="rotate(120 200 200)"/><use href="#logoTkMain" transform="rotate(150 200 200)"/><use href="#logoTkMain" transform="rotate(180 200 200)"/><use href="#logoTkMain" transform="rotate(210 200 200)"/><use href="#logoTkMain" transform="rotate(240 200 200)"/><use href="#logoTkMain" transform="rotate(270 200 200)"/><use href="#logoTkMain" transform="rotate(300 200 200)"/><use href="#logoTkMain" transform="rotate(330 200 200)"/>
  <use href="#logoTkMinor" transform="rotate(6 200 200)"/><use href="#logoTkMinor" transform="rotate(12 200 200)"/><use href="#logoTkMinor" transform="rotate(18 200 200)"/><use href="#logoTkMinor" transform="rotate(24 200 200)"/><use href="#logoTkMinor" transform="rotate(36 200 200)"/><use href="#logoTkMinor" transform="rotate(42 200 200)"/><use href="#logoTkMinor" transform="rotate(48 200 200)"/><use href="#logoTkMinor" transform="rotate(54 200 200)"/><use href="#logoTkMinor" transform="rotate(66 200 200)"/><use href="#logoTkMinor" transform="rotate(72 200 200)"/><use href="#logoTkMinor" transform="rotate(78 200 200)"/><use href="#logoTkMinor" transform="rotate(84 200 200)"/><use href="#logoTkMinor" transform="rotate(96 200 200)"/><use href="#logoTkMinor" transform="rotate(102 200 200)"/><use href="#logoTkMinor" transform="rotate(108 200 200)"/><use href="#logoTkMinor" transform="rotate(114 200 200)"/><use href="#logoTkMinor" transform="rotate(126 200 200)"/><use href="#logoTkMinor" transform="rotate(132 200 200)"/><use href="#logoTkMinor" transform="rotate(138 200 200)"/><use href="#logoTkMinor" transform="rotate(144 200 200)"/><use href="#logoTkMinor" transform="rotate(156 200 200)"/><use href="#logoTkMinor" transform="rotate(162 200 200)"/><use href="#logoTkMinor" transform="rotate(168 200 200)"/><use href="#logoTkMinor" transform="rotate(174 200 200)"/><use href="#logoTkMinor" transform="rotate(186 200 200)"/><use href="#logoTkMinor" transform="rotate(192 200 200)"/><use href="#logoTkMinor" transform="rotate(198 200 200)"/><use href="#logoTkMinor" transform="rotate(204 200 200)"/><use href="#logoTkMinor" transform="rotate(216 200 200)"/><use href="#logoTkMinor" transform="rotate(222 200 200)"/><use href="#logoTkMinor" transform="rotate(228 200 200)"/><use href="#logoTkMinor" transform="rotate(234 200 200)"/><use href="#logoTkMinor" transform="rotate(246 200 200)"/><use href="#logoTkMinor" transform="rotate(252 200 200)"/><use href="#logoTkMinor" transform="rotate(258 200 200)"/><use href="#logoTkMinor" transform="rotate(264 200 200)"/><use href="#logoTkMinor" transform="rotate(276 200 200)"/><use href="#logoTkMinor" transform="rotate(282 200 200)"/><use href="#logoTkMinor" transform="rotate(288 200 200)"/><use href="#logoTkMinor" transform="rotate(294 200 200)"/><use href="#logoTkMinor" transform="rotate(306 200 200)"/><use href="#logoTkMinor" transform="rotate(312 200 200)"/><use href="#logoTkMinor" transform="rotate(318 200 200)"/><use href="#logoTkMinor" transform="rotate(324 200 200)"/><use href="#logoTkMinor" transform="rotate(336 200 200)"/><use href="#logoTkMinor" transform="rotate(342 200 200)"/><use href="#logoTkMinor" transform="rotate(348 200 200)"/><use href="#logoTkMinor" transform="rotate(354 200 200)"/>
  <circle cx="200" cy="200" r="58" fill="none" stroke="url(#logoGoldGrad)" stroke-width="1.5" opacity=".7"/>
  <circle cx="200" cy="200" r="158" fill="none" stroke="#F5D472" stroke-width="1" opacity=".4"/>
  <circle cx="200" cy="200" r="166" fill="none" stroke="#F5D472" stroke-width="2" opacity=".65"/>
  <g fill="none" stroke="#FCE3A0" stroke-width="2" opacity=".75">
    <use href="#logoTooth" transform="translate(200 40)"/><use href="#logoTooth" transform="translate(200 40) rotate(30 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(60 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(90 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(120 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(150 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(180 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(210 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(240 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(270 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(300 200 200)"/><use href="#logoTooth" transform="translate(200 40) rotate(330 200 200)"/>
  </g>
</g>
<!-- D. 蓝青光晕呼吸 -->
<circle class="halo-breath" cx="200" cy="200" r="115" fill="url(#logoHaloAura)"/>
<!-- E. 12 粒子飘散 -->
<g>
  <circle class="p" cx="200" cy="14" r="1.6" fill="#FCE3A0" style="--dx:0;--dy:-25px"/>
  <circle class="p p2" cx="385" cy="200" r="1.4" fill="#7DD3E8" style="--dx:25px;--dy:0"/>
  <circle class="p p3" cx="200" cy="386" r="1.6" fill="#FCE3A0" style="--dx:0;--dy:25px"/>
  <circle class="p p4" cx="15" cy="200" r="1.4" fill="#7DD3E8" style="--dx:-25px;--dy:0"/>
  <circle class="p p5" cx="312" cy="88" r="1.2" fill="#FF9AC9" style="--dx:15px;--dy:-15px"/>
  <circle class="p p6" cx="312" cy="312" r="1.2" fill="#C896FF" style="--dx:15px;--dy:15px"/>
  <circle class="p p7" cx="88" cy="312" r="1.2" fill="#5EEAD4" style="--dx:-15px;--dy:15px"/>
  <circle class="p p8" cx="88" cy="88" r="1.2" fill="#FCE3A0" style="--dx:-15px;--dy:-15px"/>
  <circle class="p p4" cx="356" cy="156" r="1" fill="#FFFFFF" style="--dx:18px;--dy:-10px"/>
  <circle class="p p2" cx="44" cy="156" r="1" fill="#FFFFFF" style="--dx:-18px;--dy:-10px"/>
  <circle class="p p6" cx="356" cy="244" r="1" fill="#FFFFFF" style="--dx:18px;--dy:10px"/>
  <circle class="p p8" cx="44" cy="244" r="1" fill="#FFFFFF" style="--dx:-18px;--dy:10px"/>
</g>
<!-- F. 莫比乌斯环（光带流动 + 辉光） -->
<g class="mobius-wrap">
  <path class="mobius-shadow" d="M 90,200 C 90,130 145,130 200,200 C 255,270 310,270 310,200 C 310,130 255,130 200,200 C 145,270 90,270 90,200 Z" fill="none" stroke="url(#logoMobShadow)" stroke-width="14" stroke-linecap="round"/>
  <path class="mobius-light" d="M 90,200 C 90,130 145,130 200,200 C 255,270 310,270 310,200 C 310,130 255,130 200,200 C 145,270 90,270 90,200 Z" fill="none" stroke="url(#logoMobGrad)" stroke-width="12" stroke-linecap="round" opacity=".95"/>
</g>
<!-- 中心内核辉光 -->
<circle class="core-aura" cx="200" cy="200" r="42" fill="url(#logoCoreGlow)"/>
<!-- G. 中心星芒：闪烁 + 抖动 -->
<g class="star-burst">
  <g fill="url(#logoMobGrad)" opacity=".85">
    <polygon class="spike-sub" points="200,160 195,200 200,240 205,200" transform="rotate(45 200 200)"/>
    <polygon class="spike-sub ss2" points="200,160 195,200 200,240 205,200" transform="rotate(135 200 200)"/>
    <polygon class="spike-sub ss3" points="200,160 195,200 200,240 205,200" transform="rotate(225 200 200)"/>
    <polygon class="spike-sub ss4" points="200,160 195,200 200,240 205,200" transform="rotate(315 200 200)"/>
  </g>
  <g fill="#FFFFFF">
    <polygon class="spike" points="200,138 193,200 200,262 207,200"/>
    <polygon class="spike s2" points="138,200 200,193 262,200 200,207"/>
    <polygon class="spike s3" points="200,158 194,200 200,242 206,200" transform="rotate(45 200 200)"/>
    <polygon class="spike s4" points="200,158 194,200 200,242 206,200" transform="rotate(135 200 200)"/>
  </g>
  <g class="star-core">
    <circle cx="200" cy="200" r="11" fill="#FFFFFF"/>
    <circle cx="200" cy="200" r="6" fill="#FFF5D6"/>
    <circle cx="200" cy="200" r="2.5" fill="#FFFFFF"/>
  </g>
</g>
</svg>
      </div>
      <span class="logo-name">翁法罗斯</span>
    </div>

    <!-- 导航 -->
    <nav class="nav-section" aria-label="主导航">
      <button
        v-for="item in navItems"
        :key="item.path"
        type="button"
        class="nav-item"
        :class="{ active: activeRoute === item.path }"
        :aria-current="activeRoute === item.path ? 'page' : false"
        :aria-label="item.label"
        :data-icon="item.icon"
        @click="$emit('navigate', item.path)"
      >
        <svg class="nav-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <!-- 如我所书：3 根羽毛斜插 + 写过字的卷轴底 -->
          <template v-if="item.icon === 'dashboard'">
            <!-- 卷轴底 -->
            <rect x="2" y="13" width="14" height="3" rx="1" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" fill-opacity="0.55"/>
            <ellipse cx="2" cy="14.5" rx="0.8" ry="1.5" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" fill-opacity="0.85"/>
            <ellipse cx="16" cy="14.5" rx="0.8" ry="1.5" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" fill-opacity="0.85"/>
            <!-- 文字横线 -->
            <path d="M4 14.2H11" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.4" opacity="0.6"/>
            <path d="M4 15H9" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.4" opacity="0.5"/>
            <!-- 3 根羽毛（从左下到右上斜插） -->
            <path d="M2.5 12L8 5L9 6L3.5 13Z" :fill="activeRoute === item.path ? 'url(#navFeatherGrad)' : 'var(--color-text-muted)'"/>
            <path d="M5 12L10.5 5L11.5 6L6 13Z" :fill="activeRoute === item.path ? 'url(#navFeatherGrad)' : 'var(--color-text-muted)'" fill-opacity="0.92"/>
            <path d="M7.5 12L13 5L14 6L8.5 13Z" :fill="activeRoute === item.path ? 'url(#navFeatherGrad)' : 'var(--color-text-muted)'" fill-opacity="0.85"/>
            <!-- 羽轴细线 -->
            <path d="M2.5 12L9 5.5" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.3" opacity="0.6"/>
            <path d="M5 12L11 5.5" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.3" opacity="0.6"/>
            <path d="M7.5 12L13 5.5" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.3" opacity="0.6"/>
          </template>

          <!-- 收集火种：3 颗立体火种（左小/中中/右大），底部带托盘 + 底面纹路 -->
          <template v-else-if="item.icon === 'notes'">
            <!-- 右大火种 -->
            <path d="M12 2C13.2 3.5 14 5 14 7C14 9 13 10 12 10C11 10 10 9 10 7C10 5 10.8 3.5 12 2Z" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <path d="M11.4 3.5C12 4.5 12.5 5.5 12.5 6.5C12.5 7 12.2 7.5 12 7.5C11.8 7.5 11.5 7 11.5 6.5C11.5 5.5 11.7 4.5 11.4 3.5Z" fill="#FFFFFF" opacity="0.6"/>
            <!-- 中中火种 -->
            <path d="M6 4C7 5 7.7 6 7.7 7.5C7.7 9 6.9 9.8 6 9.8C5.1 9.8 4.3 9 4.3 7.5C4.3 6 5 5 6 4Z" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <path d="M5.5 5.2C5.9 5.8 6.2 6.5 6.2 7C6.2 7.4 6 7.7 5.85 7.7C5.7 7.7 5.5 7.4 5.5 7C5.5 6.5 5.7 5.8 5.5 5.2Z" fill="#FFFFFF" opacity="0.6"/>
            <!-- 左小火种 -->
            <path d="M9 7.5C9.6 8.2 10 9 10 9.8C10 10.5 9.55 11 9 11C8.45 11 8 10.5 8 9.8C8 9 8.4 8.2 9 7.5Z" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <path d="M8.7 8.3C8.9 8.7 9.1 9.1 9.1 9.4C9.1 9.6 9 9.7 8.9 9.7C8.8 9.7 8.7 9.6 8.7 9.4C8.7 9.1 8.8 8.7 8.7 8.3Z" fill="#FFFFFF" opacity="0.6"/>
            <!-- 光晕圈 -->
            <circle cx="6" cy="6.5" r="3" fill="none" :stroke="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" stroke-width="0.3" opacity="0.4"/>
            <!-- 托盘 -->
            <path d="M3 14H15L14 15.5H4L3 14Z" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" fill-opacity="0.85"/>
            <ellipse cx="9" cy="13.8" rx="6" ry="0.6" :fill="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" fill-opacity="0.3"/>
            <!-- 托盘底面罗马式刻线 -->
            <path d="M5 16H13M6 16.5H12M7 17H11" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.4" opacity="0.6"/>
          </template>

          <!-- 万帷网：12 节点占星星盘 + 8 角连线 + 中心点 -->
          <template v-else-if="item.icon === 'graph'">
            <!-- 外圈 12 节点（钟面位置） -->
            <circle cx="9" cy="1.5" r="0.9" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <circle cx="9" cy="16.5" r="0.9" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <circle cx="1.5" cy="9" r="0.9" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <circle cx="16.5" cy="9" r="0.9" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <circle cx="3.7" cy="3.7" r="0.7" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.9"/>
            <circle cx="14.3" cy="3.7" r="0.7" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.9"/>
            <circle cx="3.7" cy="14.3" r="0.7" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.9"/>
            <circle cx="14.3" cy="14.3" r="0.7" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.9"/>
            <circle cx="6.3" cy="2.2" r="0.5" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.7"/>
            <circle cx="11.7" cy="2.2" r="0.5" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.7"/>
            <circle cx="6.3" cy="15.8" r="0.5" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.7"/>
            <circle cx="11.7" cy="15.8" r="0.5" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" opacity="0.7"/>
            <!-- 占星双环 -->
            <circle cx="9" cy="9" r="7.5" fill="none" :stroke="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" stroke-width="0.6" opacity="0.7"/>
            <circle cx="9" cy="9" r="5.5" fill="none" :stroke="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" stroke-width="0.4" opacity="0.5"/>
            <!-- 8 角连线（菱形 + 旋转方块） -->
            <path d="M9 1.5L16.5 9L9 16.5L1.5 9Z" fill="none" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.6" opacity="0.85"/>
            <path d="M3.7 3.7L14.3 14.3M14.3 3.7L3.7 14.3" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.4" opacity="0.5"/>
            <!-- 中心点 -->
            <circle cx="9" cy="9" r="1.3" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <circle cx="9" cy="9" r="0.5" fill="#FFF5D6"/>
          </template>

          <!-- 再次永劫轮回：莫比乌斯环 + 中央沙漏 -->
          <template v-else-if="item.icon === 'quiz'">
            <path d="M2 9C2 5 5 2 9 2C13 2 16 5 16 9C16 13 13 16 9 16C5 16 2 13 2 9Z" fill="none" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="1" opacity="0.7"/>
            <path d="M2.5 6.5C4.5 9 13.5 9 15.5 6.5M2.5 11.5C4.5 9 13.5 9 15.5 11.5" fill="none" :stroke="activeRoute === item.path ? 'url(#navMobGrad)' : 'var(--color-text-muted)'" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M7 7.5L11 7.5L9 10L11 10.5L7 10.5L9 7.5Z" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <circle cx="7" cy="7.5" r="0.5" fill="#FFF5D6"/>
            <circle cx="11" cy="10.5" r="0.5" fill="#FFF5D6"/>
          </template>

          <!-- 欧洛尼斯祷言：双面沙漏 + 沙流光点（岁月泰坦·欧洛尼斯的双面镜） -->
          <!-- 黑潮侵蚀：碎裂的黄金裔牌 + 底部黑潮涌动 -->
          <template v-else-if="item.icon === 'heirs'">
            <!-- 卡牌主体（带裂纹） -->
            <rect x="4.5" y="1.8" width="9" height="11.4" rx="1.2"
              :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" fill-opacity="0.35"/>
            <rect x="4.5" y="1.8" width="9" height="11.4" rx="1.2" fill="none"
              :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.7"/>
            <!-- 牌面中央的火种（已黯淡） -->
            <path d="M9 4C9.9 5.1 10.4 6.1 10.4 7.1C10.4 8 9.9 8.6 9 8.6C8.1 8.6 7.6 8 7.6 7.1C7.6 6.1 8.1 5.1 9 4Z"
              :fill="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" fill-opacity="0.5"/>
            <!-- 牌面刻度（象征黄金裔信息） -->
            <path d="M6 9.8H12M6 11H10" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.35" opacity="0.55"/>
            <!-- 贯穿卡牌的裂纹（黑潮侵蚀） -->
            <path d="M6.2 2.2L8.4 6.2L6.8 8.4L9.6 12.9"
              :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.6" fill="none" stroke-linejoin="round"/>
            <path d="M8.4 6.2L11.4 5.2M6.8 8.4L4.9 9.6"
              :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.4" fill="none" opacity="0.75"/>
            <!-- 底部黑潮涌浪（两道） -->
            <path d="M2 14.2q2 -1.4 4 0t4 0t4 0" fill="none"
              :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.7" opacity="0.85"/>
            <path d="M2 16q2 -1.4 4 0t4 0t4 0" fill="none"
              :stroke="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" stroke-width="0.7" opacity="0.6"/>
          </template>

          <!-- 欧洛尼斯祷言：沙漏（时间/记忆） -->
          <template v-else-if="item.icon === 'review'">
            <defs>
              <clipPath id="hourglassTop"><path d="M6.5 3.2H11.5L9 8.5L11.5 13.8H6.5L9 8.5Z"/></clipPath>
              <clipPath id="hourglassBot"><path d="M6.5 3.2H11.5L9 8.5L11.5 13.8H6.5L9 8.5Z"/></clipPath>
            </defs>
            <!-- 顶帽 + 底座 -->
            <rect x="5.5" y="1.8" width="7" height="1.6" rx="0.4" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <rect x="5.5" y="14.6" width="7" height="1.6" rx="0.4" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <!-- 双面沙漏玻璃（双菱形对接=双面） -->
            <path d="M6.5 3.4H11.5L9 8.5L11.5 13.6H6.5L9 8.5Z" fill="none" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.8"/>
            <!-- 上半：堆积的沙（暗侧） -->
            <path d="M6.8 3.6H11.2L9 8.2Z" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" fill-opacity="0.85"/>
            <!-- 沙中光点 -->
            <circle cx="7.5" cy="4.5" r="0.25" fill="#FFF5D6"/>
            <circle cx="9.5" cy="5" r="0.25" fill="#FFF5D6"/>
            <circle cx="8.7" cy="6" r="0.2" fill="#FFF5D6"/>
            <!-- 下半：累积的沙（亮侧） -->
            <path d="M6.8 13.4H11.2L9 8.8Z" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" fill-opacity="0.95"/>
            <circle cx="8.5" cy="11" r="0.2" fill="#FFF5D6"/>
            <circle cx="9.5" cy="12" r="0.25" fill="#FFF5D6"/>
            <circle cx="7.8" cy="12.5" r="0.2" fill="#FFF5D6"/>
            <!-- 中央瓶颈沙流 -->
            <path d="M8.7 8.3L9 8.5L9.3 8.3M8.8 8.8L9 9L9.2 8.8" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.4"/>
            <!-- 刻度（左右） -->
            <path d="M5 5H6M5 8H6M5 11H6M12 5H13M12 8H13M12 11H13" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.4" opacity="0.6"/>
            <!-- 回纹底座 -->
            <path d="M2 17.5H4L3.5 16.5L4.5 16.5L4 17.5H5L4.5 16.5L5.5 16.5L5 17.5H6L5.5 16.5L6.5 16.5L6 17.5H7.5V18H10.5V17.5H12L11.5 16.5L12.5 16.5L12 17.5H13L12.5 16.5L13.5 16.5L13 17.5H14L13.5 16.5L14.5 16.5L14 17.5H16" fill="none" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.6"/>
          </template>

          <!-- 来古士：黄金裔先知半面面具 + 第三只眼 -->
          <template v-else-if="item.icon === 'assistant'">
            <path d="M4 4C4 2.9 4.9 2 6 2H10L14 6V14C14 15.1 13.1 16 12 16H6C4.9 16 4 15.1 4 14V4Z" :fill="activeRoute === item.path ? 'url(#navMaskGrad)' : 'var(--color-text-muted)'" fill-opacity="0.7"/>
            <path d="M9.5 2.5V5.5H13.5L9.5 2.5Z" :fill="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" fill-opacity="0.8"/>
            <ellipse cx="7" cy="8" rx="1" ry="0.6" :fill="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'"/>
            <ellipse cx="11" cy="8" rx="1" ry="0.6" :fill="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'"/>
            <path d="M6.5 10.5C7 11.5 11 11.5 11.5 10.5" fill="none" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.6"/>
            <circle cx="9" cy="6.5" r="0.8" :fill="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'"/>
            <circle cx="9" cy="6.5" r="0.4" fill="#FFF5D6"/>
            <path d="M4 13L14 13" :stroke="activeRoute === item.path ? 'var(--color-accent)' : 'var(--color-text-muted)'" stroke-width="0.6" opacity="0.5"/>
          </template>

          <!-- 再创世记录：破碎石板 + 金色光裂纹 -->
          <template v-else-if="item.icon === 'logs'">
            <path d="M3 3L15 3L14 8L15 15L3 15L4 8L3 3Z" :fill="activeRoute === item.path ? 'url(#navStoneGrad)' : 'var(--color-text-muted)'" fill-opacity="0.8"/>
            <path d="M5 6L7 7L6 9L8 10L7 12M9 5L10 7L12 8L11 10L13 12" fill="none" :stroke="activeRoute === item.path ? 'url(#navFlameGrad)' : 'var(--color-text-muted)'" stroke-width="0.6" stroke-linecap="round"/>
            <path d="M4 8L14 8" :stroke="activeRoute === item.path ? '#FFF5D6' : 'var(--color-text-muted)'" stroke-width="0.4" opacity="0.4"/>
            <circle cx="12" cy="5" r="0.6" fill="#FFF5D6" opacity="0.9"/>
            <circle cx="5" cy="13" r="0.5" fill="#FFF5D6" opacity="0.8"/>
          </template>
        </svg>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>

    <!-- 我的课程 -->
    <div class="section-label" role="heading" aria-level="2">
      <svg class="section-ornament" width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
        <path d="M0 5.5H4L5.3 1.5L6.7 9.5L8 1.5L9.3 9.5L10.7 1.5L12 9.5L13.3 1.5L14.7 9.5L16 5.5" :stroke="'var(--color-accent)'" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <!-- 燃烧蜡烛：烛柱 + 烛泪 + 火焰 -->
      <svg class="section-candle" width="12" height="18" viewBox="0 0 9 14" fill="none" aria-hidden="true">
        <!-- 火焰（外焰+内焰） -->
        <path d="M4.5 0.5C5 1.5 6 2.8 5.8 4C5.6 5 5 5.3 4.5 5.3C4 5.3 3.4 5 3.2 4C3 2.8 4 1.5 4.5 0.5Z" fill="url(#candleFlameGrad)"/>
        <path d="M4.5 2C4.7 2.5 5 3 4.9 3.7C4.85 4 4.7 4.1 4.5 4.1C4.3 4.1 4.15 4 4.1 3.7C4 3 4.3 2.5 4.5 2Z" fill="#FFFFFF" opacity="0.7"/>
        <!-- 烛芯 -->
        <line x1="4.5" y1="4.8" x2="4.5" y2="6" stroke="#3A1F0A" stroke-width="0.4"/>
        <!-- 烛柱 -->
        <rect x="3" y="5.8" width="3" height="6.5" rx="0.4" :fill="activeRoute.startsWith('/notes') || activeRoute.startsWith('/quiz') ? 'url(#candleWaxGrad)' : 'var(--color-text-muted)'" fill-opacity="0.7"/>
        <!-- 烛泪（左） -->
        <path d="M3 6.5C2.5 7.5 2.3 8.5 2.8 9.2C3.2 9.6 3 9.4 3 9V6.5Z" :fill="activeRoute.startsWith('/notes') || activeRoute.startsWith('/quiz') ? 'url(#candleWaxGrad)' : 'var(--color-text-muted)'" fill-opacity="0.6"/>
        <!-- 烛台 -->
        <rect x="2.5" y="12.3" width="4" height="0.6" rx="0.2" :fill="'var(--color-accent)'" fill-opacity="0.85"/>
        <ellipse cx="4.5" cy="13.2" rx="2.5" ry="0.5" :fill="'var(--color-accent)'" fill-opacity="0.55"/>
      </svg>
      <span>烛火课业</span>
      <svg class="section-ornament section-ornament-r" width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
        <path d="M0 5.5H4L5.3 1.5L6.7 9.5L8 1.5L9.3 9.5L10.7 1.5L12 9.5L13.3 1.5L14.7 9.5L16 5.5" :stroke="'var(--color-accent)'" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="course-list" role="list" aria-label="课程列表">
      <div
        v-for="course in courses"
        :key="course.id"
        role="button"
        tabindex="0"
        class="course-item"
        :class="{ active: course.id === activeCourseId }"
        :aria-current="course.id === activeCourseId ? 'true' : false"
        :aria-label="`选择课程：${course.name}，共 ${course.noteCount} 篇笔记`"
        @click="selectCourse(course.id)"
        @keydown.enter.prevent="selectCourse(course.id)"
        @keydown.space.prevent="selectCourse(course.id)"
      >
        <span class="course-dot" :style="{ background: course.color }" aria-hidden="true"></span>
        <span class="course-name">{{ course.name }}</span>
        <span class="course-count" aria-label="笔记数量">{{ course.noteCount }}</span>
        <button
          type="button"
          class="course-delete-btn"
          aria-label="删除课程"
          title="删除课程"
          @click.stop="confirmDeleteCourse(course)"
          @keydown.enter.stop.prevent="confirmDeleteCourse(course)"
        >×</button>
      </div>
      <div v-if="courses.length === 0" class="course-empty" role="status">
        暂无课程，去笔记页创建
      </div>
    </div>

    <!-- 弹性间隔 -->
    <div class="spacer"></div>

    <!-- 设置按钮 + 主题切换 -->
    <div class="bottom-actions">
      <button
        type="button"
        class="settings-btn"
        aria-label="打开设置页面"
        @click="$emit('navigate', '/settings')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="scepterGem" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stop-color="#E5C4FF"/><stop offset="40%" stop-color="#9B6BD9"/><stop offset="100%" stop-color="#3D1A6A"/>
            </radialGradient>
            <linearGradient id="scepterShaft" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#8B5A2B"/><stop offset="50%" stop-color="#F5D472"/><stop offset="100%" stop-color="#8B5A2B"/>
            </linearGradient>
          </defs>
          <!-- 紫多面宝石顶（钻石形 6 边） -->
          <path d="M8 0.5L11.5 3.5L9.5 7.5L6.5 7.5L4.5 3.5Z" fill="url(#scepterGem)"/>
          <path d="M8 0.5L11.5 3.5L9.5 7.5L6.5 7.5L4.5 3.5Z" fill="none" stroke="#FFF5D6" stroke-width="0.4" opacity="0.7"/>
          <!-- 宝石切面分线 -->
          <path d="M8 0.5L8 7.5M4.5 3.5L11.5 3.5M6.5 7.5L9.5 7.5" stroke="#FFF5D6" stroke-width="0.3" opacity="0.5"/>
          <!-- 宝石高光 -->
          <path d="M5.5 3L7 1.5L6 3.5Z" fill="#FFF5D6" opacity="0.7"/>
          <!-- 顶冠（小金球） -->
          <circle cx="8" cy="7.7" r="0.5" fill="url(#scepterShaft)"/>
          <!-- 长杆 -->
          <rect x="7.4" y="7.7" width="1.2" height="6.2" fill="url(#scepterShaft)"/>
          <!-- 杆中段金环 -->
          <rect x="7.1" y="10" width="1.8" height="0.6" fill="url(#scepterShaft)"/>
          <!-- R 形底钩 -->
          <path d="M7.4 13.9C7.4 14.8 8 15.4 8.8 15.4C9.4 15.4 9.8 15 9.8 14.4C9.8 13.7 9.4 13.4 8.8 13.4" fill="none" stroke="url(#scepterShaft)" stroke-width="1" stroke-linecap="round"/>
        </svg>
        <span>权杖核心</span>
      </button>
      </div>

    <!-- 连续打卡 -->
    <div class="streak-card" v-if="streakDays > 0">
      <div class="streak-icon-wrap">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 0C8 0 4 4 4 8C4 10.21 5.79 12 8 12C10.21 12 12 10.21 12 8C12 4 8 0 8 0Z" fill="#FF6B9D"/>
        </svg>
      </div>
      <div class="streak-info">
        <span class="streak-label">连续打卡</span>
        <span class="streak-value">{{ streakDays }} 天</span>
      </div>
    </div>

    <!-- 用户区 -->
    <div class="user-section">
      <div class="user-avatar">
        <img
          v-if="userAvatarSrc"
          :src="userAvatarSrc"
          alt="用户头像"
          class="user-avatar-img"
        />
        <span v-else>{{ userName.charAt(0) }}</span>
      </div>
      <div class="user-info">
        <span class="user-name">{{ userName }}</span>
        <span class="user-meta">{{ courses.length }} 门课程 · {{ notes.length }} 篇笔记</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { courses, currentCourseId, stats, notes, deleteCourse, settings, resolveImageUrl, DEFAULT_USER_NAME } from '../store'
import { showConfirm } from '../composables/useDialog'

// 用户资料（设置页可配置）：昵称 + 头像
const userName = computed(() =>
  settings.value.userProfile?.name?.trim() || DEFAULT_USER_NAME
)
// 头像优先级：① 设置上传的头像 ② public/user-avatar.png（预留）③ 无 → 首字兜底
const customAvatarSrc = computed(() => {
  const ref = settings.value.userProfile?.avatar
  return ref ? resolveImageUrl(ref) : ''
})
const publicAvatarSrc = ref('')
const userAvatarSrc = computed(() => customAvatarSrc.value || publicAvatarSrc.value)
onMounted(() => {
  // 探测 public 预置头像是否存在（存在才显示）
  const img = new Image()
  img.onload = () => { publicAvatarSrc.value = './user-avatar.png' }
  img.onerror = () => { publicAvatarSrc.value = '' }
  img.src = './user-avatar.png'
})

defineProps<{
  activeRoute: string
}>()

const emit = defineEmits<{
  (e: 'navigate', path: string): void
  (e: 'selectCourse', courseId: string): void
}>()

const navItems = [
  { path: '/dashboard', label: '如我所书', icon: 'dashboard' },
  { path: '/notes', label: '收集火种', icon: 'notes' },
  { path: '/graph', label: '万帷网', icon: 'graph' },
  { path: '/quiz', label: '再次永劫轮回', icon: 'quiz' },
  { path: '/heirs', label: '黑潮侵蚀', icon: 'heirs' },
  { path: '/review', label: '欧洛尼斯祷言', icon: 'review' },
  { path: '/assistant', label: '来古士', icon: 'assistant' },
  { path: '/logs', label: '再创世记录', icon: 'logs' },
]

const activeCourseId = computed(() => currentCourseId.value)
const streakDays = computed(() => stats.value?.streakDays || 0)

const selectCourse = (id: string) => {
  // ⚠️ 修复：只发 selectCourse 一个事件（App 统一跳 /notes?course=id）。
  // 之前又 emit('navigate','/notes') 会二次跳转把 course query 覆盖掉 → 点学科没反应。
  currentCourseId.value = id
  emit('selectCourse', id)
}

const confirmDeleteCourse = async (course: { id: string; name: string; noteCount: number }) => {
  if (course.noteCount > 0) {
    const ok = await showConfirm({
      title: '删除课程',
      message: `课程「${course.name}」下有 ${course.noteCount} 篇笔记，删除课程后笔记将变为"未分类"。确定删除吗？`,
      danger: true,
    })
    if (!ok) return
  } else {
    const ok = await showConfirm({
      title: '删除课程',
      message: `确定删除课程「${course.name}」吗？`,
      danger: true,
    })
    if (!ok) return
  }
  await deleteCourse(course.id)
  if (currentCourseId.value === course.id) {
    currentCourseId.value = ''
  }
}
</script>

<style scoped>
.sidebar { width: 240px; height: 100%; display: flex; flex-direction: column; padding: 20px 16px; gap: 6px; background: linear-gradient(180deg, rgba(20,12,45,0.98) 0%, rgba(26,15,53,0.98) 100%); border-right: 1px solid rgba(232,198,106,0.30); box-shadow: inset -1px 0 0 rgba(232,198,106,0.06); overflow-y: auto; flex-shrink: 0; z-index: 10; }
.logo-section { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 4px 4px 14px; margin-bottom: 10px; border-bottom: 1px solid rgba(139, 127, 196, 0.15); }
.logo-icon { width: 100px; height: 100px; border-radius: 24px; background: transparent; display: flex; align-items: center; justify-content: center; box-shadow: none; }
.logo-svg { width: 100px; height: 100px; display: block; filter: drop-shadow(0 5px 16px rgba(232,198,106,.7)) drop-shadow(0 0 30px rgba(143,181,255,.6)); animation: logoFloat 4s ease-in-out infinite; }
.logo-name { font-size: 14px; font-weight: 700; letter-spacing: 0.08em; color: var(--color-text); background: linear-gradient(135deg, #E8C66A, #8B7FC4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; }
@keyframes logoFloat { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-3px) rotate(2deg); } }

/* ===== 翁法罗斯 SVG 内部动画（从 SVG <style> 移来，Vue scoped 不允许模板内有 <style>） ===== */
.logo-svg .gear-spin { transform-origin: 200px 200px; animation: logoRot 28s linear infinite }
@keyframes logoRot { to { transform: rotate(-360deg) } }
.logo-svg .halo-breath { transform-origin: 200px 200px; animation: logoHb 5s ease-in-out infinite }
@keyframes logoHb { 0%,100% { opacity:.55; transform:scale(.92) } 50% { opacity:1; transform:scale(1.05) } }
.logo-svg .halo-gold { transform-origin:200px 200px; animation: logoHb 4s ease-in-out infinite }
.logo-svg .p, .logo-svg .p2, .logo-svg .p3, .logo-svg .p4, .logo-svg .p5, .logo-svg .p6, .logo-svg .p7, .logo-svg .p8 { transform-box: fill-box; transform-origin: center; animation: logoDrift 6s ease-out infinite }
.logo-svg .p2 { animation-duration: 7s; animation-delay: 1s }
.logo-svg .p3 { animation-duration: 5s; animation-delay: 2.2s }
.logo-svg .p4 { animation-duration: 8s; animation-delay: .6s }
.logo-svg .p5 { animation-duration: 6.5s; animation-delay: 3.4s }
.logo-svg .p6 { animation-duration: 7.5s; animation-delay: 2s }
.logo-svg .p7 { animation-duration: 5.5s; animation-delay: 4s }
.logo-svg .p8 { animation-duration: 6s; animation-delay: 1.5s }
@keyframes logoDrift { 0% { opacity:0; transform:translate(0,0)scale(.6) } 15% { opacity:1 } 80% { opacity:.6 } 100% { opacity:0; transform:translate(var(--dx,30px),var(--dy,-30px))scale(.2) } }
.logo-svg .mobius-light, .logo-svg .mobius-shadow { stroke-dasharray: 22 6; animation: logoFlow 3s linear infinite }
.logo-svg .mobius-shadow { animation-direction: reverse; animation-duration: 3.6s }
@keyframes logoFlow { to { stroke-dashoffset: -28 } }
.logo-svg .spike { transform-box: fill-box; transform-origin: center; animation: logoSpike 1.4s ease-in-out infinite }
.logo-svg .spike.s2 { animation-delay: .12s }
.logo-svg .spike.s3 { animation-delay: .24s }
.logo-svg .spike.s4 { animation-delay: .36s }
@keyframes logoSpike { 0%,100% { opacity:.3; transform:scale(.55); filter:brightness(.8) } 18% { opacity:1; transform:scale(1.4); filter:brightness(1.7) } 40% { opacity:.85; transform:scale(1); filter:brightness(1.2) } 70% { opacity:.5; transform:scale(.75) } }
.logo-svg .spike-sub { transform-box: fill-box; transform-origin: center; animation: logoSub 1.4s ease-in-out infinite }
.logo-svg .spike-sub.ss2 { animation-delay: .15s }
.logo-svg .spike-sub.ss3 { animation-delay: .30s }
.logo-svg .spike-sub.ss4 { animation-delay: .45s }
@keyframes logoSub { 0%,100% { opacity:.25; transform:scale(.4) } 25% { opacity:.95; transform:scale(1.1); filter:brightness(1.5) } 55% { opacity:.7; transform:scale(.85) } }
.logo-svg .star-core { transform-origin: 200px 200px; animation: logoCore 1.4s ease-in-out infinite }
@keyframes logoCore { 0%,100% { transform:scale(1); opacity:1; filter:brightness(1.1) } 50% { transform:scale(1.35); opacity:1; filter:brightness(1.6) } }
.logo-svg .star-burst { transform-origin: 200px 200px; animation: logoBurst 1.4s ease-in-out infinite }
@keyframes logoBurst { 0%,100% { transform:rotate(0deg)scale(1) } 50% { transform:rotate(6deg)scale(1.05) } }
.logo-svg .core-aura { transform-origin: 200px 200px; animation: logoAb 3s ease-in-out infinite }
@keyframes logoAb { 0%,100% { opacity:.4; transform:scale(1) } 50% { opacity:.9; transform:scale(1.2) } }
.logo-svg .mobius-wrap { filter: drop-shadow(0 0 4px #C896FF) drop-shadow(0 0 10px rgba(143,181,255,.75)) drop-shadow(0 0 18px rgba(200,150,255,.35)) }

.nav-section { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.nav-item { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.25s ease; position: relative; }
.nav-item:hover {
  background: linear-gradient(90deg, rgba(232, 198, 106, 0.08) 0%, rgba(139, 95, 196, 0.05) 100%);
  transform: translateX(2px);
}
.nav-item.active {
  background: linear-gradient(135deg, rgba(139, 95, 196, 0.20) 0%, rgba(139, 127, 196, 0.14) 100%);
  border: 1px solid rgba(159, 138, 214, 0.75);
  outline: 1px solid rgba(159, 138, 214, 0.28);
  outline-offset: 2px;
  box-shadow:
    inset 0 0 12px rgba(139, 95, 196, 0.20),
    0 0 10px rgba(139, 95, 196, 0.28);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  top: -4px; bottom: -4px; left: 6px; right: 6px;
  border-top: 1px solid rgba(175, 150, 220, 0.5);
  border-bottom: 1px solid rgba(175, 150, 220, 0.5);
  pointer-events: none;
}
.nav-item.active::after {
  content: '';
  position: absolute;
  top: 50%; right: 12px;
  transform: translateY(-50%);
  width: 9px; height: 9px;
  background: radial-gradient(circle, #E0D4FF 0%, #B79FE8 55%, #7B5FB0 100%);
  clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
  box-shadow: 0 0 8px 2px rgba(159, 130, 214, 0.8), 0 0 14px rgba(159, 130, 214, 0.35);
  animation: om-gem-pulse 2.6s ease-in-out infinite;
}
.nav-item.active .nav-label {
  color: #F5E0B0;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(232,198,106,.55);
}
@keyframes om-gem-pulse {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(159,130,214,0.8), 0 0 14px rgba(159,130,214,0.35); transform: translateY(-50%) scale(1); }
  50%      { box-shadow: 0 0 12px 3px rgba(183,159,232,0.95), 0 0 20px rgba(159,130,214,0.5); transform: translateY(-50%) scale(1.06); }
}
.nav-icon { flex-shrink: 0; width: 21px; height: 21px; }
.nav-label { font-size: 13px; font-weight: 600; color: #D8CFF0; }

.section-label { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 700; color: #C4B5E8; letter-spacing: 1.5px; padding: 0 10px; margin-top: 12px; margin-bottom: 8px; }
.section-ornament { flex-shrink: 0; opacity: 0.85; }
.section-candle { flex-shrink: 0; margin: 0 3px; filter: drop-shadow(0 0 3px rgba(245, 212, 114, 0.5)); }
.nav-icon { flex-shrink: 0; transition: transform .25s ease, filter .25s ease; }
.nav-item:hover .nav-icon { transform: scale(1.1); filter: drop-shadow(0 0 4px rgba(159, 130, 214, 0.5)); }
.nav-item.active .nav-icon {
  transform: scale(1.18);
  filter:
    drop-shadow(0 0 6px rgba(159, 130, 214, 0.9))
    drop-shadow(0 0 14px rgba(159, 130, 214, 0.5));
}
.course-list { display: flex; flex-direction: column; gap: 3px; }
.course-item { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.15s ease; }
.course-item:hover { background: rgba(139,95,196,0.18); }
.course-item:focus-visible { outline: 1.5px solid rgba(175,150,220,0.85); outline-offset: 1px; }
.course-item.active { background: rgba(139,95,196,0.28); box-shadow: inset 0 0 0 1.5px rgba(175,150,220,0.6); }
.course-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5), 0 0 6px rgba(0, 0, 0, 0.08); }
.course-name { flex: 1; font-size: 12px; font-weight: 500; color: #D8CFF0; }
.course-count { font-size: 11px; color: #F5D472; background: rgba(232,198,106,0.18); padding: 1px 8px; border-radius: var(--radius-pill); font-weight: 600; }
.course-delete-btn { display: none; width: 18px; height: 18px; border: none; background: none; color: var(--color-text-muted); cursor: pointer; font-size: 14px; line-height: 1; border-radius: 50%; flex-shrink: 0; margin-left: 2px; }
.course-item:hover .course-delete-btn { display: flex; align-items: center; justify-content: center; }
.course-delete-btn:hover { background: rgba(231,76,60,0.12); color: #e74c3c; }
.course-empty { font-size: 11px; color: var(--color-text-muted); padding: 8px 12px; }

.spacer { flex: 1; min-height: 16px; }

.settings-btn { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.15s; }
.settings-btn:hover { background: rgba(139,95,196,0.18); }
.settings-btn span { font-size: 12px; color: #D8CFF0; }

.bottom-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.bottom-actions .settings-btn { flex: 1; margin-bottom: 0; }

.streak-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(255, 153, 72, 0.1) 0%, rgba(255, 107, 157, 0.12) 100%); border: 1.5px solid rgba(255, 153, 72, 0.25); margin-bottom: 10px; }
.streak-icon-wrap { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255, 153, 72, 0.12); animation: anime-pulse 2.5s ease-in-out infinite; }
.streak-info { display: flex; flex-direction: column; gap: 1px; }
.streak-label { font-size: 10px; color: var(--color-text-tertiary); }
.streak-value { font-size: 13px; font-weight: 700; color: var(--color-pink); }

.user-section { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(255, 192, 213, 0.25), rgba(183, 148, 246, 0.2)); border: 1px solid rgba(255, 192, 213, 0.5); }
.user-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(255, 107, 157, 0.35); overflow: hidden; }
.user-avatar span { color: white; font-size: 14px; font-weight: 700; }
.user-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.user-info { display: flex; flex-direction: column; gap: 1px; }
.user-name { font-size: 12px; font-weight: 700; color: var(--color-text); }
.user-meta { font-size: 10px; color: var(--color-text-tertiary); }

/* ===== 黑潮侵蚀 · 按钮特效增强 ===== */
/* 黑潮涌动：底部波浪持续流动 */
.nav-item[data-icon="heirs"] .nav-icon path:last-child {
  animation: heirs-wave 2.8s ease-in-out infinite;
  transform-origin: 50% 100%;
}
.nav-item[data-icon="heirs"] .nav-icon path:nth-last-child(2) {
  animation: heirs-wave 3.6s ease-in-out infinite 0.4s;
  transform-origin: 50% 100%;
}
@keyframes heirs-wave {
  0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.85; }
  25%      { transform: translateY(-0.5px) scaleY(1.12); opacity: 1; }
  50%      { transform: translateY(0.3px) scaleY(0.95); opacity: 0.7; }
  75%      { transform: translateY(-0.3px) scaleY(1.06); opacity: 0.9; }
}

/* 裂纹呼吸脉冲：激活时裂纹持续发光闪烁 */
.nav-item.active[data-icon="heirs"] .nav-icon path:nth-child(5),
.nav-item.active[data-icon="heirs"] .nav-icon path:nth-child(6) {
  animation: heirs-crack-glow 1.8s ease-in-out infinite;
}
@keyframes heirs-crack-glow {
  0%, 100% { stroke-opacity: 0.75; filter: drop-shadow(0 0 0 transparent); }
  50%      { stroke-opacity: 1; filter: drop-shadow(0 0 3px rgba(232, 198, 106, 0.6)); }
}

/* 黑潮背景暗涌：激活时按钮底部有暗色潮汐光晕 */
.nav-item.active[data-icon="heirs"]::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(ellipse 80% 40% at 50% 100%, rgba(80, 20, 120, 0.30) 0%, transparent 70%);
  pointer-events: none;
  animation: heirs-aura-pulse 3s ease-in-out infinite;
  z-index: 0;
}
@keyframes heirs-aura-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
.nav-item.active[data-icon="heirs"] .nav-icon,
.nav-item.active[data-icon="heirs"] .nav-label {
  position: relative;
  z-index: 1;
}

/* 火种黯淡：已熄灭的火种闪烁 */
.nav-item[data-icon="heirs"] .nav-icon path:nth-child(3) {
  animation: heirs-ember 2.2s ease-in-out infinite;
}
@keyframes heirs-ember {
  0%, 100% { opacity: 0.5; }
  30%      { opacity: 0.2; }
  60%      { opacity: 0.6; }
}

/* 悬停时黑潮侵蚀按钮的专属效果 */
.nav-item[data-icon="heirs"]:hover .nav-icon {
  filter: drop-shadow(0 0 6px rgba(139, 95, 196, 0.6)) drop-shadow(0 0 12px rgba(80, 20, 120, 0.3));
}
</style>
