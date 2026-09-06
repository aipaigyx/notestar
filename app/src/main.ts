import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
import 'katex/dist/katex.min.css'
import { loadAllData } from './store'

import Dashboard from './views/Dashboard.vue'
import NoteOrganize from './views/NoteOrganize.vue'
import KnowledgeGraph from './views/KnowledgeGraph.vue'
import AIAssistant from './views/AIAssistant.vue'
import Settings from './views/Settings.vue'
import About from './views/About.vue'
import LogViewer from './views/LogViewer.vue'
import QuizReview from './views/QuizReview.vue'
import ReviewView from './views/ReviewView.vue'
import TitanErosion from './views/TitanErosion.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: Dashboard },
    { path: '/notes', component: NoteOrganize },
    { path: '/graph', component: KnowledgeGraph },
    { path: '/assistant', component: AIAssistant },
    { path: '/quiz', component: QuizReview },
    { path: '/review', component: ReviewView },
    { path: '/heirs', component: TitanErosion },
    { path: '/titans', redirect: '/heirs' },
    { path: '/settings', component: Settings },
    { path: '/about', component: About },
    { path: '/logs', component: LogViewer },
  ]
})

const app = createApp(App)
app.use(router)

// 先挂载再加载数据，组件通过 watch(isDataLoaded) 响应数据就绪
app.mount('#app')

// 加载本地数据（异步，组件通过 isDataLoaded 感知）
loadAllData().catch(err => {
  console.error('[Store] 数据加载失败:', err)
})
