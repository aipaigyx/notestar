<template>
  <div class="settings-page">
    <div class="glow-orb glow-pink" style="width: 400px; height: 400px; top: 60px; left: -60px;"></div>

    <div class="content-layer">
      <div class="settings-container">
        <h2 class="page-title">设置</h2>

        <!-- AI 配置 -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">AI 配置</h3>
            <p class="section-desc">选择 AI 平台并配置 API Key，支持多个主流 AI 服务商</p>
          </div>

          <!-- 平台选择 -->
          <div class="form-group">
            <label class="form-label">AI 平台</label>
            <div class="platform-grid">
              <div
                v-for="platform in platforms"
                :key="platform.id"
                class="platform-card"
                :class="{ active: selectedProvider === platform.id }"
                @click="selectProvider(platform.id)"
              >
                <span class="platform-icon">{{ platform.icon }}</span>
                <span class="platform-name">{{ platform.name }}</span>
                <span v-if="selectedProvider === platform.id" class="platform-check">✓</span>
              </div>
            </div>
          </div>

          <!-- API Key -->
          <div v-if="selectedProvider !== 'local'" class="form-group">
            <label class="form-label">
              {{ currentPlatform.name }} API Key
            </label>
            <input
              v-model="apiKeyInput"
              type="password"
              class="form-input"
              :placeholder="currentPlatform.apiKeyPrefix + '...'"
            />
            <p class="form-hint">
              获取方式：访问
              <a :href="currentPlatform.apiKeyUrl" target="_blank" class="form-link">{{ currentPlatform.apiKeyUrl }}</a>
              创建 API Key
            </p>
          </div>

          <!-- 本地模型说明 -->
          <div v-else class="form-group">
            <label class="form-label">本地模型说明</label>
            <p class="form-hint" style="line-height: 1.8;">
              使用本机 Ollama 服务（127.0.0.1:11434），无需 API Key。<br/>
              ① 安装 Ollama：<a href="https://ollama.com" target="_blank" class="form-link">ollama.com/download</a><br/>
              ② 打开终端运行：<code style="background: var(--color-bg-soft); padding: 2px 6px; border-radius: 4px;">ollama pull qwen2.5:7b-instruct</code><br/>
              ③ 点击下方「测试连通性」确认服务可用
            </p>
          </div>

          <!-- 连通性测试 -->
          <div class="form-group">
            <button class="test-btn" @click="testConnection" :disabled="testing">
              {{ testing ? '测试中...' : '🔗 测试连通性' }}
            </button>
            <span v-if="testResult" class="test-result" :class="{ success: testResult.success, error: !testResult.success }">
              {{ testResult.message }}
            </span>
          </div>

          <!-- 模型选择 -->
          <div class="form-group">
            <label class="form-label">
              模型
              <button v-if="fetchedModels.length > 0" class="model-toggle-btn" @click="useFetchedModels = !useFetchedModels">
                {{ useFetchedModels ? '📋 使用实时列表' : '📋 使用预设列表' }}
              </button>
            </label>
            <!-- 实时获取的模型列表 -->
            <select v-if="useFetchedModels && fetchedModels.length > 0" v-model="modelInput" class="form-input">
              <option v-for="model in fetchedModels" :key="model" :value="model">{{ model }}</option>
            </select>
            <!-- 预设模型列表 -->
            <select v-else v-model="modelInput" class="form-input">
              <option v-for="model in currentPlatform.models" :key="model.id" :value="model.id">
                {{ model.name }}{{ model.desc ? `（${model.desc}）` : '' }}
              </option>
            </select>
            <p v-if="fetchedModels.length > 0" class="form-hint">
              ✓ 已从 API 获取 {{ fetchedModels.length }} 个模型，可点击上方按钮切换列表
            </p>
          </div>

          <button class="save-btn" @click="saveApiKey" :disabled="saving">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
          <span v-if="saveSuccess" class="save-success">✓ 已保存</span>
        </div>

        <!-- 功能模型路由 -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">功能模型路由</h3>
            <p class="section-desc">为不同功能指定专属模型：如对话用云端、深度分析用本地模型（省费用/保隐私）。留空则全部跟随上方全局配置。</p>
          </div>

          <div v-for="routeKey in ROUTE_KEYS" :key="routeKey" class="route-row">
            <div class="route-info">
              <label class="route-toggle">
                <input type="checkbox" v-model="routingUI[routeKey].enabled" />
                <span class="route-name">{{ routeLabel(routeKey) }}</span>
              </label>
              <span class="route-desc">{{ routeDesc(routeKey) }}</span>
            </div>
            <div v-if="routingUI[routeKey].enabled" class="route-config">
              <select v-model="routingUI[routeKey].provider" class="form-input route-select" @change="onRouteProviderChange(routeKey)">
                <option v-for="p in platforms" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <select v-model="routingUI[routeKey].model" class="form-input route-select">
                <option v-for="m in routeModels(routeKey)" :key="m.id" :value="m.id">{{ m.name }}{{ m.desc ? `（${m.desc}）` : '' }}</option>
              </select>
            </div>
            <span v-else class="route-follow">跟随全局</span>
          </div>
        </div>

        <!-- 使用说明 -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">使用说明</h3>
          </div>
          <div class="guide-list">
            <div class="guide-item">
              <div class="guide-num">1</div>
              <div class="guide-body">
                <span class="guide-title">选择 AI 平台并配置 Key</span>
                <span class="guide-desc">在上方选择你喜欢的 AI 平台，填入对应的 API Key 并保存</span>
              </div>
            </div>
            <div class="guide-item">
              <div class="guide-num">2</div>
              <div class="guide-body">
                <span class="guide-title">导入转写文本</span>
                <span class="guide-desc">到「笔记整理」页，点击「导入转写文本」，选择录音转写后的 .txt 文件，或直接粘贴文本</span>
              </div>
            </div>
            <div class="guide-item">
              <div class="guide-num">3</div>
              <div class="guide-body">
                <span class="guide-title">AI 自动整理</span>
                <span class="guide-desc">AI 会将原始转写文本整理成结构化笔记，提取知识点、公式和重点</span>
              </div>
            </div>
            <div class="guide-item">
              <div class="guide-num">4</div>
              <div class="guide-body">
                <span class="guide-title">AI 问答</span>
                <span class="guide-desc">到「AI 助手」页，基于你的笔记库提问，AI 会引用笔记内容回答</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 数据管理 -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">数据管理</h3>
            <p class="section-desc">所有数据存储在本地，不会上传到服务器</p>
          </div>
          <div class="data-stats">
            <div class="data-stat-item">
              <span class="data-stat-label">笔记数量</span>
              <span class="data-stat-value">{{ notes.length }}</span>
            </div>
            <div class="data-stat-item">
              <span class="data-stat-label">课程数量</span>
              <span class="data-stat-value">{{ courses.length }}</span>
            </div>
            <div class="data-stat-item">
              <span class="data-stat-label">对话记录</span>
              <span class="data-stat-value">{{ chatSessions.length }}</span>
            </div>
          </div>

          <div class="data-actions">
            <button class="data-btn export" @click="doExport" :disabled="dataBusy !== false">
              {{ dataBusy === 'export' ? '导出中...' : '导出数据' }}
            </button>
            <button class="data-btn import" @click="doImport" :disabled="dataBusy !== false">
              {{ dataBusy === 'import' ? '导入中...' : '导入数据' }}
            </button>
            <button class="data-btn danger" @click="doClear" :disabled="dataBusy !== false">
              清空数据
            </button>
          </div>
          <p v-if="dataMsg" class="data-msg" :class="{ error: dataMsgType === 'error', success: dataMsgType === 'success' }">{{ dataMsg }}</p>

          <!-- 一键备份 -->
          <div class="backup-row">
            <button class="data-btn backup" @click="doBackup" :disabled="dataBusy !== false">
              {{ dataBusy === 'backup' ? '备份中...' : '💾 一键备份' }}
            </button>
            <div class="backup-info">
              <template v-if="backupInfo.lastBackupAt">
                上次备份：{{ formatBackupTime(backupInfo.lastBackupAt) }}
                <span v-if="backupInfo.overdue" class="backup-warn">· 已超过 7 天，建议备份</span>
              </template>
              <template v-else>
                <span class="backup-warn">尚未备份过，建议立即备份</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { settings, saveSettings, notes, courses, chatSessions, exportData, importData, clearData, isDataLoaded, isElectron, backupData, getBackupInfo } from '../store'
