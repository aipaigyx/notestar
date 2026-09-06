<template>
  <div class="graph-page">
    <div class="glow-orb glow-pink" style="width: 500px; height: 500px; top: 80px; left: 100px;"></div>
    <div class="glow-orb glow-blue" style="width: 600px; height: 600px; bottom: -100px; right: 300px;"></div>

    <div class="content-layer">
      <!-- 图谱画布区 -->
      <div class="canvas-area">
        <!-- 顶部操作栏 -->
        <div class="canvas-toolbar">
          <div class="toolbar-left">
            <span class="toolbar-title">知识图谱</span>
            <span class="toolbar-sub">{{ graphStats.totalNodes }} 个知识点 · {{ graphStats.totalLinks }} 个关联</span>
          </div>
          <div class="toolbar-right">
            <!-- 搜索框 -->
            <div class="search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                v-model="searchKeyword"
                type="text"
                placeholder="搜索知识点..."
                class="search-input"
                @input="onSearch"
              />
              <button v-if="searchKeyword" class="search-clear" @click="searchKeyword = ''">×</button>
            </div>
            <!-- 筛选器 -->
            <select v-model="filterType" class="filter-select" @change="onFilterChange">
              <option value="all">全部</option>
              <option value="course">仅课程</option>
              <option value="topic">仅笔记</option>
              <option value="tag">仅标签</option>
            </select>
            <!-- 缩放控制 -->
            <div class="zoom-controls">
              <button class="tool-btn zoom-btn" @click="zoomIn" title="放大">＋</button>
              <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
              <button class="tool-btn zoom-btn" @click="zoomOut" title="缩小">－</button>
              <button class="tool-btn zoom-btn" @click="resetView" title="重置视图">⟲</button>
            </div>
            <button class="tool-btn" @click="rebuildGraphData" title="根据最新笔记重建图谱">刷新</button>
            <button class="tool-btn" @click="exportGraph" title="导出图谱数据">导出</button>
            <button class="tool-btn primary" @click="aiAnalyze" :disabled="aiAnalyzing">
              {{ aiAnalyzing ? 'AI 分析中...' : 'AI 分析' }}
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="graphNodes.length === 0" class="graph-empty">
          <div class="graph-empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="8" stroke="#D0D0E0" stroke-width="2"/>
              <circle cx="10" cy="10" r="4" stroke="#D0D0E0" stroke-width="2"/>
              <circle cx="38" cy="10" r="4" stroke="#D0D0E0" stroke-width="2"/>
              <circle cx="10" cy="38" r="4" stroke="#D0D0E0" stroke-width="2"/>
              <circle cx="38" cy="38" r="4" stroke="#D0D0E0" stroke-width="2"/>
              <line x1="24" y1="24" x2="10" y2="10" stroke="#D0D0E0" stroke-width="1.5"/>
              <line x1="24" y1="24" x2="38" y2="10" stroke="#D0D0E0" stroke-width="1.5"/>
              <line x1="24" y1="24" x2="10" y2="38" stroke="#D0D0E0" stroke-width="1.5"/>
              <line x1="24" y1="24" x2="38" y2="38" stroke="#D0D0E0" stroke-width="1.5"/>
            </svg>
          </div>
          <p class="graph-empty-title">暂无知识图谱</p>
          <p class="graph-empty-desc">导入笔记后，系统会自动从笔记中提取知识点并生成知识图谱</p>
          <button class="graph-empty-btn" @click="$router.push('/notes')">去导入笔记</button>
        </div>

        <!-- 图谱画布 -->
        <div
          v-else
          class="graph-canvas"
          ref="canvasRef"
          @wheel="onWheel"
          @mousedown="onCanvasMouseDown"
        >
          <!-- 可缩放/平移的变换层 -->
          <div
            class="graph-transform-layer"
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: canvasWidth + 'px',
              height: canvasHeight + 'px',
            }"
          >
            <svg class="connections-svg" :width="canvasWidth" :height="canvasHeight">
              <!-- 贝塞尔曲线连线 -->
              <path
                v-for="(conn, idx) in graphConnections"
                :key="`path-${idx}`"
                :d="getConnectionPath(conn.from, conn.to)"
                fill="none"
                :stroke="getConnectionStroke(conn.from, conn.to)"
                :stroke-width="getConnectionWidth(conn.from, conn.to)"
                :opacity="getConnectionOpacity(conn.from, conn.to)"
                class="connection-path"
              />
            </svg>

            <div
              v-for="node in graphNodes"
              :key="node.id"
              class="graph-node"
              :class="[
                node.type,
                {
                  selected: selectedNode === node.id,
                  dragging: draggingId === node.id,
                  dimmed: isNodeDimmed(node),
                  highlighted: isNodeHighlighted(node),
                }
              ]"
              :style="{
                left: node.x + 'px',
                top: node.y + 'px',
                width: node.w + 'px',
                height: node.h + 'px',
                borderRadius: node.r + 'px',
                background: node.bg,
                color: node.color,
                borderColor: node.border,
              }"
              @mousedown.stop="onNodeMouseDown($event, node.id)"
              @click="onNodeClick(node.id, $event)"
            >
              {{ node.label }}
            </div>
          </div>

          <!-- 缩放指示器（不随变换层缩放） -->
          <div class="canvas-hint">
            <span>滚轮缩放 · 拖拽空白处平移 · 双击节点拖拽</span>
          </div>
        </div>
      </div>

      <!-- 详情面板 -->
      <div class="detail-panel">
        <div class="detail-card" v-if="selectedNodeData">
          <div class="detail-header" :style="{ background: selectedNodeData.headerBg }">
            <span class="detail-name">{{ selectedNodeData.label }}</span>
            <span class="detail-type-badge" :style="{ background: selectedNodeData.bg, color: selectedNodeData.color }">{{ selectedNodeData.typeLabel }}</span>
          </div>
          <p class="detail-desc" v-if="selectedNodeData.desc">{{ selectedNodeData.desc }}</p>

          <!-- 知识覆盖度进度条 -->
          <div class="detail-coverage" v-if="selectedNodeData.id !== 'center'">
            <div class="coverage-header">
              <span class="coverage-label">知识覆盖度</span>
              <span class="coverage-value">{{ getCoveragePercent(selectedNodeData) }}%</span>
            </div>
            <div class="coverage-bar">
              <div class="coverage-fill" :style="{ width: getCoveragePercent(selectedNodeData) + '%', background: selectedNodeData.bg }"></div>
            </div>
          </div>

          <div class="detail-stats">
            <div class="detail-stat">
              <span class="ds-value">{{ selectedNodeData.noteCount }}</span>
              <span class="ds-label">相关笔记</span>
            </div>
            <div class="detail-stat">
              <span class="ds-value">{{ selectedNodeData.linkCount }}</span>
              <span class="ds-label">关联知识</span>
            </div>
            <div class="detail-stat">
              <span class="ds-value">{{ getNodeDepth(selectedNodeData) }}</span>
              <span class="ds-label">网络层级</span>
            </div>
          </div>

          <!-- 学习路径 -->
          <div class="detail-section" v-if="learningPath.length > 0">
            <h4 class="detail-section-title">📚 学习路径</h4>
            <div class="learning-path">
              <div
                v-for="(step, idx) in learningPath"
                :key="idx"
                class="path-step"
                :class="{ completed: idx < completedSteps }"
              >
                <div class="path-step-num">{{ idx + 1 }}</div>
                <div class="path-step-content">
                  <span class="path-step-label">{{ step.label }}</span>
                  <span class="path-step-type">{{ step.type }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="relatedNotes.length > 0">
            <h4 class="detail-section-title">相关笔记</h4>
            <div class="related-notes-list">
              <div
                v-for="note in relatedNotes"
                :key="note.id"
                class="related-note-item"
                @click="$router.push('/notes')"
              >
                <span class="rn-title">{{ note.title }}</span>
                <span class="rn-date">{{ formatDate(note.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="selectedNodeData.linkedLabels.length > 0">
            <h4 class="detail-section-title">关联知识点</h4>
            <div class="linked-tags">
              <span v-for="label in selectedNodeData.linkedLabels" :key="label" class="linked-tag">{{ label }}</span>
            </div>
          </div>
        </div>

        <div v-else class="detail-empty">
          <p>点击图谱中的节点查看详情</p>
        </div>

        <!-- AI 分析结果 -->
        <div v-if="aiAnalysisText" class="ai-analysis-card">
          <h4 class="detail-section-title">🤖 AI 分析</h4>
          <div class="markdown-body" v-html="renderMarkdown(aiAnalysisText)"></div>
          <div class="analysis-actions">
            <button class="tool-btn primary" @click="openAppendDialog" title="把分析结果以 Markdown 追加到所选笔记末尾并保存">📥 追加到笔记</button>
            <button class="tool-btn" @click="copyAnalysisText" title="复制分析内容到剪贴板">📋 复制分析</button>
          </div>
        </div>

        <!-- 追加分析到笔记对话框 -->
        <div v-if="appendDialogOpen" class="dialog-overlay" @click.self="appendDialogOpen = false">
          <div class="dialog-box">
            <h3 class="dialog-title">追加 AI 分析到笔记</h3>
            <p class="dialog-hint">将当前 AI 知识分析结果追加到所选笔记末尾，保存后永久保留（重新打开也不会丢失）。</p>
            <select v-model="appendTargetId" class="dialog-select">
              <option value="" disabled>— 请选择目标笔记 —</option>
              <option v-for="n in notes" :key="n.id" :value="n.id">{{ n.title }}（{{ courseName(n.courseId) }}）</option>
            </select>
            <div class="dialog-actions">
              <button class="tool-btn" @click="appendDialogOpen = false">取消</button>
              <button class="tool-btn primary" :disabled="appending" @click="appendToNote">{{ appending ? '追加中...' : '确认追加' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { notes, courses, renderMarkdown, chatWithAI, settings, updateNote, masteryByNote, loadQuizMastery } from '../store'
import { showAlert, showToast } from '../composables/useDialog'
import { buildAiCardHtml } from '../utils/aiCard'
import { extractKnowledgePoints } from '../utils/graphPoints'

const canvasRef = ref<HTMLElement | null>(null)
const canvasWidth = 760
const canvasHeight = 620
const selectedNode = ref<string | null>(null)
const aiAnalyzing = ref(false)
const aiAnalysisText = ref('')

// ========== 缩放与平移 ==========
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.15

const zoomIn = () => { zoom.value = Math.min(MAX_ZOOM, zoom.value + ZOOM_STEP) }
const zoomOut = () => { zoom.value = Math.max(MIN_ZOOM, zoom.value - ZOOM_STEP) }
const resetView = () => { zoom.value = 1; panX.value = 0; panY.value = 0 }

const onWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.value + delta))
  // 以鼠标位置为中心缩放
  const rect = canvasRef.value?.getBoundingClientRect()
  if (rect) {
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // 缩放前鼠标在画布坐标系中的位置
    const cx = (mx - panX.value) / zoom.value
    const cy = (my - panY.value) / zoom.value
    zoom.value = newZoom
    // 缩放后调整 pan 使鼠标位置保持不变
    panX.value = mx - cx * newZoom
    panY.value = my - cy * newZoom
  }
}

// 画布拖拽平移
let isPanning = false
let panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0

const onCanvasMouseDown = (e: MouseEvent) => {
  // 只在点击空白处时触发平移（非节点）
  if ((e.target as HTMLElement).classList.contains('graph-node')) return
  isPanning = true
  panStartX = e.clientX
  panStartY = e.clientY
  panOriginX = panX.value
  panOriginY = panY.value
  window.addEventListener('mousemove', onPanMouseMove)
  window.addEventListener('mouseup', onPanMouseUp)
  // 点击空白取消选中
  selectedNode.value = null
}

const onPanMouseMove = (e: MouseEvent) => {
  if (!isPanning) return
  panX.value = panOriginX + (e.clientX - panStartX)
  panY.value = panOriginY + (e.clientY - panStartY)
}

const onPanMouseUp = () => {
  isPanning = false
  window.removeEventListener('mousemove', onPanMouseMove)
  window.removeEventListener('mouseup', onPanMouseUp)
}

// ========== 搜索 ==========
const searchKeyword = ref('')

const onSearch = () => {
  // 搜索时自动选中第一个匹配的节点
  if (!searchKeyword.value.trim()) return
  const kw = searchKeyword.value.toLowerCase()
  const match = graphNodes.value.find(n =>
    n.label.toLowerCase().includes(kw) && n.id !== 'center'
  )
  if (match) selectedNode.value = match.id
}

const isNodeHighlighted = (node: GraphNode): boolean => {
  if (!searchKeyword.value.trim()) return false
  const kw = searchKeyword.value.toLowerCase()
  return node.label.toLowerCase().includes(kw)
}

const isNodeDimmed = (node: GraphNode): boolean => {
  if (node.id === 'center') return false
  // 搜索时非匹配节点暗淡
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.toLowerCase()
    return !node.label.toLowerCase().includes(kw)
  }
  // 筛选时非匹配类型暗淡
  if (filterType.value !== 'all' && node.type !== 'center' && node.type !== filterType.value) {
    return true
  }
  return false
}

// ========== 筛选 ==========
const filterType = ref<'all' | 'course' | 'topic' | 'tag'>('all')

const onFilterChange = () => {
  // 筛选变化时触发响应式
  Object.assign(graphData.value, { nodes: [...graphData.value.nodes] })
}

// ========== 力导向布局 ==========
// 节点初始坐标用相对画布中心的圆形分布
// 然后用 Fruchterman-Reingold 风格力模拟迭代收敛
const cx = canvasWidth / 2
const cy = canvasHeight / 2
const REPULSION = 36000   // 斥力强度（越大越分散，避免节点重叠）
const ATTRACTION = 0.04  // 引力强度（越大越紧凑）
const CENTER_PULL = 0.012 // 中心拉力（防止飘出画布）
const MAX_VEL = 18       // 最大位移步长
const COOLING = 0.94     // 温度衰减
const ITERATIONS = 500   // 最大迭代次数
const NODE_PADDING = 10  // 节点间最小间距

const draggingId = ref<string | null>(null)
const isSimulating = ref(false)
let simRafId: number | null = null
const nodeVels = new Map<string, { vx: number; vy: number }>()
const nodeSizes = new Map<string, { w: number; h: number }>()

// 给节点一个圆形初始分布
function initCircularLayout(nodes: GraphNode[]) {
  const n = nodes.length
  if (n === 0) return
  const radius = Math.min(cx, cy) * 0.65
  nodes.forEach((node, i) => {
    if (i === 0) {
      // 中心节点
      node.x = cx - node.w / 2
      node.y = cy - node.h / 2
    } else {
      const angle = (2 * Math.PI * (i - 1)) / Math.max(n - 1, 1) - Math.PI / 2
      node.x = cx + Math.cos(angle) * radius - node.w / 2
      node.y = cy + Math.sin(angle) * radius - node.h / 2
    }
    nodeVels.set(node.id, { vx: 0, vy: 0 })
    nodeSizes.set(node.id, { w: node.w, h: node.h })
  })
}

// 一次迭代：计算所有节点受力，更新位置
function stepSimulation(nodes: GraphNode[], connections: GraphConnection[], temperature: number): number {
  const forces = new Map<string, { fx: number; fy: number }>()
  nodes.forEach(n => forces.set(n.id, { fx: 0, fy: 0 }))

  // 1. 斥力：所有节点两两之间
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = (a.x + a.w / 2) - (b.x + b.w / 2)
      let dy = (a.y + a.h / 2) - (b.y + b.h / 2)
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.01) { dx = (Math.random() - 0.5) * 0.1; dy = (Math.random() - 0.5) * 0.1; dist = 0.1 }
      const force = REPULSION / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      forces.get(a.id)!.fx += fx
      forces.get(a.id)!.fy += fy
      forces.get(b.id)!.fx -= fx
      forces.get(b.id)!.fy -= fy
    }
  }

  // 2. 引力：相连节点之间
  connections.forEach(conn => {
    const a = nodes.find(n => n.id === conn.from)
    const b = nodes.find(n => n.id === conn.to)
    if (!a || !b) return
    const dx = (a.x + a.w / 2) - (b.x + b.w / 2)
    const dy = (a.y + a.h / 2) - (b.y + b.h / 2)
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
    const force = dist * ATTRACTION
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    forces.get(a.id)!.fx -= fx
    forces.get(a.id)!.fy -= fy
    forces.get(b.id)!.fx += fx
    forces.get(b.id)!.fy += fy
  })

  // 3. 中心拉力：防止节点飘出画布
  nodes.forEach(n => {
    const ax = (cx - (n.x + n.w / 2)) * CENTER_PULL
    const ay = (cy - (n.y + n.h / 2)) * CENTER_PULL
    forces.get(n.id)!.fx += ax
    forces.get(n.id)!.fy += ay
  })

  // 4. 应用力到位置（被拖拽的节点不动）
  let totalEnergy = 0
  nodes.forEach(n => {
    if (n.id === draggingId.value) return
    const f = forces.get(n.id)!
    const size = nodeSizes.get(n.id)!
    const v = nodeVels.get(n.id)!
    // 阻尼 + 力
    v.vx = (v.vx + f.fx) * 0.85
    v.vy = (v.vy + f.fy) * 0.85
    // 限速
    const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy)
    if (speed > MAX_VEL) {
      v.vx = (v.vx / speed) * MAX_VEL
      v.vy = (v.vy / speed) * MAX_VEL
    }
    // 应用位移（按当前温度限幅）
    const limitedVx = Math.max(-temperature, Math.min(temperature, v.vx))
    const limitedVy = Math.max(-temperature, Math.min(temperature, v.vy))
    n.x += limitedVx
    n.y += limitedVy
    // 边界约束
    n.x = Math.max(0, Math.min(canvasWidth - size.w, n.x))
    n.y = Math.max(0, Math.min(canvasHeight - size.h, n.y))
    totalEnergy += speed
  })

  return totalEnergy
}

