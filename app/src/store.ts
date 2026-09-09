// ============================================================
// Store barrel —— 统一导出入口（原巨型 store.ts 已按域拆分）
// 拆分为：core.ts（叶子：refs/渲染工具/加载/设置/统计/日志）
//         notes.ts（笔记+课程） ai.ts（AI+会话+RAG） quiz.ts（出题+复习）
// 所有既有消费者仍 `import { ... } from '@/store'` 或 '../store'，
// 通过本 barrel 的 export * 保持导出面不变，消费端零改动。
// 注意：core 必须排第一，确保其模块级副作用（marked 配置 / onNotesChanged / watch）先执行。
// titanErosion.ts 是独立的黄金裔侵蚀 store，不并入本 barrel（消费者直接 import '../store/titanErosion'）。
// ============================================================
export * from './store/core'
export * from './store/notes'
export * from './store/ai'
export * from './store/quiz'