import { AI_PLATFORMS } from '../types'
import type { AIProvider } from '../types'
import { showConfirm, showAlert, showToast } from '../composables/useDialog'

const platforms = AI_PLATFORMS
const selectedProvider = ref<AIProvider>('deepseek')
const apiKeyInput = ref('')
const modelInput = ref('deepseek-chat')
const saving = ref(false)
const saveSuccess = ref(false)
const dataBusy = ref<false | 'export' | 'import' | 'clear' | 'backup'>(false)
const dataMsg = ref('')
const dataMsgType = ref<'success' | 'error'>('success')
const backupInfo = ref<{ lastBackupAt?: string; backupDir?: string; overdue: boolean }>({ overdue: true })

// 连通性测试 + 实时模型列表
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)
const fetchedModels = ref<string[]>([])
const useFetchedModels = ref(false)

// 当前选中平台的配置
const currentPlatform = computed(() => {
  return AI_PLATFORMS.find(p => p.id === selectedProvider.value) || AI_PLATFORMS[0]
})

// 数据加载完成后回填设置
watch(isDataLoaded, (loaded) => {
  if (loaded) {
    selectedProvider.value = settings.value.provider || 'deepseek'
    apiKeyInput.value = settings.value.apiKey || ''
    modelInput.value = settings.value.model || currentPlatform.value.defaultModel
    applyRoutingToUI()
  }
}, { immediate: true })