// 启动力模拟（用于初次加载 & 拖拽后）
function startSimulation(nodes: GraphNode[], connections: GraphConnection[]) {
  if (isSimulating.value) return
  isSimulating.value = true
  let temp = MAX_VEL * 2
  let iter = 0
  const animate = () => {
    const energy = stepSimulation(nodes, connections, temp)
    temp *= COOLING
    iter++
    // 触发响应式更新：把节点数组重新包装为新数组
    Object.assign(graphData.value, { nodes: [...graphData.value.nodes] })
    if (energy > 0.05 && iter < ITERATIONS && temp > 0.1 && !draggingId.value) {
      simRafId = requestAnimationFrame(animate)
    } else {
      isSimulating.value = false
    }
  }
  simRafId = requestAnimationFrame(animate)
}

// 拖拽支持
let dragStartX = 0, dragStartY = 0
let dragOffsetX = 0, dragOffsetY = 0
let didDrag = false

const onNodeMouseDown = (e: MouseEvent, id: string) => {
  e.stopPropagation()
  const node = graphNodes.value.find(n => n.id === id)
  if (!node) return
  draggingId.value = id
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOffsetX = e.clientX - node.x
  dragOffsetY = e.clientY - node.y
  didDrag = false
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e: MouseEvent) => {
  if (!draggingId.value) return
  const node = graphNodes.value.find(n => n.id === draggingId.value)
  if (!node) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true
  // 直接计算新位置（相对 canvas）
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  node.x = e.clientX - rect.left - dragOffsetX + (dragStartX - rect.left - dragOffsetX - node.x)
  node.y = e.clientY - rect.top - dragOffsetY + (dragStartY - rect.top - dragOffsetY - node.y)
  // 简化：直接设位置
  const rectCanvas = canvas.getBoundingClientRect()
  node.x = e.clientX - rectCanvas.left - node.w / 2
  node.y = e.clientY - rectCanvas.top - node.h / 2
  // 边界约束
  node.x = Math.max(0, Math.min(canvasWidth - node.w, node.x))
  node.y = Math.max(0, Math.min(canvasHeight - node.h, node.y))
  // 重置速度，避免下次反弹
  const v = nodeVels.get(node.id)
  if (v) { v.vx = 0; v.vy = 0 }
  // 触发响应式
  Object.assign(graphData.value, { nodes: [...graphData.value.nodes] })
}

