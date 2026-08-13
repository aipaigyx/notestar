<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="logo-section">
      <div class="logo-icon">
        <span class="logo-text">N</span>
      </div>
      <span class="logo-name">笔记星图</span>
    </div>

    <!-- 导航 -->
    <nav class="nav-section">
      <div
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: activeRoute === item.path }"
        @click="$emit('navigate', item.path)"
      >
        <svg class="nav-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path v-if="item.icon === 'dashboard'" d="M2 2H8V8H2V2Z M10 2H16V5H10V2Z M10 7H16V16H10V7Z M2 10H8V16H2V10Z" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'"/>
          <path v-else-if="item.icon === 'notes'" d="M3 1.5C3 0.67 3.67 0 4.5 0H10L15 5V16.5C15 17.33 14.33 18 13.5 18H4.5C3.67 18 3 17.33 3 16.5V1.5ZM9.5 1.5V5H13.5L9.5 1.5Z" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'"/>
          <template v-else-if="item.icon === 'graph'">
            <circle cx="9" cy="9" r="3" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'"/>
            <circle cx="3" cy="3" r="2" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'" opacity="0.7"/>
            <circle cx="15" cy="4" r="2" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'" opacity="0.7"/>
            <circle cx="4" cy="15" r="2" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'" opacity="0.7"/>
            <circle cx="15" cy="15" r="2" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'" opacity="0.7"/>
          </template>
          <path v-else-if="item.icon === 'assistant'" d="M9 0C4.03 0 0 3.58 0 8C0 10.04 0.84 11.9 2.25 13.33L1.5 16L4.25 14.87C5.37 15.42 6.65 15.75 8 15.75H9C13.97 15.75 18 12.17 18 7.75C18 3.33 13.97 0 9 0Z" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'"/>
          <path v-else-if="item.icon === 'quiz'" d="M4 1.5C4 0.67 4.67 0 5.5 0H10L15 5V16.5C15 17.33 14.33 18 13.5 18H5.5C4.67 18 4 17.33 4 16.5V1.5ZM9.5 1.5V5H13.5L9.5 1.5ZM9 9C7.9 9 7 9.9 7 11H8.5C8.5 10.45 8.72 10 9 10C9.28 10 9.5 10.45 9.5 11C9.5 11.5 9 11.83 8.6 12.17C8.25 12.47 8 12.8 8 13.5H9.5C9.5 13.1 9.68 12.93 9.9 12.75C10.2 12.5 10.5 12.2 10.5 11.5C10.5 11.1 10.62 10.75 10.83 10.5C10.47 10.16 10 9.96 9.5 9.96C9.49 9.96 9.49 9.96 9 9ZM8.9 14.3H9.7V15.1H8.9V14.3Z" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'"/>
          <path v-else-if="item.icon === 'logs'" d="M3 1.5C3 0.67 3.67 0 4.5 0H10L15 5V16.5C15 17.33 14.33 18 13.5 18H4.5C3.67 18 3 17.33 3 16.5V1.5ZM9.5 1.5V5H13.5L9.5 1.5ZM5.5 9H12.5V10.5H5.5V9ZM5.5 12H10.5V13.5H5.5V12Z" :fill="activeRoute === item.path ? '#FF6B9D' : '#9B9BB5'"/>
        </svg>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </nav>

    <!-- 我的课程 -->
    <div class="section-label">我的课程</div>
    <div class="course-list">
      <div
        v-for="course in courses"
        :key="course.id"
        class="course-item"
        :class="{ active: course.id === activeCourseId }"
        @click="selectCourse(course.id)"
      >
        <div class="course-dot" :style="{ background: course.color }"></div>
        <span class="course-name">{{ course.name }}</span>
        <span class="course-count">{{ course.noteCount }}</span>
        <button class="course-delete-btn" title="删除课程" @click.stop="confirmDeleteCourse(course)">×</button>
      </div>
      <div v-if="courses.length === 0" class="course-empty">
        暂无课程，去笔记页创建
      </div>
    </div>

    <!-- 弹性间隔 -->
    <div class="spacer"></div>

    <!-- 设置按钮 + 主题切换 -->
    <div class="bottom-actions">
      <div class="settings-btn" @click="$emit('navigate', '/settings')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="#9B9BB5" stroke-width="1.5"/>
          <path d="M8 1V3 M8 13V15 M1 8H3 M13 8H15 M3.5 3.5L4.9 4.9 M11.1 11.1L12.5 12.5 M3.5 12.5L4.9 11.1 M11.1 4.9L12.5 3.5" stroke="#9B9BB5" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>设置</span>
      </div>
      <div class="theme-toggle" @click="$emit('toggleTheme')" :title="themeMode === 'light' ? '切换到暗色' : themeMode === 'dark' ? '切换到派蒙主题' : '切换到亮色'">
        <svg v-if="themeMode === 'light'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 8.5c0 3-2.5 5.5-5.5 5.5s-5.5-2.5-5.5-5.5S5 3 8 3c.2 0 .4 0 .6.04C7.8 4.1 8.5 5.7 8.5 7.5c0 1.8-1.5 3.5-3.5 3.5.8.9 1.8 1.5 3 1.5z" fill="#9B9BB5"/>
        </svg>
        <svg v-else-if="themeMode === 'dark'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" fill="#FFD580"/>
          <path d="M8 1V3 M8 13V15 M1 8H3 M13 8H15 M3.5 3.5L4.9 4.9 M11.1 11.1L12.5 12.5 M3.5 12.5L4.9 11.1 M11.1 4.9L12.5 3.5" stroke="#FFD580" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
          <!-- 派蒙星形 -->
          <path d="M8 1L9.6 5.4L14 6.8L10.6 9.7L11.4 14L8 11.7L4.6 14L5.4 9.7L2 6.8L6.4 5.4L8 1Z" fill="#FFD966"/>
        </svg>
      </div>
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
        <span>星</span>
      </div>
      <div class="user-info">
        <span class="user-name">星野同学</span>
        <span class="user-meta">{{ courses.length }} 门课程 · {{ notes.length }} 篇笔记</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { courses, currentCourseId, stats, notes, deleteCourse } from '../store'