onMounted(() => {
  selectedProvider.value = settings.value.provider || 'deepseek'
  apiKeyInput.value = settings.value.apiKey || ''
  modelInput.value = settings.value.model || currentPlatform.value.defaultModel
  applyRoutingToUI()
  loadBackupInfo()
})

// ========== 一键备份 ==========
const loadBackupInfo = async () => {
  try {
    backupInfo.value = await getBackupInfo()
  } catch (e) { /* ignore */ }
}
const formatBackupTime = (t: string) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const doBackup = async () => {
  dataBusy.value = 'backup'
  dataMsg.value = ''
  try {
    const path = await backupData()
    if (path) {
      dataMsg.value = '备份成功 ✓（自动保留最近 7 份）'
      dataMsgType.value = 'success'
    }
  } catch (e: any) {
    dataMsg.value = e.message || '备份失败'
    dataMsgType.value = 'error'
  } finally {
    dataBusy.value = false
    loadBackupInfo()
  }
}

// 切换平台时，重置模型为该平台的默认模型
const selectProvider = (provider: AIProvider) => {
  selectedProvider.value = provider
  const platform = AI_PLATFORMS.find(p => p.id === provider)!
  modelInput.value = platform.defaultModel
  // 切换平台时清空之前获取的模型列表；API Key 回填已保存的值，避免误清用户密钥
  apiKeyInput.value = settings.value.apiKey || ''
  fetchedModels.value = []
  useFetchedModels.value = false
  testResult.value = null
}

// ========== 功能模型路由 ==========
type RouteKey = 'chat' | 'quick' | 'deep'
const ROUTE_KEYS: RouteKey[] = ['chat', 'quick', 'deep']
const routingUI = ref<Record<RouteKey, { enabled: boolean; provider: AIProvider; model: string }>>({
  chat: { enabled: false, provider: 'deepseek', model: '' },
  quick: { enabled: false, provider: 'deepseek', model: '' },
  deep: { enabled: false, provider: 'deepseek', model: '' },
})

const routeLabel = (k: RouteKey) => ({ chat: 'AI 对话', quick: '快速整理', deep: '深度分析' }[k])
const routeDesc = (k: RouteKey) => ({
  chat: 'AI 助手问答（ai:chat）',
  quick: '导入文本 AI 整理（ai:generateNote）',
  deep: '知识分析 / 知识扩展 / 摘要',
}[k])

