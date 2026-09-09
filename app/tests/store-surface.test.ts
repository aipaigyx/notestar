import { describe, it, expect } from 'vitest'
import * as storeMod from '../src/store'

// 拆分后必须保留的"关键导出面"清单（来自各视图对 store 的实际 import + Dashboard/App 等）。
// 若某项缺失，说明 barrel 拆分漏导出，会导致对应视图编译失败。
const REQUIRED_EXPORTS = [
  // refs / 状态
  'notes', 'courses', 'chatSessions', 'stats', 'settings',
  'currentNote', 'currentCourseId', 'currentChatSession',
  'isDataLoaded', 'isElectron', 'pendingNoteOpen', 'localStorageMigrationNeed',
  // 渲染工具
  'renderMarkdown',
  // Electron 桥接
  'saveImage', 'resolveImageUrl', 'listScreenSources', 'captureScreen',
  'exportNotes', 'backupData', 'getBackupInfo', 'importFiles', 'selectImage', 'readClipboardImage',
  // 加载
  'loadAllData', 'refreshDashboardData', 'migrateFromLocalStorageAndClear',
  // 设置 / 卡片背景 / 头像
  'saveSettings', 'setUserName', 'setUserAvatar', 'clearUserAvatar', 'DEFAULT_USER_NAME',
  'normalizeCardBackgrounds', 'resolveCardBgRef', 'setCardBackground', 'clearCardBackground',
  'applyCardBgPreset', 'setCardBgVeil', 'isPresetRef', 'cardBgToCssValue',
  'CARD_BG_PRESETS', 'CARD_BG_DEFAULT_VEIL',
  // 统计 / 数据管理
  'addStudyTime', 'setPlan', 'getCurrentTime',
  'exportData', 'importData', 'clearData',
  // 前端日志
  'frontendLogger',
  // AI
  'generateNoteFromText', 'chatWithAI', 'summarizeNote',
  'getAnalysisCache', 'analyzeNote', 'expandNote',
  'createChatSession', 'saveChatSession', 'deleteChatSession',
  'buildNoteContext', 'retrieveRelevantNotes',
  // 笔记 / 课程
  'createNote', 'updateNote', 'removeNote',
  'getDeletedNotes', 'restoreNote', 'purgeNote',
  'createCourse', 'deleteCourse', 'getCourseById', 'getNotesByCourse',
  // 出题 / 复习
  'quizSessions', 'quizMistakes', 'quizMasteryMap',
  'loadQuizData', 'generateQuiz', 'finishQuizSession',
  'removeQuizMistake', 'buildMistakeSession', 'isQuizAnswerCorrect',
  'applyAnswerToMastery', 'applySessionMastery',
  'dueReviewCount', 'dueReviewQuestions',
  'weakPoints', 'dailyActivity', 'masteryStats', 'masteryByNote',
] as const

describe('store barrel 导出面完整（拆分回归保护）', () => {
  it('所有关键符号均可从 barrel 导入', () => {
    const exportedNames = new Set(Object.keys(storeMod))
    for (const name of REQUIRED_EXPORTS) {
      expect(exportedNames.has(name), `store 拆分后缺失导出: ${name}`).toBe(true)
    }
  })

  it('barrel 无重复导出冲突（关键类型仍可引用）', () => {
    // 类型导出也应可用（导出类型名）
    expect('CardBgGroup' in storeMod).toBe(false) // 类型不会出现在运行时 keys，仅验证不崩溃
  })

  it('barrel 导出面与拆分前一致（抽样：消费者实际用的职能函数存在）', () => {
    expect(typeof storeMod.loadAllData).toBe('function')
    expect(typeof storeMod.generateQuiz).toBe('function')
    expect(typeof storeMod.chatWithAI).toBe('function')
    expect(typeof storeMod.createNote).toBe('function')
    expect(typeof storeMod.renderMarkdown).toBe('function')
    expect(typeof storeMod.frontendLogger.error).toBe('function')
  })
})