const onMouseUp = () => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  if (draggingId.value) {
    // 拖拽结束后让其他节点继续收敛
    const id = draggingId.value
    draggingId.value = null
    nextTick(() => {
      startSimulation(graphNodes.value, graphConnections.value)
    })
  }
}

const onNodeClick = (id: string, e: MouseEvent) => {
  e.stopPropagation()
  // 拖拽结束的点击不触发选中
  if (didDrag) { didDrag = false; return }
  selectedNode.value = id
}

// 贝塞尔曲线路径
const getConnectionPath = (fromId: string, toId: string): string => {
  const a = graphNodes.value.find(n => n.id === fromId)
  const b = graphNodes.value.find(n => n.id === toId)
  if (!a || !b) return ''
  const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2
  const x2 = b.x + b.w / 2, y2 = b.y + b.h / 2
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  // 控制点偏移制造弧度
  const dx = x2 - x1, dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  const offset = Math.min(30, dist * 0.15)
  // 垂直方向偏移
  const cx = mx - dy / dist * offset
  const cyp = my + dx / dist * offset
  return `M ${x1} ${y1} Q ${cx} ${cyp} ${x2} ${y2}`
}

// 连线颜色：选中时高亮，否则按节点类型
const getConnectionStroke = (fromId: string, toId: string): string => {
  const isSelected = selectedNode.value === fromId || selectedNode.value === toId
  if (isSelected) return '#FF6B9D'
  const a = graphNodes.value.find(n => n.id === fromId)
  return a?.type === 'tag' ? 'rgba(183,148,246,0.5)' : 'rgba(180,170,220,0.5)'
}