const routeModels = (k: RouteKey) => {
  const platform = AI_PLATFORMS.find(p => p.id === routingUI.value[k].provider) || AI_PLATFORMS[0]
  return platform.models
}
const onRouteProviderChange = (k: RouteKey) => {
  const platform = AI_PLATFORMS.find(p => p.id === routingUI.value[k].provider)!
  routingUI.value[k].model = platform.defaultModel
}

// 回填路由配置
const applyRoutingToUI = () => {
  const mr = settings.value.modelRouting
  ;(['chat', 'quick', 'deep'] as RouteKey[]).forEach(k => {
    const route = mr?.[k]
    routingUI.value[k] = {
      enabled: Boolean(route && route.model),
      provider: route?.provider || 'deepseek',
      model: route?.model || '',
    }
  })
}
// 组装路由配置（仅保存启用的项）
const collectRouting = () => {
  const mr: Record<string, { provider: AIProvider; model: string }> = {}
  ;(['chat', 'quick', 'deep'] as RouteKey[]).forEach(k => {
    if (routingUI.value[k].enabled && routingUI.value[k].model) {
      mr[k] = { provider: routingUI.value[k].provider, model: routingUI.value[k].model }
    }
  })
  return Object.keys(mr).length > 0 ? mr : undefined
}

// 测试连通性 + 获取模型列表
const testConnection = async () => {
  if (selectedProvider.value !== 'local' && !apiKeyInput.value.trim()) {
    showAlert('请先填写 API Key', '需要填写 API Key 才能测试连通性')
    return
  }
  testing.value = true
  testResult.value = null
  try {
    if (isElectron) {
      const result = await window.noteAPI.testConnection({
        provider: selectedProvider.value,
        apiKey: selectedProvider.value === 'local' ? '' : apiKeyInput.value.trim(),
      })
      testResult.value = { success: result.success, message: result.message }
      if (result.success && result.models && result.models.length > 0) {
        fetchedModels.value = result.models
        useFetchedModels.value = true
        showToast(`获取到 ${result.models.length} 个可用模型`, 'success')
      }
    } else {
      // 浏览器模式：直接 fetch
      const platform = currentPlatform.value
      const isLocal = selectedProvider.value === 'local'
      const scheme = isLocal ? 'http' : 'https'
      const baseUrl = `${scheme}://${platform.hostname}${isLocal ? ':11434' : ''}${platform.apiPath}`
      const modelsUrl = baseUrl.replace(/\/chat\/completions.*$/, '') + '/models'
      const headers: Record<string, string> = {}
      if (!isLocal) headers['Authorization'] = `Bearer ${apiKeyInput.value.trim()}`
      const res = await fetch(modelsUrl, { headers })
      if (res.ok) {
        const data = await res.json()
        const models = (data.data || data.models || []).map((m: any) => m.id || m.name).filter(Boolean)
        testResult.value = { success: true, message: `连接成功！共 ${models.length} 个可用模型` }
        if (models.length > 0) {
          fetchedModels.value = models
          useFetchedModels.value = true
          showToast(`获取到 ${models.length} 个可用模型`, 'success')
        }
      } else {
        const errBody = await res.text().catch(() => '')
        testResult.value = { success: false, message: `连接失败：HTTP ${res.status}${errBody ? ' — ' + errBody.substring(0, 100) : ''}` }
      }
    }
  } catch (e: any) {
    testResult.value = { success: false, message: `错误：${e.message || '未知错误'}` }
  } finally {
    testing.value = false
  }
}

