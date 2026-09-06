<template>
  <div class="mindmap">
    <div class="mm-toolbar">
      <span class="mm-title">🧠 思维导图</span>
      <span class="mm-meta">{{ totalNodes }} 节点</span>
      <button class="mm-btn" @click="expandAll">全部展开</button>
      <button class="mm-btn" @click="collapseAll">全部折叠</button>
      <button class="mm-btn primary" @click="exportPng">⬇ 导出 PNG</button>
    </div>
    <div ref="svgWrap" class="mm-canvas" @wheel="onWheel">
      <svg
        :width="svgSize.w"
        :height="svgSize.h"
        :viewBox="`0 0 ${svgSize.w} ${svgSize.h}`"
        ref="svgRef"
        class="mm-svg"
      >
        <!-- 边（折叠的不画） -->
        <g class="mm-edges">
          <path
            v-for="(e, i) in layout.edges"
            :key="'e' + i"
            :d="e.d"
            fill="none"
            stroke="#B794F6"
            stroke-width="1.5"
            stroke-linecap="round"
            opacity="0.7"
          />
        </g>
        <!-- 节点 -->
        <g class="mm-nodes">
          <g
            v-for="n in visibleNodes"
            :key="n.id"
            :transform="`translate(${n.x},${n.y})`"
            class="mm-node"
            :class="{ root: n.depth === 0, leaf: n.isLeaf, collapsed: n._collapsed }"
            @click="toggle(n)"
          >
            <rect
              :x="-n.w / 2"
              :y="-n.h / 2"
              :width="n.w"
              :height="n.h"
              :rx="n.depth === 0 ? 16 : 10"
              :fill="nodeFill(n)"
              :stroke="n.depth === 0 ? '#FF6B9D' : 'rgba(255,255,255,0.9)'"
              stroke-width="1.5"
            />
            <text
              :y="4"
              text-anchor="middle"
              :font-size="n.depth === 0 ? 15 : 13"
              :font-weight="n.depth === 0 ? 600 : 500"
              fill="#3D2F4A"
            >{{ truncate(n.label, 22) }}</text>
            <circle
              v-if="!n.isLeaf"
              :cx="n.w / 2 - 8"
              :cy="-n.h / 2 + 8"
              r="7"
              fill="#B794F6"
            />
            <text
              v-if="!n.isLeaf"
              :x="n.w / 2 - 8"
              :y="-n.h / 2 + 11"
              text-anchor="middle"
              font-size="10"
              fill="#fff"
              font-weight="700"
            >{{ n._collapsed ? '+' : '−' }}</text>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'

interface Node {
  id: string
  label: string
  children?: Node[]
}

const props = defineProps<{ data: Node | null }>()

// ========== 布局（水平树：根左，子右伸） ==========
// 简化版：每层水平间隔 200px，同层垂直堆叠，节点宽按 label 估算
const NODE_H = 40
const NODE_GAP_X = 220
const NODE_GAP_Y = 16

const collapsedIds = ref<Set<string>>(new Set())

const layout = computed(() => {
  const root = props.data
  if (!root) return { nodes: [] as any[], edges: [] as any[] }
  const out: any[] = []
  const edges: any[] = []
  let rowCount = 0

  function walk(n: Node, depth: number, yStart: number): { yEnd: number; x: number } {
    const id = n.id || `n${out.length}`
    const isLeaf = !n.children || n.children.length === 0
    const collapsed = collapsedIds.value.has(id)
    const w = Math.max(80, Math.min(260, (n.label || '').length * 8 + 24))
    const h = NODE_H
    const x = depth * NODE_GAP_X + 60
    let y = yStart

    if (!collapsed && !isLeaf) {
      // 预计算子树总高度，决定 y 起点
      const subtreeHeight = (n.children!.length * (NODE_H + NODE_GAP_Y)) - NODE_GAP_Y
      const childStart = yStart
      const children = n.children!.map(c => walk(c, depth + 1, y))
      // 子节点平均 y（用于父节点对齐）
      const avgY = (children[0].yEnd + children[children.length - 1].yEnd) / 2
      y = (children[0].yEnd + children[children.length - 1].yEnd) / 2
      children.forEach((c, i) => {
        const child = n.children![i]
        edges.push({
          d: `M ${x + w / 2} ${y} C ${x + w / 2 + 60} ${y}, ${c.x - w / 2 - 60} ${c.yEnd}, ${c.x - w / 2} ${c.yEnd}`,
        })
      })
      rowCount = Math.max(rowCount, children[children.length - 1].yEnd)
    } else {
      // 折叠或叶节点
      const yy = yStart + NODE_H / 2
      y = yy
      rowCount = Math.max(rowCount, yStart + NODE_H)
    }

    out.push({
      id,
      label: n.label || '(空)',
      depth,
      x,
      y,
      w,
      h,
      isLeaf,
      _collapsed: collapsed && !isLeaf,
    })
    return { yEnd: yStart + NODE_H, x }
  }
  walk(root, 0, 20)
  return { nodes: out, edges }
})