// 连线宽度：选中时粗
const getConnectionWidth = (fromId: string, toId: string): number => {
  const isSelected = selectedNode.value === fromId || selectedNode.value === toId
  return isSelected ? 2 : 1.2
}

// 连线透明度
const getConnectionOpacity = (fromId: string, toId: string): number => {
  // 搜索/筛选时非高亮连线暗淡
  if (searchKeyword.value.trim() || filterType.value !== 'all') {
    const a = graphNodes.value.find(n => n.id === fromId)
    const b = graphNodes.value.find(n => n.id === toId)
    if (a && isNodeDimmed(a) && b && isNodeDimmed(b)) return 0.08
  }
  if (!selectedNode.value) return 0.5
  return selectedNode.value === fromId || selectedNode.value === toId ? 1 : 0.25
}

interface GraphNode {
  id: string
  label: string
  type: 'center' | 'course' | 'topic' | 'point' | 'tag'
  typeLabel: string
  x: number
  y: number
  w: number
  h: number
  r: number
  bg: string
  color: string
  border?: string
  headerBg: string
  desc: string
  noteCount: number
  linkCount: number
  linkedLabels: string[]
  courseId?: string
}

interface GraphConnection {
  from: string
  to: string
}

// 从笔记数据动态生成图谱节点和连接
// 力导向布局：节点初始坐标由力模拟算法计算
const graphData = ref<{ nodes: GraphNode[]; connections: GraphConnection[] }>({ nodes: [], connections: [] })