const saveApiKey = async () => {
  saving.value = true
  saveSuccess.value = false
  try {
    // 输入框为空时保留已保存的密钥，防止误操作把密钥覆盖为空
    const nextApiKey = apiKeyInput.value.trim() || settings.value.apiKey || ''
    await saveSettings({
      apiKey: nextApiKey,
      model: modelInput.value,
      provider: selectedProvider.value,
      modelRouting: collectRouting(),
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (e: any) {
    showAlert('保存失败', e.message || '未知错误')
  } finally {
    saving.value = false
  }
}

const doExport = async () => {
  dataBusy.value = 'export'
  dataMsg.value = ''
  try {
    const result = await exportData()
    if (result) {
      dataMsg.value = '数据已导出成功'
      dataMsgType.value = 'success'
    }
  } catch (e: any) {
    dataMsg.value = e.message || '导出失败'
    dataMsgType.value = 'error'
  } finally {
    dataBusy.value = false
  }
}

const doImport = async () => {
  const ok = await showConfirm({
    title: '导入数据',
    message: '导入数据将覆盖当前数据，确定继续吗？',
    confirmText: '导入',
  })
  if (!ok) return
  dataBusy.value = 'import'
  dataMsg.value = ''
  try {
    const result = await importData()
    if (result) {
      dataMsg.value = `导入成功：${result.notes} 篇笔记，${result.courses} 门课程`
      dataMsgType.value = 'success'
    }
  } catch (e: any) {
    dataMsg.value = e.message || '导入失败'
    dataMsgType.value = 'error'
  } finally {
    dataBusy.value = false
  }
}

const doClear = async () => {
  const ok1 = await showConfirm({
    title: '清空数据',
    message: '确定要清空所有数据吗？此操作不可恢复！',
    danger: true,
    confirmText: '继续',
  })
  if (!ok1) return
  const ok2 = await showConfirm({
    title: '再次确认',
    message: '清空后所有笔记、课程、对话记录将被删除！',
    danger: true,
    confirmText: '确认清空',
  })
  if (!ok2) return
  dataBusy.value = 'clear'
  dataMsg.value = ''
  try {
    await clearData('all')
    dataMsg.value = '所有数据已清空'
    dataMsgType.value = 'success'
  } catch (e: any) {
    dataMsg.value = e.message || '清空失败'
    dataMsgType.value = 'error'
  } finally {
    dataBusy.value = false
  }
}
</script>

<style scoped>
.settings-page { width: 100%; height: 100%; position: relative; overflow: hidden; background: var(--color-bg); }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; overflow-y: auto; }
.settings-container { max-width: 640px; margin: 0 auto; padding: 32px 24px; display: flex; flex-direction: column; gap: 24px; }

.page-title { font-size: 24px; font-weight: 700; color: var(--color-text); }

.settings-section { background: rgba(255,255,255,0.85); backdrop-filter: blur(10px); border: 1px solid rgba(255,192,213,0.4); border-radius: var(--radius-xl); padding: 24px; box-shadow: var(--shadow-sm); }
.section-header { margin-bottom: 20px; }
.section-title { font-size: 16px; font-weight: 700; color: var(--color-text); position: relative; padding-left: 12px; }
.section-title::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 4px; height: 16px; border-radius: 2px; background: var(--gradient-pink-purple); }
.section-desc { font-size: 13px; color: var(--color-text-secondary); margin-top: 4px; }

.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.form-input { width: 100%; height: 42px; padding: 0 14px; background: white; border: 1.5px solid rgba(255,192,213,0.5); border-radius: 12px; font-size: 14px; color: var(--color-text); outline: none; transition: all 0.15s; }
.form-input:focus { border-color: var(--color-pink); box-shadow: var(--shadow-glow); }
.form-hint { font-size: 12px; color: var(--color-text-muted); margin-top: 6px; }
.form-link { color: var(--color-pink); text-decoration: none; }
.form-link:hover { text-decoration: underline; }

/* 平台选择卡片 */
.platform-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.platform-card { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: white; border: 2px solid rgba(255,192,213,0.45); border-radius: 14px; cursor: pointer; transition: all 0.15s; }
.platform-card:hover { border-color: var(--color-pink); background: rgba(255,107,157,0.03); transform: translateY(-1px); }
.platform-card.active { border-color: var(--color-pink); background: linear-gradient(135deg, rgba(255,107,157,0.08), rgba(183,148,246,0.08)); box-shadow: 0 4px 12px rgba(255,107,157,0.15); }
.platform-icon { font-size: 20px; }
.platform-name { font-size: 13px; font-weight: 600; color: var(--color-text); flex: 1; }
.platform-check { color: var(--color-pink); font-size: 16px; font-weight: 700; }

.save-btn { height: 40px; padding: 0 24px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: var(--radius-pill); font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(255,107,157,0.25); }
.save-btn:disabled { opacity: 0.5; }
.save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,107,157,0.35); }
.save-success { margin-left: 12px; font-size: 13px; color: #26D0A8; font-weight: 600; }

/* 功能模型路由 */
.route-row { display: flex; align-items: center; gap: 16px; padding: 12px 14px; background: rgba(246,241,251,0.8); border: 1px solid rgba(255,192,213,0.4); border-radius: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.route-info { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 2px; }
.route-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.route-toggle input { accent-color: #FF6B9D; width: 16px; height: 16px; cursor: pointer; }
.route-name { font-size: 14px; font-weight: 700; color: var(--color-text); }
.route-desc { font-size: 11px; color: var(--color-text-muted); }
.route-config { display: flex; gap: 8px; align-items: center; }
.route-select { width: auto; min-width: 150px; }
.route-follow { font-size: 12px; color: var(--color-text-muted); padding: 6px 12px; background: rgba(255,255,255,0.7); border-radius: var(--radius-pill); }

/* 一键备份 */
.backup-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px dashed rgba(255,192,213,0.5); }
.data-btn.backup { background: linear-gradient(135deg, rgba(255,153,72,0.12), rgba(255,107,157,0.12)); color: #FF9948; border: 1px solid rgba(255,153,72,0.35); }
.data-btn.backup:hover:not(:disabled) { background: linear-gradient(135deg, rgba(255,153,72,0.2), rgba(255,107,157,0.2)); transform: translateY(-1px); }
.backup-info { font-size: 12px; color: var(--color-text-secondary); }
.backup-warn { color: #FF9948; font-weight: 600; }

/* 连通性测试 */
.test-btn { height: 38px; padding: 0 20px; background: rgba(66,146,245,0.1); color: #4292F5; border: 1px solid rgba(66,146,245,0.3); border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.test-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.test-btn:hover:not(:disabled) { background: rgba(66,146,245,0.15); }
.test-result { margin-left: 12px; font-size: 13px; font-weight: 600; }
.test-result.success { color: #26D0A8; }
.test-result.error { color: #e74c3c; }
.model-toggle-btn { margin-left: 8px; font-size: 12px; font-weight: 600; color: #4292F5; background: none; border: 1px solid rgba(66,146,245,0.3); border-radius: 6px; padding: 2px 8px; cursor: pointer; }

.guide-list { display: flex; flex-direction: column; gap: 16px; }
.guide-item { display: flex; gap: 14px; }
.guide-num { width: 28px; height: 28px; border-radius: 50%; background: var(--gradient-pink-purple); color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.guide-body { display: flex; flex-direction: column; gap: 2px; }
.guide-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.guide-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }

.data-stats { display: flex; gap: 16px; margin-bottom: 20px; }
.data-stat-item { flex: 1; display: flex; flex-direction: column; gap: 4px; padding: 16px; background: var(--color-bg-soft); border-radius: 10px; }
.data-stat-label { font-size: 12px; color: var(--color-text-muted); }
.data-stat-value { font-size: 24px; font-weight: 700; color: var(--color-text); }

.data-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.data-btn { height: 38px; padding: 0 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--color-border); transition: all 0.15s; }
.data-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.data-btn.export { background: rgba(66,146,245,0.1); color: #4292F5; border-color: rgba(66,146,245,0.3); }
.data-btn.export:hover:not(:disabled) { background: rgba(66,146,245,0.15); }
.data-btn.import { background: rgba(38,208,168,0.1); color: #26D0A8; border-color: rgba(38,208,168,0.3); }
.data-btn.import:hover:not(:disabled) { background: rgba(38,208,168,0.15); }
.data-btn.danger { background: rgba(231,76,60,0.08); color: #e74c3c; border-color: rgba(231,76,60,0.2); }
.data-btn.danger:hover:not(:disabled) { background: rgba(231,76,60,0.12); }

.data-msg { margin-top: 12px; font-size: 13px; font-weight: 600; }
.data-msg.success { color: #26D0A8; }
.data-msg.error { color: #e74c3c; }
</style>