import { showConfirm } from '../composables/useDialog'

defineProps<{
  activeRoute: string
  themeMode?: 'light' | 'dark' | 'paimon'
}>()

const emit = defineEmits<{
  (e: 'navigate', path: string): void
  (e: 'selectCourse', courseId: string): void
  (e: 'toggleTheme'): void
}>()

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: 'dashboard' },
  { path: '/notes', label: '笔记整理', icon: 'notes' },
  { path: '/graph', label: '知识图谱', icon: 'graph' },
  { path: '/quiz', label: '知识点复习', icon: 'quiz' },
  { path: '/assistant', label: 'AI 助手', icon: 'assistant' },
  { path: '/logs', label: '系统日志', icon: 'logs' },
]

const activeCourseId = computed(() => currentCourseId.value)
const streakDays = computed(() => stats.value?.streakDays || 0)

const selectCourse = (id: string) => {
  currentCourseId.value = id
  emit('selectCourse', id)
  emit('navigate', '/notes')
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
.sidebar { width: 240px; height: 100%; display: flex; flex-direction: column; padding: 20px 16px; gap: 6px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border-right: 1px solid rgba(255, 192, 213, 0.4); overflow-y: auto; flex-shrink: 0; z-index: 10; }
.logo-section { display: flex; align-items: center; gap: 10px; padding: 0 4px; margin-bottom: 14px; }
.logo-icon { width: 38px; height: 38px; border-radius: 14px; background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(255, 107, 157, 0.35); animation: logoFloat 4s ease-in-out infinite; }
.logo-text { color: white; font-size: 17px; font-weight: 700; }
.logo-name { font-size: 15px; font-weight: 700; color: var(--color-text); background: linear-gradient(135deg, #FF6B9D, #B794F6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
@keyframes logoFloat { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-3px) rotate(2deg); } }

.nav-section { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.nav-item { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.2s ease; position: relative; }
.nav-item:hover { background: var(--color-pink-light); transform: translateX(2px); }
.nav-item.active { background: linear-gradient(135deg, rgba(255, 107, 157, 0.14), rgba(183, 148, 246, 0.14)); box-shadow: inset 0 0 0 1.5px rgba(255, 192, 213, 0.55); }
.nav-item.active .nav-label { color: var(--color-pink); font-weight: 700; }
.nav-item.active::after { content: ''; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: var(--gradient-pink-purple); box-shadow: 0 0 6px rgba(255, 107, 157, 0.6); }
.nav-icon { flex-shrink: 0; }
.nav-label { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }

.section-label { font-size: 11px; font-weight: 700; color: var(--color-text-tertiary); letter-spacing: 1px; padding: 0 12px; margin-top: 10px; margin-bottom: 6px; }
.course-list { display: flex; flex-direction: column; gap: 3px; }
.course-item { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.15s ease; }
.course-item:hover { background: var(--color-pink-light-2); }
.course-item.active { background: rgba(255, 107, 157, 0.1); box-shadow: inset 0 0 0 1.5px rgba(255, 192, 213, 0.5); }
.course-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5), 0 0 6px rgba(0, 0, 0, 0.08); }
.course-name { flex: 1; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }
.course-count { font-size: 11px; color: var(--color-pink); background: var(--color-pink-light); padding: 1px 8px; border-radius: var(--radius-pill); font-weight: 600; }
.course-delete-btn { display: none; width: 18px; height: 18px; border: none; background: none; color: var(--color-text-muted); cursor: pointer; font-size: 14px; line-height: 1; border-radius: 50%; flex-shrink: 0; margin-left: 2px; }
.course-item:hover .course-delete-btn { display: flex; align-items: center; justify-content: center; }
.course-delete-btn:hover { background: rgba(231,76,60,0.12); color: #e74c3c; }
.course-empty { font-size: 11px; color: var(--color-text-muted); padding: 8px 12px; }

.spacer { flex: 1; min-height: 16px; }

.settings-btn { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.15s; }
.settings-btn:hover { background: var(--color-pink-light); }
.settings-btn span { font-size: 12px; color: var(--color-text-secondary); }

.bottom-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.bottom-actions .settings-btn { flex: 1; margin-bottom: 0; }
.theme-toggle { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-pill); cursor: pointer; transition: all 0.15s; }
.theme-toggle:hover { background: var(--color-pink-light); transform: rotate(15deg); }

.streak-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(255, 153, 72, 0.1) 0%, rgba(255, 107, 157, 0.12) 100%); border: 1.5px solid rgba(255, 153, 72, 0.25); margin-bottom: 10px; }
.streak-icon-wrap { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255, 153, 72, 0.12); animation: anime-pulse 2.5s ease-in-out infinite; }
.streak-info { display: flex; flex-direction: column; gap: 1px; }
.streak-label { font-size: 10px; color: var(--color-text-tertiary); }
.streak-value { font-size: 13px; font-weight: 700; color: var(--color-pink); }

.user-section { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(255, 192, 213, 0.25), rgba(183, 148, 246, 0.2)); border: 1px solid rgba(255, 192, 213, 0.5); }
.user-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--gradient-pink-purple); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(255, 107, 157, 0.35); }
.user-avatar span { color: white; font-size: 14px; font-weight: 700; }
.user-info { display: flex; flex-direction: column; gap: 1px; }
.user-name { font-size: 12px; font-weight: 700; color: var(--color-text); }
.user-meta { font-size: 10px; color: var(--color-text-tertiary); }
</style>