function rebuildGraphData() {
  const nodes: GraphNode[] = []
  const connections: GraphConnection[] = []
  const courseColors: Record<string, string> = {}

  if (notes.value.length === 0) {
    graphData.value = { nodes, connections }
    return
  }

  // 1. 中心节点
  nodes.push({
    id: 'center',
    label: '我的知识库',
    type: 'center',
    typeLabel: '核心',
    x: 0, y: 0, w: 140, h: 56, r: 28,
    bg: 'linear-gradient(135deg, #FF6B9D, #B794F6)',
    color: '#fff',
    headerBg: 'linear-gradient(135deg, rgba(255,107,157,0.12), rgba(183,148,246,0.12))',
    desc: `共 ${notes.value.length} 篇笔记，涵盖 ${courses.value.length} 门课程`,
    noteCount: notes.value.length,
    linkCount: 0,
    linkedLabels: [],
  })

  // 2. 课程节点
  const coursesWithNotes = courses.value.filter(c => c.noteCount > 0)
  if (coursesWithNotes.length === 0 && notes.value.length > 0) {
    coursesWithNotes.push({ id: 'uncategorized', name: '未分类', noteCount: notes.value.length, color: '#FF6B9D' })
  }

  coursesWithNotes.forEach((course) => {
    const nodeId = `course-${course.id}`
    courseColors[course.id] = course.color
    nodes.push({
      id: nodeId,
      label: course.name,
      type: 'course',
      typeLabel: '课程',
      x: 0, y: 0, w: 110, h: 40, r: 20,
      bg: course.color,
      color: '#fff',
      headerBg: course.color + '20',
      desc: `${course.noteCount} 篇笔记`,
      noteCount: course.noteCount,
      linkCount: 0,
      linkedLabels: [],
      courseId: course.id,
    })
    connections.push({ from: 'center', to: nodeId })
  })

  // 3. 每门课程下的笔记标题节点：按最新编辑排序，限制每课程6篇以保证图谱可读且保持流畅。
  const allTopicNodes: { id: string; label: string; courseId: string; noteId: string }[] = []
  coursesWithNotes.forEach((course) => {
    const courseNotes = notes.value
      .filter(n => n.courseId === course.id || (course.id === 'uncategorized' && !n.courseId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const topNotes = courseNotes.slice(0, 6)
    topNotes.forEach((note) => {
      const nodeId = `topic-${note.id}`
      // 掌握度着色（来自知识点复习）：有错题=红，有一般=橙，掌握率高=绿，无数据=课程色
      const m = masteryByNote.value[note.id]
      let border = course.color + '60'
      let color = course.color
      let masteryDesc = ''
      if (m && m.total > 0) {
        masteryDesc = ` · 复习${m.total}题(${m.weak}错${m.mastered}熟)`
        if (m.weak > 0) { border = '#e5484d'; color = '#e5484d' }
        else if (m.mastered / m.total >= 0.7) { border = '#2fb344'; color = '#2fb344' }
        else if (m.medium > 0) { border = '#ff8a3d'; color = '#ff8a3d' }
      }
      nodes.push({
        id: nodeId,
        label: note.title.length > 12 ? note.title.substring(0, 12) + '...' : note.title,
        type: 'topic',
        typeLabel: '笔记',
        x: 0, y: 0, w: 100, h: 32, r: 16,
        bg: color + '26',
        color,
        border,
        headerBg: color + '15',
        desc: (note.content?.substring(0, 100) || '') + masteryDesc,
        noteCount: 1,
        linkCount: 0,
        linkedLabels: [],
        courseId: course.id,
      })
      connections.push({ from: `course-${course.id}`, to: nodeId })
      allTopicNodes.push({ id: nodeId, label: note.title, courseId: course.id, noteId: note.id })

      // 3.1 从笔记内容提取子知识点（## / ### 标题），细化图谱。只取 AI 报告之前的原始内容。
      const topPoints = extractKnowledgePoints(note.content || '', 8)
      topPoints.forEach((pointTitle, pi) => {
        const pointId = `point-${note.id}-${pi}`
        nodes.push({
          id: pointId,
          label: pointTitle.length > 12 ? pointTitle.substring(0, 12) + '...' : pointTitle,
          type: 'point',
          typeLabel: '知识点',
          x: 0, y: 0, w: 96, h: 28, r: 14,
          bg: course.color + '12',
          color: course.color,
          border: course.color + '35',
          headerBg: course.color + '10',
          desc: pointTitle,
          noteCount: 0,
          linkCount: 0,
          linkedLabels: [],
          courseId: course.id,
        })
        connections.push({ from: nodeId, to: pointId })
      })
    })
  })

  // 4. 标签节点
  const tagMap: Record<string, string[]> = {}
  notes.value.forEach(note => {
    note.tags?.forEach(tag => {
      if (!tagMap[tag]) tagMap[tag] = []
      tagMap[tag].push(note.id)
    })
  })

  const topTags = Object.entries(tagMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)

  topTags.forEach(([tag, noteIds], i) => {
    const nodeId = `tag-${i}`
    nodes.push({
      id: nodeId,
      label: tag,
      type: 'tag',
      typeLabel: '标签',
      x: 0, y: 0, w: 90, h: 28, r: 14,
      bg: 'rgba(183,148,246,0.12)',
      color: '#B794F6',
      border: '#B794F640',
      headerBg: 'rgba(183,148,246,0.08)',
      desc: `${noteIds.length} 篇笔记包含此标签`,
      noteCount: noteIds.length,
      linkCount: 0,
      linkedLabels: [],
    })
    connections.push({ from: 'center', to: nodeId })
    noteIds.forEach(noteId => {
      const topicNode = allTopicNodes.find(n => n.noteId === noteId)
      if (topicNode) {
        connections.push({ from: nodeId, to: topicNode.id })
      }
    })
  })

  // 统计 linkCount 和 linkedLabels
  connections.forEach(conn => {
    const fromNode = nodes.find(n => n.id === conn.from)
    const toNode = nodes.find(n => n.id === conn.to)
    if (fromNode) fromNode.linkCount++
    if (toNode) toNode.linkCount++
  })
  connections.forEach(conn => {
    const fromNode = nodes.find(n => n.id === conn.from)
    const toNode = nodes.find(n => n.id === conn.to)
    if (fromNode && toNode && fromNode.id !== 'center' && toNode.id !== 'center') {
      if (!fromNode.linkedLabels.includes(toNode.label)) fromNode.linkedLabels.push(toNode.label)
      if (!toNode.linkedLabels.includes(fromNode.label)) toNode.linkedLabels.push(fromNode.label)
    }
  })

  // 用力模拟计算初始坐标
  initCircularLayout(nodes)
  graphData.value = { nodes, connections }
  // 启动收敛
  nextTick(() => {
    startSimulation(nodes, connections)
  })
}

// 笔记/课程任意字段变化时重建图谱（标题、标签、课程调整、正文更新都能同步）。
watch(
  () => notes.value.map(n => `${n.id}|${n.title}|${n.courseId}|${(n.tags || []).join(',')}|${n.updatedAt}`).join(';;') +
    `::${courses.value.map(c => `${c.id}|${c.name}|${c.color}|${c.noteCount}`).join(';;')}`,
  () => {
    rebuildGraphData()
  },
  { immediate: true }
)

// 知识点复习掌握度变化时同步重建（节点掌握度着色）
watch(
  () => JSON.stringify(masteryByNote.value),
  () => rebuildGraphData()
)

const graphNodes = computed(() => graphData.value.nodes)
const graphConnections = computed(() => graphData.value.connections)

const graphStats = computed(() => ({
  totalNodes: graphNodes.value.length,
  totalLinks: graphConnections.value.length,
}))

const getNodeX = (id: string) => {
  const n = graphNodes.value.find(n => n.id === id)
  return n ? n.x + n.w / 2 : 0
}
const getNodeY = (id: string) => {
  const n = graphNodes.value.find(n => n.id === id)
  return n ? n.y + n.h / 2 : 0
}

const selectedNodeData = computed(() => {
  return graphNodes.value.find(n => n.id === selectedNode.value) || null
})

const relatedNotes = computed(() => {
  if (!selectedNodeData.value) return []
  const node = selectedNodeData.value

  if (node.type === 'course') {
    // 课程节点 -> 该课程下的笔记
    return notes.value.filter(n => n.courseId === node.courseId).slice(0, 5)
  } else if (node.type === 'topic') {
    // 笔记节点 -> 该笔记本身
    const noteId = node.id.replace('topic-', '')
    const note = notes.value.find(n => n.id === noteId)
    return note ? [note] : []
  } else if (node.type === 'tag') {
    // 标签节点 -> 包含该标签的笔记
    return notes.value.filter(n => n.tags?.some(t => t === node.label)).slice(0, 5)
  }
  return []
})

const selectNode = (id: string) => {
  selectedNode.value = id
}

// ========== 知识覆盖度 ==========
const getCoveragePercent = (node: GraphNode): number => {
  if (node.id === 'center') return 100
  const maxNotes = Math.max(...graphNodes.value.map(n => n.noteCount), 1)
  return Math.round((node.noteCount / maxNotes) * 100)
}

// ========== 网络层级（距中心节点的跳数） ==========
const getNodeDepth = (node: GraphNode): number => {
  if (node.id === 'center') return 0
  const visited = new Set<string>([node.id])
  const queue: { id: string; depth: number }[] = [{ id: node.id, depth: 0 }]
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (id === 'center') return depth
    graphConnections.value.forEach(conn => {
      if (conn.from === id && !visited.has(conn.to)) {
        visited.add(conn.to)
        queue.push({ id: conn.to, depth: depth + 1 })
      }
      if (conn.to === id && !visited.has(conn.from)) {
        visited.add(conn.from)
        queue.push({ id: conn.from, depth: depth + 1 })
      }
    })
  }
  return -1
}

// ========== 学习路径 ==========
const learningPath = computed<{ label: string; type: string }[]>(() => {
  if (!selectedNodeData.value) return []
  const node = selectedNodeData.value

  if (node.type === 'center') {
    return graphNodes.value
      .filter(n => n.type === 'course')
      .sort((a, b) => b.noteCount - a.noteCount)
      .slice(0, 5)
      .map(n => ({ label: n.label, type: '课程' }))
  }

  if (node.type === 'course') {
    const path: { label: string; type: string }[] = [{ label: '我的知识库', type: '核心' }]
    path.push({ label: node.label, type: '课程' })
    graphNodes.value
      .filter(n => n.type === 'topic' && n.courseId === node.courseId)
      .slice(0, 3)
      .forEach(n => path.push({ label: n.label, type: '笔记' }))
    return path
  }

  if (node.type === 'topic') {
    const path: { label: string; type: string }[] = [{ label: '我的知识库', type: '核心' }]
    if (node.courseId) {
      const course = graphNodes.value.find(n => n.id === `course-${node.courseId}`)
      if (course) path.push({ label: course.label, type: '课程' })
    }
    path.push({ label: node.label, type: '笔记' })
    node.linkedLabels.slice(0, 2).forEach(label => {
      path.push({ label, type: '标签' })
    })
    return path
  }

  if (node.type === 'tag') {
    const path: { label: string; type: string }[] = [{ label: '我的知识库', type: '核心' }]
    path.push({ label: node.label, type: '标签' })
    relatedNotes.value.slice(0, 3).forEach(note => {
      path.push({ label: note.title.length > 12 ? note.title.substring(0, 12) + '...' : note.title, type: '笔记' })
    })
    return path
  }

  return []
})

const completedSteps = ref(0)

const exportGraph = () => {
  // 导出图谱数据为 JSON
  const data = {
    nodes: graphNodes.value.map(n => ({ id: n.id, label: n.label, type: n.type })),
    connections: graphConnections.value,
    exportDate: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `knowledge-graph-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const aiAnalyze = async () => {
  if (!settings.value.apiKey) {
    showAlert('需要配置', '请先在设置中配置 API Key')
    return
  }
  aiAnalyzing.value = true
  aiAnalysisText.value = ''
  try {
    // 图谱分析只发送图谱结构和节点摘要；避免把所有笔记正文送往云端。
    const context = `本地图谱说明：以下为从用户笔记标题、课程和标签生成的结构，不包含无关笔记正文。`
    const nodeSummary = graphNodes.value
      .filter(n => n.id !== 'center')
      .map(n => `- ${n.label} (${n.typeLabel}, 关联${n.linkCount}个知识点)`)
      .join('\n')
    const question = `请分析以下知识图谱结构，指出：
1. 核心知识点及其重要性
2. 知识点间的关联关系
3. 可能的知识薄弱区（关联少的节点）
4. 推荐的学习路径

知识点列表：
${nodeSummary}

请用 Markdown 格式回答，200字以内。`

    const reply = await chatWithAI(question, context)
    aiAnalysisText.value = reply
  } catch (e: any) {
    const errMsg = e?.message || String(e)
    aiAnalysisText.value = `**分析失败**\n\n错误信息：${errMsg}\n\n请检查：\n- API Key 是否正确配置\n- 网络连接是否正常\n- 代理设置是否正确`
  } finally {
    aiAnalyzing.value = false
  }
}

// ========== 追加 AI 分析到笔记 ==========
const appendDialogOpen = ref(false)
const appendTargetId = ref('')
const appending = ref(false)

const courseName = (id: string) => courses.value.find(c => c.id === id)?.name || '未分类'

const openAppendDialog = () => {
  appendTargetId.value = ''
  appendDialogOpen.value = true
}

const copyAnalysisText = async () => {
  try {
    await navigator.clipboard.writeText(aiAnalysisText.value)
    showToast('分析内容已复制到剪贴板', 'success')
  } catch {
    showAlert('复制失败', '无法访问剪贴板，请手动复制')
  }
}

const appendToNote = async () => {
  if (!appendTargetId.value) { showAlert('提示', '请先选择目标笔记'); return }
  const note = notes.value.find(n => n.id === appendTargetId.value)
  if (!note) { showAlert('提示', '未找到所选笔记'); return }
  appending.value = true
  try {
    const cardHtml = buildAiCardHtml('analysis', 'AI 知识分析', aiAnalysisText.value)
    const updated = { ...note, content: (note.content || '') + cardHtml }
    await updateNote(updated)
    appendDialogOpen.value = false
    showToast(`已追加到笔记「${note.title}」（预览模式查看卡片效果）`, 'success')
  } catch (e: any) {
    showAlert('追加失败', e?.message || String(e))
  } finally {
    appending.value = false
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

onMounted(() => {
  loadQuizMastery()
  if (graphNodes.value.length > 0) {
    selectedNode.value = 'center'
  }
})

onUnmounted(() => {
  if (simRafId !== null) {
    cancelAnimationFrame(simRafId)
    simRafId = null
  }
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onPanMouseMove)
  window.removeEventListener('mouseup', onPanMouseUp)
})
</script>

<style scoped>
.graph-page { width: 100%; height: 100%; position: relative; overflow: hidden; background: var(--color-bg); }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; }

/* 画布区 */
.canvas-area { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.canvas-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 0 24px; height: 56px; background: var(--color-bg-soft); border-bottom: 1px solid var(--color-border); }
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-title { font-size: 16px; font-weight: 700; color: var(--color-text); }
.toolbar-sub { font-size: 12px; color: var(--color-text-tertiary); }
.toolbar-right { display: flex; gap: 8px; }
.tool-btn { height: 30px; padding: 0 14px; background: rgba(255,255,255,0.85); border: 1px solid rgba(255,192,213,0.45); border-radius: var(--radius-pill); font-size: 12px; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; }
.tool-btn:hover { background: var(--color-white); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.tool-btn.primary { background: var(--gradient-pink-purple); color: white; border: none; box-shadow: 0 3px 10px rgba(255,107,157,0.3); }
.tool-btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* 空状态 */
.graph-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.graph-empty-icon { margin-bottom: 8px; }
.graph-empty-title { font-size: 16px; font-weight: 600; color: var(--color-text-secondary); }
.graph-empty-desc { font-size: 13px; color: var(--color-text-muted); text-align: center; max-width: 320px; }
.graph-empty-btn { margin-top: 8px; padding: 10px 20px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; }

.graph-canvas { flex: 1; position: relative; overflow: hidden; margin: 0 16px 16px; background: rgba(255,255,255,0.3); border-radius: var(--radius-lg); border: 1px solid var(--color-border); }
.connections-svg { position: absolute; top: 0; left: 0; pointer-events: none; }

.graph-node { position: absolute; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; cursor: grab; border: 1px solid transparent; transition: transform 0.2s, box-shadow 0.2s; user-select: none; white-space: nowrap; }
.graph-node:active { cursor: grabbing; }
.graph-node.dragging { cursor: grabbing; z-index: 10; transition: none; }
.graph-node:hover { transform: scale(1.08); z-index: 2; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.graph-node.selected { transform: scale(1.12); z-index: 3; box-shadow: 0 4px 20px rgba(255,107,157,0.3); border-width: 2px; }
.graph-node.center { font-size: 15px; font-weight: 700; }
.graph-node.tag { font-weight: 500; }
.graph-node.point { font-weight: 500; font-size: 11px; border-style: dashed; }

/* 贝塞尔连线 */
.connection-path { transition: stroke 0.3s, stroke-width 0.3s, opacity 0.3s; }

/* 缩放变换层 */
.graph-transform-layer { position: absolute; top: 0; left: 0; transform-origin: 0 0; }

/* 搜索框 */
.search-box { display: flex; align-items: center; gap: 4px; height: 30px; padding: 0 8px; background: rgba(255,255,255,0.8); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-muted); }
.search-input { border: none; outline: none; background: transparent; font-size: 12px; color: var(--color-text); width: 100px; }
.search-clear { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 16px; line-height: 1; padding: 0; }
.search-clear:hover { color: var(--color-text); }

/* 筛选下拉 */
.filter-select { height: 30px; padding: 0 8px; background: rgba(255,255,255,0.8); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 12px; color: var(--color-text-secondary); cursor: pointer; outline: none; }

/* 缩放控制 */
.zoom-controls { display: flex; align-items: center; gap: 4px; }
.zoom-btn { width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.zoom-level { font-size: 11px; color: var(--color-text-muted); min-width: 36px; text-align: center; }

/* 节点暗淡/高亮 */
.graph-node.dimmed { opacity: 0.2; }
.graph-node.highlighted { box-shadow: 0 0 0 3px rgba(255,107,157,0.4), 0 4px 16px rgba(255,107,157,0.3); z-index: 5; }

/* 画布提示 */
.canvas-hint { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--color-text-muted); background: rgba(255,255,255,0.6); padding: 4px 12px; border-radius: var(--radius-pill); pointer-events: none; white-space: nowrap; }

/* 详情面板 */
.detail-panel { width: 300px; height: 100%; display: flex; flex-direction: column; background: rgba(255,255,255,0.8); border-left: 1px solid var(--color-border); flex-shrink: 0; overflow-y: auto; }
.detail-card { display: flex; flex-direction: column; padding: 20px; gap: 16px; }
.detail-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-radius: var(--radius-md); }
.detail-name { font-size: 16px; font-weight: 700; color: var(--color-text); }
.detail-type-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-pill); }
.detail-desc { font-size: 12px; line-height: 1.6; color: var(--color-text-secondary); }

.detail-stats { display: flex; gap: 12px; }
.detail-stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px; background: var(--color-bg-soft); border-radius: var(--radius-md); }
.ds-value { font-size: 18px; font-weight: 700; color: var(--color-text); }
.ds-label { font-size: 10px; color: var(--color-text-tertiary); }

.detail-section { display: flex; flex-direction: column; gap: 10px; }
.detail-section-title { font-size: 12px; font-weight: 700; color: var(--color-text); }
.related-notes-list { display: flex; flex-direction: column; gap: 6px; }
.related-note-item { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: var(--color-bg-soft); border-radius: var(--radius-sm); cursor: pointer; }
.related-note-item:hover { background: var(--color-border-light); }
.rn-title { font-size: 12px; font-weight: 500; color: var(--color-text); }
.rn-date { font-size: 10px; color: var(--color-text-muted); }

.linked-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.linked-tag { font-size: 11px; padding: 4px 10px; background: rgba(183,148,246,0.12); color: #B794F6; border-radius: var(--radius-pill); }

.detail-empty { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--color-text-muted); }

.ai-analysis-card { padding: 16px 20px; border-top: 1px solid var(--color-border); }
.analysis-actions { display: flex; gap: 8px; margin-top: 12px; }
.dialog-overlay { position: fixed; inset: 0; background: rgba(30,20,40,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.dialog-box { width: 380px; max-width: 90vw; background: var(--color-white, #fff); border-radius: 14px; padding: 20px; box-shadow: 0 12px 40px rgba(107,134,255,0.25); }
.dialog-title { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: var(--color-text); }
.dialog-hint { margin: 0 0 14px; font-size: 12px; line-height: 1.7; color: var(--color-text-secondary); }
.dialog-select { width: 100%; height: 36px; padding: 0 10px; border: 1px solid rgba(255,192,213,0.5); border-radius: 8px; font-size: 13px; color: var(--color-text); background: var(--color-bg-soft, #f5f3fa); outline: none; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

/* 知识覆盖度 */
.detail-coverage { display: flex; flex-direction: column; gap: 6px; }
.coverage-header { display: flex; justify-content: space-between; align-items: center; }
.coverage-label { font-size: 11px; font-weight: 600; color: var(--color-text-secondary); }
.coverage-value { font-size: 12px; font-weight: 700; color: var(--color-text); }
.coverage-bar { height: 6px; background: var(--color-bg-soft); border-radius: var(--radius-pill); overflow: hidden; }
.coverage-fill { height: 100%; border-radius: var(--radius-pill); transition: width 0.4s ease; }

/* 学习路径 */
.learning-path { display: flex; flex-direction: column; gap: 4px; }
.path-step { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--color-bg-soft); border-radius: var(--radius-sm); }
.path-step.completed { opacity: 0.6; }
.path-step-num { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: var(--gradient-pink-purple); color: white; font-size: 10px; font-weight: 700; border-radius: 50%; flex-shrink: 0; }
.path-step-content { display: flex; flex-direction: column; gap: 1px; }
.path-step-label { font-size: 11px; font-weight: 500; color: var(--color-text); }
.path-step-type { font-size: 9px; color: var(--color-text-muted); }
</style>
