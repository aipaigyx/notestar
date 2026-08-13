<template>
  <div class="app-container" :class="{ 'theme-dark': themeMode === 'dark' }">
    <Sidebar :active-route="currentRoute" @navigate="handleNavigate" @select-course="handleSelectCourse" @toggle-theme="toggleTheme" :theme-mode="themeMode" />
    <main class="page-view">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <!-- 全局弹窗组件 -->
    <GlobalDialog ref="globalDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import GlobalDialog from './components/GlobalDialog.vue'
import { setDialogRef, showToast } from './composables/useDialog'
import { getBackupInfo, isElectron, loadQuizData, loadQuizMastery, dueReviewCount } from './store'

const router = useRouter()
const route = useRoute()

const currentRoute = computed(() => route.path)

// 全局弹窗
const globalDialogRef = ref<InstanceType<typeof GlobalDialog> | null>(null)
onMounted(() => {
  if (globalDialogRef.value) {
    setDialogRef(globalDialogRef.value)
  }
})

// 启动时检查备份提醒（超过 7 天未备份）
const checkBackupReminder = async () => {
  if (!isElectron) return
  try {
    const info = await getBackupInfo()
    if (info?.overdue) {
      setTimeout(() => {
        showToast('⚠️ 已超过 7 天未备份，建议到设置页「一键备份」', 'warn', 5000)
      }, 1500)
    }
  } catch (e) { /* ignore */ }
}

// 启动时检查知识点复习提醒（有到期题目时提示）
const checkQuizReminder = async () => {
  if (!isElectron) return
  try {
    await loadQuizData()
    await loadQuizMastery()
    const due = dueReviewCount.value
    if (due > 0) {
      setTimeout(() => {
        showToast(`📖 你有 ${due} 道知识点到期待复习，去「知识点复习」页刷一组吧！`, 'info', 5000)
      }, 2500)
    }
  } catch (e) { /* ignore */ }
}

// 主题模式：light（亮色）→ dark（暗色）→ paimon（派蒙）循环切换
const themeMode = ref<'light' | 'dark' | 'paimon'>('light')

const applyTheme = (mode: 'light' | 'dark' | 'paimon') => {
  themeMode.value = mode
  document.documentElement.setAttribute('data-theme', mode)
  localStorage.setItem('notestar-theme', mode)
}

const toggleTheme = () => {
  const next = themeMode.value === 'light' ? 'dark' : themeMode.value === 'dark' ? 'paimon' : 'light'
  applyTheme(next)
}

// 初始化主题
onMounted(() => {
  const saved = localStorage.getItem('notestar-theme')
  if (saved === 'dark' || saved === 'paimon') {
    applyTheme(saved)
  }
})

// 启动备份提醒 + 复习提醒
onMounted(() => {
  checkBackupReminder()
  checkQuizReminder()
})

// 全局快捷键
const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl+S / Cmd+S → 保存当前笔记
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    // 通过自定义事件通知当前页面保存
    window.dispatchEvent(new CustomEvent('notestar:save'))
  }
  // Ctrl+N / Cmd+N → 新建笔记
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('notestar:new-note'))
  }
  // Ctrl+K / Cmd+K → 全局搜索（跳到笔记页并聚焦搜索框）
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (route.path !== '/notes') {
      router.push('/notes')
    } else {
      window.dispatchEvent(new CustomEvent('notestar:focus-search'))
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const handleNavigate = (path: string) => {
  router.push(path)
}

const handleSelectCourse = (courseId: string) => {
  router.push({ path: '/notes', query: { course: courseId } })
}
</script>