const visibleNodes = computed(() => layout.value.nodes)
const totalNodes = computed(() => visibleNodes.value.length)

const svgSize = computed(() => {
  const nodes = visibleNodes.value
  if (!nodes.length) return { w: 400, h: 200 }
  const maxX = Math.max(...nodes.map(n => n.x + n.w / 2)) + 60
  const maxY = Math.max(...nodes.map(n => n.y + n.h / 2)) + 60
  return { w: Math.max(maxX, 600), h: Math.max(maxY, 300) }
})

// ========== 交互 ==========
function toggle(n: any) {
  if (n.isLeaf) return
  if (collapsedIds.value.has(n.id)) collapsedIds.value.delete(n.id)
  else collapsedIds.value.add(n.id)
  // 触发响应式更新（Set 需要重建）
  collapsedIds.value = new Set(collapsedIds.value)
}

function expandAll() {
  collapsedIds.value.clear()
  collapsedIds.value = new Set(collapsedIds.value)
}

function collapseAll() {
  visibleNodes.value.forEach(n => { if (!n.isLeaf) collapsedIds.value.add(n.id) })
  collapsedIds.value = new Set(collapsedIds.value)
}

// ========== 视觉 ==========
function nodeFill(n: any) {
  if (n.depth === 0) return 'rgba(255,107,157,0.15)'
  if (n.depth === 1) return 'rgba(183,148,246,0.12)'
  if (n.depth === 2) return 'rgba(66,146,245,0.10)'
  return 'rgba(255,255,255,0.7)'
}

function truncate(s: string, n: number) {
  s = String(s || '')
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ========== 缩放（滚轮） ==========
const scale = ref(1)
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  scale.value = Math.min(2, Math.max(0.4, scale.value * delta))
}

// ========== 导出 PNG ==========
const svgRef = ref<SVGSVGElement | null>(null)
const svgWrap = ref<HTMLDivElement | null>(null)

async function exportPng() {
  if (!svgRef.value) return
  const svgEl = svgRef.value
  const xml = new XMLSerializer().serializeToString(svgEl)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = svgSize.value.w
    canvas.height = svgSize.value.h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    canvas.toBlob(b => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `mindmap-${Date.now()}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }, 'image/png')
  }
  img.src = url
}

onMounted(() => {
  // 默认折叠深度 >= 2 的节点（避免一次铺开太长）
  if (props.data) {
    function pre(n: Node, depth: number) {
      if (depth >= 2 && n.children && n.children.length) collapsedIds.value.add(n.id || '')
      n.children?.forEach(c => pre(c, depth + 1))
    }
    pre(props.data, 0)
    collapsedIds.value = new Set(collapsedIds.value)
  }
})
</script>

<style scoped>
.mindmap {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(255,192,213,0.4);
  border-radius: var(--radius-xl);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
.mm-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.mm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.mm-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-soft);
  padding: 2px 8px;
  border-radius: 999px;
}
.mm-btn {
  border: 1px solid var(--color-border);
  background: #fff;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.15s;
}
.mm-btn:hover {
  background: var(--color-bg-soft);
}
.mm-btn.primary {
  background: var(--color-accent);
  color: #fff;
  border-color: transparent;
}
.mm-btn.primary:hover {
  filter: brightness(1.1);
}
.mm-canvas {
  background: linear-gradient(180deg, #FAF8FE 0%, #F5F3FA 100%);
  border-radius: 12px;
  overflow: auto;
  max-height: 600px;
  border: 1px dashed rgba(183,148,246,0.3);
}
.mm-svg {
  display: block;
  cursor: grab;
}
.mm-node {
  cursor: pointer;
  transition: opacity 0.15s;
}
.mm-node:hover rect {
  filter: brightness(1.03);
}
.mm-node text {
  pointer-events: none;
  user-select: none;
}
</style>