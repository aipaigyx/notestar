<template>
  <div class="md-toolbar">
    <button class="md-tb-btn" @click="$emit('action', 'h1')" title="一级标题">H1</button>
    <button class="md-tb-btn" @click="$emit('action', 'h2')" title="二级标题">H2</button>
    <button class="md-tb-btn" @click="$emit('action', 'h3')" title="三级标题">H3</button>
    <span class="md-tb-sep"></span>
    <button class="md-tb-btn" @click="$emit('action', 'bold')" title="加粗">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1.5H7.2C8.9 1.5 10 2.4 10 3.8C10 4.9 9.4 5.6 8.4 5.9C9.7 6.2 10.4 7 10.4 8.3C10.4 9.9 9.1 10.8 7.3 10.8H3V1.5ZM4.9 5V3.4H6.9C7.7 3.4 8.2 3.7 8.2 4.3C8.2 4.9 7.7 5 6.9 5H4.9ZM4.9 6.7H7C8 6.7 8.5 7 8.5 7.7C8.5 8.4 8 8.8 7 8.8H4.9V6.7Z" fill="currentColor"/></svg>
    </button>
    <button class="md-tb-btn" @click="$emit('action', 'italic')" title="斜体">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M5 1.5H10M2 10.5H7M7.5 1.5L4.5 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
    </button>
    <button class="md-tb-btn" @click="$emit('action', 'code')" title="行内代码">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2.5L1.5 6L4 9.5M8 2.5L10.5 6L8 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <span class="md-tb-sep"></span>
    <button class="md-tb-btn" @click="$emit('action', 'ul')" title="无序列表">• 列表</button>
    <button class="md-tb-btn" @click="$emit('action', 'ol')" title="有序列表">1. 列表</button>
    <button class="md-tb-btn" @click="$emit('action', 'quote')" title="引用">引用</button>
    <span class="md-tb-sep"></span>
    <button class="md-tb-btn" @click="$emit('action', 'codeblock')" title="代码块">代码块</button>
    <button class="md-tb-btn" @click="$emit('action', 'formula')" title="公式">Σ 公式</button>
    <button class="md-tb-btn" @click="$emit('action', 'link')" title="链接">链接</button>
    <button class="md-tb-btn" @click="$emit('action', 'table')" title="表格">表格</button>
    <button class="md-tb-btn" @click="$emit('action', 'hr')" title="分割线">— 分割线</button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'action', name: string): void
}>()
</script>

<style scoped>
.md-toolbar { display: flex; align-items: center; gap: 2px; padding: 0 20px 10px; flex-wrap: wrap; }
.md-tb-btn { height: 26px; padding: 0 8px; background: transparent; border: 1px solid transparent; border-radius: 6px; font-size: 11px; color: var(--color-text-secondary); cursor: pointer; display: inline-flex; align-items: center; gap: 2px; transition: all 0.15s; }
.md-tb-btn:hover { background: var(--color-pink-light); color: var(--color-pink); border-color: rgba(255,107,157,0.25); }
.md-tb-sep { width: 1px; height: 16px; background: var(--color-border); margin: 0 6px; }
</style>
