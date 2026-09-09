<template>
  <div class="settings-page">
    <div class="glow-orb glow-gold" style="width: 400px; height: 400px; top: 60px; left: -60px;"></div>

    <div class="content-layer">
      <div class="settings-container">
        <header class="page-head">
          <h2 class="page-title">设置</h2>
          <p class="page-sub">翁法罗斯 · 秩序配置</p>
        </header>

        <!-- 关于本项目（入口 → /about 独立介绍页） -->
        <button type="button" class="settings-section about-entry" @click="goAbout">
          <div class="about-entry-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="#E8C66A" stroke-width="1.4"/>
              <g fill="none" stroke="#F5D472" stroke-width="1" opacity=".85">
                <ellipse cx="12" cy="12" rx="7.4" ry="3" transform="rotate(-24 12 12)"/>
                <ellipse cx="12" cy="12" rx="7.4" ry="3" transform="rotate(42 12 12)"/>
                <ellipse cx="12" cy="12" rx="7.4" ry="3" transform="rotate(108 12 12)"/>
              </g>
              <circle cx="12" cy="12" r="2.4" fill="#FFF5D6"/>
            </svg>
          </div>
          <span class="about-entry-text">
            <span class="about-entry-title">关于本项目 · 笔记星图</span>
            <span class="about-entry-desc">项目介绍 / 特性与隐私 / 作者（星萌Y小郭酱）</span>
          </span>
          <span class="about-entry-arrow" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </button>

        <!-- 自动更新 -->
        <div class="settings-section" v-if="isElectron">
          <div class="section-header">
            <h3 class="section-title">自动更新</h3>
            <p class="section-desc">检查并安装新版本，保持工具最新</p>
          </div>
          <div class="update-body">
            <div class="update-info-row">
              <span class="update-label">当前版本</span>
              <span class="update-value">v{{ appVersion || '1.0.0' }}</span>
            </div>
            <div class="update-info-row" v-if="updateStatus.version">
              <span class="update-label">最新版本</span>
              <span class="update-value update-new">v{{ updateStatus.version }}</span>
            </div>
            <div class="update-progress" v-if="updateStatus.isChecking">
              <span class="update-spinner"></span>
              <span>正在检查更新…</span>
            </div>
            <div class="update-progress" v-if="updateStatus.downloadProgress > 0 && updateStatus.downloadProgress < 100">
              <span class="update-spinner"></span>
              <span>下载中 {{ updateStatus.downloadProgress }}%</span>
              <div class="update-bar-wrap">
                <div class="update-bar-fill" :style="{ width: updateStatus.downloadProgress + '%' }"></div>
              </div>
            </div>
            <div class="update-actions">
              <button
                type="button"
                class="update-btn"
                :disabled="updateStatus.isChecking || updateStatus.downloadProgress > 0"
                @click="checkUpdate"
              >
                {{ updateStatus.isChecking ? '检查中…' : '检查更新' }}
              </button>
              <button
                v-if="updateStatus.updateAvailable && !updateStatus.updateDownloaded"
                type="button"
                class="update-btn update-btn-dl"
                @click="downloadUpdate"
              >
                下载更新
              </button>
              <button
                v-if="updateStatus.updateDownloaded"
                type="button"
                class="update-btn update-btn-install"
                @click="installUpdate"
              >
                立即重启安装
              </button>
            </div>
            <p v-if="updateStatus.updateAvailable && updateStatus.releaseNotes" class="update-notes">
              更新说明：{{ updateStatus.releaseNotes }}
            </p>
          </div>
        </div>

        <!-- 个人资料（昵称 + 头像） -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">个人资料</h3>
            <p class="section-desc">设置侧栏显示的名字与头像（星穹铁道 · 开拓者风格）</p>
          </div>
          <div class="profile-row">
            <div class="profile-avatar-wrap">
              <img v-if="profileAvatarUrl" :src="profileAvatarUrl" alt="头像预览" class="profile-avatar-img" />
              <span v-else class="profile-avatar-fallback">{{ profileName.charAt(0) }}</span>
            </div>
            <div class="profile-fields">
              <div class="profile-field">
                <label class="form-label">昵称</label>
                <input
                  v-model="profileNameInput"
                  type="text"
                  class="form-input"
                  maxlength="12"
                  placeholder="开拓者"
                  @change="onProfileNameChange"
                />
              </div>
              <div class="profile-actions">
                <button type="button" class="data-btn ghost" @click="pickProfileAvatar" :disabled="profileBusy">
                  {{ profileBusy ? '处理中…' : (settings.userProfile?.avatar ? '更换头像' : '上传头像') }}
                </button>
                <button
                  v-if="settings.userProfile?.avatar"
                  type="button" class="data-btn danger"
                  @click="removeProfileAvatar"
                >移除头像</button>
                <span v-if="profileSaved" class="profile-saved">✓ 已保存</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 翁法罗斯皮肤选择器 -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">翁法罗斯皮肤</h3>
            <p class="section-desc">从「星穹铁道·翁法罗斯」汲取的紫夜鎏金基底：调节沉浸装饰层</p>
          </div>
          <SkinSelector />

          <!-- 卡片背景图 -->
          <div class="card-bg-block">
            <div class="card-bg-head">
              <div class="card-bg-title">卡片背景系统</div>
              <div class="card-bg-sub">按区域给卡片换背景：内置预设 或 本地上传，各区域独立设置 · 遮罩强度可调</div>
            </div>

            <!-- 区域 Tab -->
            <div class="card-bg-tabs">
              <button
                v-for="g in cardBgGroups"
                :key="g.key"
                type="button"
                class="card-bg-tab"
                :class="{ active: cardBgActiveGroup === g.key }"
                @click="cardBgActiveGroup = g.key"
              >
                {{ g.label }}
                <span v-if="cardBgGroupHasBg(g.key)" class="card-bg-dot" aria-hidden="true"></span>
              </button>
            </div>

            <!-- 生效预览 -->
            <div class="card-bg-live">
              <span class="card-bg-live-label">当前预览</span>
              <div
                class="card-bg-preview-box"
                :class="{ empty: !cardBgActiveRef }"
                :style="cardBgActiveCss"
              >
                <template v-if="cardBgActiveRef">
                  <img v-if="!isPresetRef(cardBgActiveRef)" :src="cardBgActiveImg" alt="卡片背景预览" />
                  <span v-else class="card-bg-preset-name">{{ cardBgActivePresetName }}</span>
                </template>
                <span v-else class="card-bg-empty-text">未设置 · 使用默认渐变底</span>
              </div>
              <p class="card-bg-live-sub">
                应用于：{{ cardBgGroups.find(g => g.key === cardBgActiveGroup)?.desc }}
              </p>
            </div>

            <!-- 内置预设选择 -->
            <div class="card-bg-section-label">内置预设</div>
            <div class="card-bg-presets">
              <button
                v-for="p in CARD_BG_PRESETS"
                :key="p.id"
                type="button"
                class="card-bg-preset"
                :class="{ active: cardBgActiveRef === p.id }"
                :style="{ background: p.css }"
                :title="p.name"
                @click="applyPresetToActive(p.id)"
              >
                <span class="card-bg-preset-name-mini">{{ p.name }}</span>
              </button>
            </div>

            <!-- 上传 / 移除 -->
            <div class="card-bg-actions">
              <button type="button" class="data-btn ghost" @click="pickCardBackground" :disabled="pickingCardBg">
                {{ pickingCardBg ? '处理中…' : (cardBgActiveRef ? '更换为本地图片' : '上传本地图片') }}
              </button>
              <button
                v-if="cardBgActiveRef"
                type="button" class="data-btn danger"
                @click="removeCardBackground"
              >移除当前区背景</button>
            </div>

            <!-- 遮罩强度 -->
            <div class="card-bg-veil">
              <label class="card-bg-veil-label">遮罩强度</label>
              <input
                type="range" min="30" max="85" :value="cardBgVeilPct"
                class="card-bg-veil-slider"
                @input="onVeilChange"
              />
              <span class="card-bg-veil-val">{{ cardBgVeilPct }}%</span>
            </div>

            <p v-if="cardBgError" class="form-hint" style="color:#F8B4B4;">{{ cardBgError }}</p>
          </div>
        </div>

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
            <select v-if="useFetchedModels && fetchedModels.length > 0" v-model="modelInput" class="form-input" @change="onModelPick">
              <option v-for="model in fetchedModels" :key="model" :value="model">{{ model }}</option>
            </select>
            <!-- 预设模型列表 -->
            <select v-else v-model="modelInput" class="form-input" @change="onModelPick">
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
                <input type="checkbox" v-model="routingUI[routeKey].enabled" @change="saveRoutingNow" />
                <span class="route-name">{{ routeLabel(routeKey) }}</span>
              </label>
              <span class="route-desc">{{ routeDesc(routeKey) }}</span>
            </div>
            <div v-if="routingUI[routeKey].enabled" class="route-config">
              <select v-model="routingUI[routeKey].provider" class="form-input route-select" @change="onRouteProviderChange(routeKey)">
                <option v-for="p in platforms" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <select v-model="routingUI[routeKey].model" class="form-input route-select" @change="saveRoutingNow">
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

        <!-- 跟拍与录屏 -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">🎥 跟拍与录屏</h3>
            <p class="section-desc">视频帧智能笔记 + 复习录屏（本地 Ollama 视觉识别，图片不出电脑）</p>
          </div>
          <div class="setting-row">
            <label class="setting-label">本地视觉模型</label>
            <select v-model="followVisionModel" class="setting-input select" @change="saveFollowConfig">
              <option value="moondream">moondream（1.4GB 低配推荐）</option>
              <option value="minicpm-v">minicpm-v（2.7GB 中文友好）</option>
              <option value="llama3.2-vision">llama3.2-vision（更强）</option>
            </select>
            <button class="data-btn ghost" @click="pullVisionModel" :disabled="pullingModel">
              {{ pullingModel ? '下载中…' : '⬇ 下载模型' }}
            </button>
            <span v-if="visionModels.includes(followVisionModel)" class="model-installed">✓ 已安装</span>
          </div>
          <div class="setting-row">
            <label class="setting-label">记忆截图窗口</label>
            <span class="setting-value" v-if="settings.rememberedCapture?.sourceName">
              {{ settings.rememberedCapture.sourceName }}
            </span>
            <span class="setting-value" v-else style="color:var(--color-text-tertiary)">（未设置，下次截前会让你选）</span>
            <button class="data-btn ghost" @click="clearRememberedCapture" :disabled="!settings.rememberedCapture?.sourceId">清除记忆</button>
          </div>
          <!-- Day 3 P1-V4：录屏占用告警阈值 + N 天前清理（Dashboard 超阈值 banner 跳这里） -->
          <div id="rec-cleanup">
            <div class="setting-row">
              <label class="setting-label">占用告警阈值</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="number" min="0.2" max="200" step="0.1" v-model.number="recStorageWarnGB"
                  @change="saveRecConfig" class="setting-input" style="width:90px;" />
                <span class="setting-value">GB（超过后自动提醒清理）</span>
              </div>
            </div>
            <div class="setting-row">
              <label class="setting-label">清理旧录屏</label>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="setting-value">删除</span>
                <input type="number" min="1" max="3650" step="1" v-model.number="recCleanupDays"
                  @change="saveRecConfig" class="setting-input" style="width:80px;" />
                <span class="setting-value">天前的录屏</span>
                <button class="data-btn ghost" @click="cleanupOldRecordings" :disabled="cleaningRecs">
                  {{ cleaningRecs ? '清理中…' : '一键清理' }}
                </button>
              </div>
            </div>
          </div>
          <!-- Day 4 4.2 重构：录屏会话卡片列表（缩略图 + 时长 + MB + 单条删按钮） -->
          <div class="rec-session-block">
            <div class="rec-session-head">
              <span class="rec-session-count">🎥 {{ recSessions.length }} 个会话</span>
              <button class="data-btn ghost" @click="loadRecSessions" :disabled="!recSessions.length">🔄 刷新列表</button>
            </div>
            <div class="rec-session-list">
              <div v-for="s in recSessions" :key="s.sessionId" class="rs-session">
                <div class="rs-card-btn">
                  <img v-if="s.thumb" class="rs-thumb" :src="s.thumb" alt="会话缩略图">
                  <div v-else class="rs-thumb rs-thumb-placeholder">🎬</div>
                  <div class="rs-body">
                    <span class="rs-title">{{ s.title || s.sessionId }}</span>
                    <span class="rs-meta">{{ fmtDur(s.durationSec) }} · {{ (s.segments && s.segments.length) || 0 }} 段</span>
                    <span class="rs-meta">{{ fmtBytes(s.bytes || 0) }} · {{ s.orphan ? '⚠孤儿恢复' : (s.noteId ? '已关联笔记' : '未关联笔记') }}</span>
                  </div>
                </div>
                <button class="rs-del-btn" @click="deleteRecSession(s)" :title="`删除会话 ${s.title || s.sessionId}`" aria-label="删除会话">🗑</button>
              </div>
              <div v-if="!recSessions.length" class="rec-list-empty">暂无录屏会话</div>
            </div>
          </div>
          <div class="data-actions">
            <div class="rec-usage">
              录屏占用：<b>{{ recUsageText }}</b>（{{ recUsage.sessions }} 个会话）
            </div>
            <button class="data-btn ghost" @click="openRecordingsDir">📂 打开录屏目录</button>
            <button class="data-btn danger" @click="deleteAllRecordings" :disabled="!recUsage.sessions">🗑 清空全部录屏</button>
          </div>
          <p class="data-msg" :class="{ success: followMsgType === 'success', error: followMsgType === 'error' }" v-if="followMsg">{{ followMsg }}</p>
        </div>

        <!-- 知识网络（embedding 跨课程检索） -->
        <div class="settings-section">
          <div class="section-header">
            <h3 class="section-title">🕸️ 知识网络</h3>
            <p class="section-desc">本地 nomic-embed-text 把每条笔记转成向量，AI 问答时自动召回跨课程相关笔记</p>
          </div>
          <div class="setting-row">
            <label class="setting-label">嵌入模型</label>
            <span class="setting-value">{{ embedInfo.model || 'nomic-embed-text' }}（{{ embedInfo.dim || 768 }} 维）</span>
          </div>
          <div class="setting-row">
            <label class="setting-label">索引进度</label>
            <span class="setting-value">
              <b>{{ embedInfo.count }}</b> / {{ notes.length }} 篇笔记已索引
              <span v-if="embedInfo.count < notes.length" class="model-installed" style="background: var(--color-bg-soft); color: var(--color-text-secondary);">缺 {{ notes.length - embedInfo.count }} 篇</span>
              <span v-else class="model-installed">✓ 已全部索引</span>
            </span>
          </div>
          <div class="data-actions">
            <button class="data-btn primary" @click="rebuildEmbeddings" :disabled="embBusy">🔄 重建全部 embedding</button>
            <button class="data-btn ghost" @click="loadEmbedInfo">🔃 刷新状态</button>
          </div>
          <p class="data-msg" :class="{ success: embedMsgType === 'success', error: embedMsgType === 'error' }" v-if="embedMsg">{{ embedMsg }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { settings, saveSettings, notes, courses, chatSessions, exportData, importData, clearData, isDataLoaded, isElectron, backupData, getBackupInfo, setCardBackground, clearCardBackground, applyCardBgPreset, setCardBgVeil, resolveImageUrl, resolveCardBgRef, normalizeCardBackgrounds, isPresetRef, CARD_BG_PRESETS, CARD_BG_DEFAULT_VEIL, DEFAULT_USER_NAME, setUserName, setUserAvatar, clearUserAvatar } from '../store'
import { AI_PLATFORMS } from '../types'
import type { AIProvider } from '../types'
import { showConfirm, showAlert, showToast } from '../composables/useDialog'
import SkinSelector from '../themes/SkinSelector.vue'

const router = useRouter()

// 关于页入口
const goAbout = () => { router.push('/about') }

// ── 自动更新 ──
const appVersion = ref('')
const updateStatus = ref({
  isChecking: false,
  updateAvailable: false,
  updateDownloaded: false,
  version: '',
  releaseNotes: '',
  downloadProgress: 0,
})

let unsubUpdateStatus: (() => void) | null = null

const checkUpdate = async () => {
  try {
    await window.noteAPI.updateCheck()
  } catch (_) { /* ignore */ }
}

const downloadUpdate = async () => {
  try {
    await window.noteAPI.updateDownload()
  } catch (_) { /* ignore */ }
}

const installUpdate = async () => {
  try {
    await window.noteAPI.updateInstall()
  } catch (_) { /* ignore */ }
}

if (isElectron) {
  // 监听更新状态
  unsubUpdateStatus = window.noteAPI.onUpdateStatus((status: any) => {
    updateStatus.value = { ...updateStatus.value, ...status }
  })
  // 获取当前版本号
  if (window.noteAPI.getAppVersion) {
    window.noteAPI.getAppVersion().then((info: any) => {
      if (info && info.version) appVersion.value = info.version
    }).catch(() => {})
  }
}

onUnmounted(() => {
  if (unsubUpdateStatus) unsubUpdateStatus()
})

const platforms = AI_PLATFORMS
const selectedProvider = ref<AIProvider>('deepseek')
const apiKeyInput = ref('')
const modelInput = ref('deepseek-chat')
const saving = ref(false)
const saveSuccess = ref(false)
const dataBusy = ref<false | 'export' | 'import' | 'clear' | 'backup'>(false)

// ===== 个人资料（昵称 + 头像）=====
const profileNameInput = ref(settings.value.userProfile?.name || DEFAULT_USER_NAME)
const profileBusy = ref(false)
const profileSaved = ref(false)
const profileName = computed(() => settings.value.userProfile?.name?.trim() || DEFAULT_USER_NAME)
const profileAvatarUrl = computed(() => {
  const ref = settings.value.userProfile?.avatar
  return ref ? resolveImageUrl(ref) : ''
})
const onProfileNameChange = async () => {
  try {
    await setUserName(profileNameInput.value)
    profileSaved.value = true
    setTimeout(() => { profileSaved.value = false }, 1800)
  } catch (e: any) { showAlert('昵称保存失败', e?.message || String(e)) }
}
const pickProfileAvatar = async () => {
  if (profileBusy.value) return
  profileBusy.value = true
  try {
    const r = await setUserAvatar()
    if (r.ok) {
      profileSaved.value = true
      setTimeout(() => { profileSaved.value = false }, 1800)
    } else if (r.error !== 'cancelled') {
      showAlert('头像上传失败', r.error || '')
    }
  } catch (e: any) { showAlert('头像上传失败', e?.message || String(e)) }
  finally { profileBusy.value = false }
}
const removeProfileAvatar = async () => {
  try {
    await clearUserAvatar()
    profileSaved.value = true
    setTimeout(() => { profileSaved.value = false }, 1800)
  } catch (e: any) { showAlert('移除失败', e?.message || String(e)) }
}

// 回填指定平台的 key（每平台独立存储）
// ⚠️ 绝不拿 settings.value.apiKey 顶替（那是"当前激活 provider"的 key）——
// 切换目标平台时若用它回退，会把上一家 key 串到新平台（401 根因）。
// 唯一例外：apiKeys 整体为空（老数据尚未迁移）且目标正是当前 provider 时，回退 apiKey。
const keyOf = (provider: AIProvider): string =>
  settings.value.apiKeys?.[provider] || ''
const refillApiKeyInput = () => {
  const hasAnyKeys = settings.value.apiKeys && Object.keys(settings.value.apiKeys).length > 0
  if (keyOf(selectedProvider.value)) {
    apiKeyInput.value = keyOf(selectedProvider.value)
  } else if (!hasAnyKeys && selectedProvider.value === settings.value.provider) {
    apiKeyInput.value = settings.value.apiKey || '' // 老数据单 key 迁移兜底
  } else {
    apiKeyInput.value = ''
  }
}

// 跟拍与录屏
const followVisionModel = ref(localStorage.getItem('followVisionModel') || 'moondream')
const visionModels = ref<string[]>([])
const pullingModel = ref(false)
const recUsage = ref<{ sessions: number; bytes: number }>({ sessions: 0, bytes: 0 })
const followMsg = ref('')
const followMsgType = ref<'success' | 'error'>('success')
const cleaningRecs = ref(false)
// Day 3 P1-V4：录屏告警阈值 + 清理阈值天数；默认值从 settings.json 读取，没填就 2GB / 30 天
const recStorageWarnGB = ref<number>(settings.value.recStorageWarnGB && settings.value.recStorageWarnGB > 0 ? settings.value.recStorageWarnGB : 2)
const recCleanupDays = ref<number>(settings.value.recCleanupDays && settings.value.recCleanupDays > 0 ? settings.value.recCleanupDays : 30)

const recUsageText = computed(() => {
  const b = recUsage.value.bytes
  if (b >= 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(0) + ' MB'
  return (b / 1024).toFixed(0) + ' KB'
})

// ── 卡片背景系统（按区域分组：全部兜底 / 仪表盘 / 笔记）──
type CardBgGroupKey = 'all' | 'dashboard' | 'notes'
const cardBgGroups = [
  { key: 'all' as CardBgGroupKey, label: '全部卡片', desc: '设置页 / 弹窗等其余主卡片（无单独设置时仪表盘与笔记也会用这张兜底）' },
  { key: 'dashboard' as CardBgGroupKey, label: '仪表盘', desc: '仪表盘统计卡 / 图表卡（未单独设时回落「全部卡片」）' },
  { key: 'notes' as CardBgGroupKey, label: '笔记', desc: '笔记列表与笔记卡片（未单独设时回落「全部卡片」）' },
]
const cardBgActiveGroup = ref<CardBgGroupKey>('all')
const pickingCardBg = ref(false)
const cardBgError = ref('')

// 当前分组最终生效的背景引用（含回落 all）
const cardBgActiveRef = computed(() => {
  const g = cardBgActiveGroup.value
  const ref = resolveCardBgRef(settings.value, g)
  return ref
})
// 当前分组自己的设置（不含回落，用于判断"是否单独设过"）
const cardBgGroupSelfRef = computed(() => {
  const c = normalizeCardBackgrounds(settings.value)
  return c[cardBgActiveGroup.value] || ''
})
const cardBgGroupHasBg = (k: string) => {
  const c = normalizeCardBackgrounds(settings.value)
  return !!((c as any)[k])
}
// 当前生效引用的图片 URL（仅本地图片；预设返回空走 CSS 预览）
const cardBgActiveImg = computed(() => {
  const ref = cardBgActiveRef.value
  if (!ref || isPresetRef(ref)) return ''
  return resolveImageUrl(ref)
})
const cardBgActiveCss = computed(() => {
  const ref = cardBgActiveRef.value
  if (!ref) return {}
  if (isPresetRef(ref)) {
    const p = CARD_BG_PRESETS.find(x => x.id === ref)
    return { background: p ? p.css : 'none' }
  }
  const u = resolveImageUrl(ref)
  return { backgroundImage: `linear-gradient(165deg, rgba(16,10,36,0.45), rgba(26,17,64,0.35)), url("${u}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
})
const cardBgActivePresetName = computed(() => {
  const ref = cardBgActiveRef.value
  if (!ref || !isPresetRef(ref)) return ''
  return CARD_BG_PRESETS.find(x => x.id === ref)?.name || ''
})
// 遮罩强度（0.3~0.85 → 30~85%）
const cardBgVeilPct = computed(() => {
  const c = normalizeCardBackgrounds(settings.value)
  return Math.round((typeof c.veil === 'number' ? c.veil : CARD_BG_DEFAULT_VEIL) * 100)
})
const onVeilChange = async (e: Event) => {
  const v = Number((e.target as HTMLInputElement).value) / 100
  await setCardBgVeil(v)
  showToast(`✓ 遮罩强度 ${Math.round(v * 100)}%`, 'success')
}
const applyPresetToActive = async (presetId: string) => {
  try {
    await applyCardBgPreset(cardBgActiveGroup.value, presetId)
    showToast('✓ 已应用预设', 'success')
  } catch (e: any) {
    cardBgError.value = e?.message || String(e)
  }
}
const pickCardBackground = async () => {
  if (pickingCardBg.value) return
  pickingCardBg.value = true
  cardBgError.value = ''
  try {
    const r = await setCardBackground(cardBgActiveGroup.value)
    if (r.ok) {
      showToast('✓ 卡片背景已更新', 'success')
    } else if (r.error === 'cancelled') {
      // 用户取消，静默
    } else {
      cardBgError.value = r.error || '选择图片失败'
    }
  } catch (e: any) {
    cardBgError.value = e?.message || String(e)
  } finally {
    pickingCardBg.value = false
  }
}
const removeCardBackground = async () => {
  try {
    await clearCardBackground(cardBgActiveGroup.value)
    showToast('✓ 已移除该区域背景', 'success')
  } catch (e: any) {
    cardBgError.value = e?.message || String(e)
  }
}
const saveFollowConfig = () => {
  localStorage.setItem('followVisionModel', followVisionModel.value)
}
// Day 3 P1-V4：持久化录屏配置到 settings.json（跨启动保留阈值）
const saveRecConfig = async () => {
  try {
    const gb = Math.max(0.2, Math.min(200, Number(recStorageWarnGB.value) || 2))
    const days = Math.max(1, Math.min(3650, Math.round(Number(recCleanupDays.value) || 30)))
    recStorageWarnGB.value = gb
    recCleanupDays.value = days
    await saveSettings({ ...settings.value, recStorageWarnGB: gb, recCleanupDays: days })
    showToast('✓ 录屏配置已保存', 'success')
  } catch (e: any) {
    showAlert('保存失败', e?.message || String(e))
  }
}
// Day 3 P1-V4：一键清理 N 天前的录屏（主进程按 meta.createdAt 对比）
const cleanupOldRecordings = async () => {
  if (cleaningRecs.value) return
  const days = Math.max(1, Math.min(3650, Math.round(Number(recCleanupDays.value) || 30)))
  const ok = await showConfirm({
    title: `清理 ${days} 天前的录屏`,
    message: `将删除创建时间早于 ${days} 天前的全部录屏会话（正在进行的会话不会被删）。\n\n删除后无法恢复，确定继续？`,
    danger: true,
  })
  if (!ok) return
  cleaningRecs.value = true
  followMsg.value = ''
  try {
    const api = window.noteAPI
    const r = (api.recCleanupBefore ? await api.recCleanupBefore(days) : null) || { removed: 0, bytes: 0 }
    await loadFollowInfo()
    const mb = ((r.bytes || 0) / 1024 / 1024).toFixed(1)
    followMsg.value = `✓ 已清理 ${r.removed || 0} 个会话，释放 ${mb} MB`
    followMsgType.value = 'success'
  } catch (e: any) {
    followMsg.value = '✕ 清理失败：' + String(e?.message || e)
    followMsgType.value = 'error'
  } finally {
    cleaningRecs.value = false
  }
}
const loadFollowInfo = async () => {
  try {
    const api = window.noteAPI
    if (api.followListVisionModels) {
      const r = await api.followListVisionModels()
      visionModels.value = r.vision || []
    }
    if (api.recGetUsage) recUsage.value = await api.recGetUsage()
  } catch (e) { /* ignore */ }
}

// 录屏管理卡片列表（listSessions 带 bytes/segCount/thumb；单条删走四字确认）
const recSessions = ref<any[]>([])
const fmtBytes = (b: number) => {
  const n = Number(b || 0)
  if (n <= 0) return '0B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)}${units[i]}`
}
const fmtDur = (sec: number) => {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`
}
const loadRecSessions = async () => {
  try {
    const api = window.noteAPI
    recSessions.value = (api.recListSessions ? await api.recListSessions() : []) || []
  } catch (e) { recSessions.value = [] }
}
const deleteRecSession = async (s: any) => {
  const userText = (window.prompt(`请输入 "删除录屏" 四个字确认删除：\n（${s.title || s.sessionId}）\n输入错误或取消 = 不删除`) || '').trim()
  if (userText !== '删除录屏') {
    if (userText) showToast('输入不一致，已取消', 'warn')
    return
  }
  try {
    await window.noteAPI.recDeleteSession(s.sessionId)
    showToast('✓ 已删除录屏', 'success')
    recSessions.value = recSessions.value.filter(x => x.sessionId !== s.sessionId)
    followMsg.value = ''
    await loadFollowInfo() // 同步刷新占用统计
  } catch (e: any) {
    showAlert('删除失败', e?.message || String(e))
  }
}

// 知识网络（embedding）
const embedInfo = ref<{ ok: boolean; model: string; dim: number; count: number }>({ ok: false, model: 'nomic-embed-text', dim: 768, count: 0 })
const embBusy = ref(false)
const embedMsg = ref('')
const embedMsgType = ref<'success' | 'error'>('success')
const loadEmbedInfo = async () => {
  try {
    const api = window.noteAPI
    if (api.embedStatus) embedInfo.value = await api.embedStatus()
  } catch (e) { /* ignore */ }
}
const rebuildEmbeddings = async () => {
  if (embBusy.value) return
  embBusy.value = true
  embedMsg.value = ''
  try {
    const api = window.noteAPI
    if (!api.batchEmbed) throw new Error('embedding 不可用')
    embedMsg.value = '🔄 重建中…请稍候（本地 Ollama 推理，可能要 1-3 分钟）'
    embedMsgType.value = 'success'
    const r = await api.batchEmbed({ concurrency: 1 })
    if (r && r.ok) {
      embedMsg.value = `✓ 重建完成：共 ${r.total} 条 → 新增 ${r.ok}、跳过 ${r.skip}、失败 ${r.fail}`
      embedMsgType.value = r.fail > 0 ? 'error' : 'success'
    } else {
      embedMsg.value = '✕ 重建失败：' + (r && r.error || '未知错误')
      embedMsgType.value = 'error'
    }
    await loadEmbedInfo()
  } catch (e: any) {
    embedMsg.value = '✕ 重建失败：' + (e?.message || e)
    embedMsgType.value = 'error'
  } finally {
    embBusy.value = false
  }
}
const pullVisionModel = async () => {
  pullingModel.value = true
  followMsg.value = ''
  try {
    const ok = await window.noteAPI.pullOllamaModel(followVisionModel.value)
    followMsg.value = ok ? `✓ ${followVisionModel.value} 下载完成` : '✕ 下载失败，请查看日志'
    followMsgType.value = ok ? 'success' : 'error'
    await loadFollowInfo()
  } catch (e) {
    followMsg.value = '✕ 下载失败：' + String((e as any)?.message || e)
    followMsgType.value = 'error'
  } finally {
    pullingModel.value = false
  }
}
const openRecordingsDir = async () => {
  try { await window.noteAPI.recOpenDir() } catch (e) { /* ignore */ }
}
const deleteAllRecordings = async () => {
  // P1-6 修复：两次确认 + 必须输入"清空录屏"四个字才执行，避免手滑误删
  if (!recUsage.value.sessions) return
  const ok = await showConfirm({
    title: '确认清空录屏',
    message: `将删除全部 ${recUsage.value.sessions} 个录屏会话（${recUsageText.value}）。\n\n删除后无法恢复，确定继续？`,
    danger: true,
    confirmText: '下一步（输入确认）',
  })
  if (!ok) return
  const userText = (window.prompt(`请输入 "清空录屏" 四个字来确认删除：\n（输入错误或取消 = 不删除）`) || '').trim()
  if (userText !== '清空录屏') {
    showToast(userText ? '输入不一致，已取消' : '已取消', 'warn')
    return
  }
  const done = await window.noteAPI.recDeleteAll()
  if (done) {
    recUsage.value = { sessions: 0, bytes: 0 }
    recSessions.value = []
    followMsg.value = '✓ 录屏已清空'
    followMsgType.value = 'success'
  }
}
const clearRememberedCapture = async () => {
  try {
    // 双写清空：settings.json + localStorage
    await saveSettings({ ...settings.value, rememberedCapture: null })
    localStorage.removeItem('notestar-capture-source')
    showToast('已清除截图窗口记忆，下次截图会重新让你选择', 'success')
  } catch (e: any) {
    showAlert('清除失败', e?.message || String(e))
  }
}
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
// ⚠️ 注意：watch 必须在 applyRoutingToUI 函数声明之后才能使用 { immediate: true }，
// 否则会抛 ReferenceError: Cannot access 'applyRoutingToUI' before initialization
// → 改为先在 setup 末尾追加一次 safe 回填，immediate 延迟到函数声明后注册。

onMounted(() => {
  selectedProvider.value = settings.value.provider || 'deepseek'
  refillApiKeyInput()
  modelInput.value = settings.value.model || currentPlatform.value.defaultModel
  applyRoutingToUI()
  loadBackupInfo()
  loadFollowInfo()
  loadEmbedInfo()
  loadRecSessions()
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
  if (selectedProvider.value === provider) return
  selectedProvider.value = provider
  const platform = AI_PLATFORMS.find(p => p.id === provider)!
  modelInput.value = platform.defaultModel
  // 切换平台时清空之前获取的模型列表；回填该平台已保存的 key（每平台独立）
  refillApiKeyInput()
  fetchedModels.value = []
  useFetchedModels.value = false
  testResult.value = null
  // ⚠️ 同步问题修复：平台/模型选择即持久化（不再依赖手动点"保存配置"）。
  // 否则用户切完直接离开，回来/重启后仍是旧服务商。
  // 只持久化 provider + model + 已有 apiKeys，不覆盖任何平台的 key（key 由"保存配置"写入）
  const nextKeys = { ...(settings.value.apiKeys || {}) }
  saveSettings({
    ...settings.value,
    apiKeys: nextKeys,
    apiKey: nextKeys[provider] || '',
    model: platform.defaultModel,
    provider,
    modelRouting: settings.value.modelRouting,
  }).catch((e: any) => showAlert('切换平台保存失败', e?.message || String(e)))
  showToast(`已切换至 ${platform.name}，模型已设为 ${platform.defaultModel}`, 'success')
}

// 模型下拉手动切换也即时保存（同样避免"改了不生效"）
const onModelPick = () => {
  if (!selectedProvider.value) return
  const nextKeys = { ...(settings.value.apiKeys || {}) }
  saveSettings({
    ...settings.value,
    apiKeys: nextKeys,
    apiKey: nextKeys[selectedProvider.value] || '',
    model: modelInput.value,
    provider: selectedProvider.value,
    modelRouting: settings.value.modelRouting,
  }).catch((e: any) => showAlert('模型保存失败', e?.message || String(e)))
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
  saveRoutingNow()
}
// 模型路由任一改动即时保存（避免切了不生效）
const saveRoutingNow = () => {
  const nextKeys = { ...(settings.value.apiKeys || {}) }
  saveSettings({
    ...settings.value,
    apiKeys: nextKeys,
    apiKey: nextKeys[selectedProvider.value] || settings.value.apiKey || '',
    model: modelInput.value || settings.value.model || 'deepseek-chat',
    provider: selectedProvider.value,
    modelRouting: collectRouting(),
  }).catch((e: any) => showAlert('路由保存失败', e?.message || String(e)))
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

// ✅ 注册时机：必须在 applyRoutingToUI 函数声明之后，避免 immediate 触发时 ReferenceError
watch(isDataLoaded, (loaded) => {
  if (loaded) {
    selectedProvider.value = settings.value.provider || 'deepseek'
    refillApiKeyInput()
    modelInput.value = settings.value.model || currentPlatform.value.defaultModel
    applyRoutingToUI()
  }
}, { immediate: true })

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
        model: modelInput.value.trim() || undefined,
      })
      testResult.value = { success: result.success, message: result.message }
      if (result.success && result.models && result.models.length > 0) {
        fetchedModels.value = result.models
        useFetchedModels.value = true
        showToast(`获取到 ${result.models.length} 个可用模型`, 'success')
      }
    } else {
      // 浏览器模式：直接 fetch（目录 + 尽力对话探测，CORS 受限时标注）
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
        // 尽力对话探测（真实反映"能不能出题"）
        const probeModel = modelInput.value.trim() || models[0] || platform.defaultModel
        try {
          const chatRes = await fetch(baseUrl, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: probeModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, temperature: 0 }),
          })
          if (chatRes.ok) {
            testResult.value = { success: true, message: `连接正常！共 ${models.length} 个可用模型，对话接口实测可用（${probeModel}）✅` }
          } else {
            const errBody = await chatRes.text().catch(() => '')
            testResult.value = { success: false, message: `⚠️ 目录可达（${models.length} 个模型）但对话接口不可用：HTTP ${chatRes.status} — ${errBody.substring(0, 100)}。出题/问答仍会失败` }
            return
          }
        } catch {
          testResult.value = { success: true, message: `连接成功！共 ${models.length} 个可用模型（浏览器预览：对话验证受 CORS 限制，以应用内实测为准）` }
        }
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
    // 输入框为空时保留本平台已存 key（防误清）；绝不拿别的平台 apiKey 顶替
    const nextApiKey = apiKeyInput.value.trim() || settings.value.apiKeys?.[selectedProvider.value] || ''
    // ⚠️ 每平台独立 key：写入 apiKeys[当前平台]，apiKey 同步为当前平台 key
    const nextKeys = { ...(settings.value.apiKeys || {}) }
    nextKeys[selectedProvider.value] = nextApiKey
    // ⚠️ 必须展开 settings.value 保留其它字段（cardBackgrounds / recCleanupDays /
    //    rememberedCapture 等），否则覆盖式保存会把它们全部清掉
    await saveSettings({
      ...settings.value,
      apiKeys: nextKeys,
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
/* ==============================================================
   翁法罗斯 · 设置页（深紫鎏金 · 实底 · 不用毛玻璃）
   ============================================================== */
.settings-page { width: 100%; height: 100%; position: relative; overflow: hidden; background: var(--color-bg); }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; overflow-y: auto; }

.settings-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 28px 64px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* 页头：鎏金古卷风 */
.page-head { position: relative; padding: 0 0 4px 16px; }
.page-title {
  font-size: 26px; font-weight: 700;
  color: var(--om-gold);
  letter-spacing: 2px;
  text-shadow: 0 0 12px rgba(232,198,106,0.35);
}
.page-sub {
  margin-top: 6px;
  font-size: 12px; color: var(--om-text-mute);
  letter-spacing: 4px;
  text-transform: uppercase;
}
.page-head::before {
  content: ''; position: absolute; left: 0; top: 6px; bottom: 6px;
  width: 3px;
  background: linear-gradient(180deg, var(--om-gold) 0%, var(--om-accent) 100%);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(232,198,106,0.4);
}

/* 区块卡：鎏金回纹边框 · 实底紫黑 */
.settings-section {
  position: relative;
  background: linear-gradient(150deg, #241A4A 0%, #1A1140 100%);
  border: 1px solid rgba(232,198,106,0.32);
  border-radius: 16px;
  padding: 26px 28px;
  box-shadow: 0 6px 24px rgba(10,4,24,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
  overflow: hidden;
}
/* 四角鎏金回纹装饰点 */
.settings-section::before,
.settings-section::after {
  content: ''; position: absolute; width: 10px; height: 10px;
  border: 1.5px solid var(--om-gold);
  pointer-events: none;
}
.settings-section::before { top: 6px; left: 6px;  border-right: none; border-bottom: none; }
.settings-section::after  { bottom: 6px; right: 6px; border-left: none; border-top: none; }

.section-header { margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px dashed rgba(232,198,106,0.25); }
.section-title {
  font-size: 17px; font-weight: 700;
  color: var(--om-gold);
  letter-spacing: 2px;
  display: flex; align-items: center; gap: 10px;
}
.section-title::before {
  content: '✦'; color: var(--om-gold); font-size: 13px;
  filter: drop-shadow(0 0 6px rgba(232,198,106,0.6));
}
.section-desc { margin-top: 6px; font-size: 12px; color: var(--om-text-mute); line-height: 1.6; letter-spacing: 0.5px; }

/* 表单：紫黑深底输入框 */
.form-group { margin-bottom: 20px; }
.form-label {
  display: block; font-size: 12px; font-weight: 600;
  color: var(--om-text-sec);
  margin-bottom: 8px; letter-spacing: 1px;
}
.form-input {
  width: 100%; height: 40px; padding: 0 14px;
  background: rgba(10,4,24,0.55);
  border: 1px solid rgba(232,198,106,0.25);
  border-radius: 8px;
  font-size: 13px; color: var(--om-text-pri);
  outline: none; transition: all 0.18s;
}
.form-input::placeholder { color: var(--om-text-mute); opacity: 0.6; }
.form-input:focus { border-color: var(--om-gold); box-shadow: 0 0 0 3px rgba(232,198,106,0.18); }
.form-hint { font-size: 11px; color: var(--om-text-mute); margin-top: 6px; line-height: 1.7; }
.form-link { color: var(--om-gold); text-decoration: none; border-bottom: 1px dashed rgba(232,198,106,0.4); }
.form-link:hover { color: #F5E0B0; border-bottom-style: solid; }
.form-hint code {
  background: rgba(10,4,24,0.6); padding: 2px 6px; border-radius: 4px;
  border: 1px solid rgba(232,198,106,0.2); color: var(--om-gold);
  font-size: 11px;
}

/* 平台选择：鎏金描边网格 */
.platform-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.platform-card {
  position: relative; display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: rgba(10,4,24,0.4);
  border: 1.5px solid rgba(232,198,106,0.22);
  border-radius: 10px;
  cursor: pointer; transition: all 0.18s;
  color: var(--om-text-pri);
}
.platform-card:hover {
  border-color: var(--om-gold);
  background: rgba(232,198,106,0.08);
  transform: translateY(-1px);
}
.platform-card.active {
  border-color: var(--om-gold);
  background: linear-gradient(135deg, rgba(232,198,106,0.15), rgba(200,150,255,0.10));
  box-shadow: 0 0 0 1px var(--om-gold), 0 4px 12px rgba(232,198,106,0.18);
}
.platform-icon { font-size: 20px; }
.platform-name { font-size: 13px; font-weight: 600; color: var(--om-text-pri); flex: 1; }
.platform-check { color: var(--om-gold); font-size: 14px; font-weight: 700; text-shadow: 0 0 6px rgba(232,198,106,0.6); }

/* 主按钮：鎏金渐变 */
.save-btn {
  height: 38px; padding: 0 24px;
  background: linear-gradient(135deg, var(--om-gold) 0%, var(--om-gold-deep) 100%);
  color: #1A0F0A; border: 1px solid rgba(232,198,106,0.6);
  border-radius: 999px;
  font-size: 13px; font-weight: 700; letter-spacing: 1px;
  cursor: pointer; box-shadow: 0 4px 14px rgba(232,198,106,0.30);
  transition: all 0.18s;
}
.save-btn:disabled { opacity: 0.5; }
.save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(232,198,106,0.45); }
.save-success { margin-left: 12px; font-size: 13px; color: #7DE3C8; font-weight: 600; }

/* 功能模型路由：紫黑底卡 */
.route-row {
  display: flex; align-items: center; gap: 16px;
  padding: 12px 14px;
  background: rgba(10,4,24,0.45);
  border: 1px solid rgba(232,198,106,0.18);
  border-radius: 10px;
  margin-bottom: 10px; flex-wrap: wrap;
}
.route-info { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 2px; }
.route-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.route-toggle input { accent-color: var(--om-gold); width: 16px; height: 16px; cursor: pointer; }
.route-name { font-size: 13px; font-weight: 700; color: var(--om-text-pri); }
.route-desc { font-size: 11px; color: var(--om-text-mute); }
.route-config { display: flex; gap: 8px; align-items: center; }
.route-select { width: auto; min-width: 150px; }
.route-follow {
  font-size: 12px; color: var(--om-text-mute);
  padding: 6px 12px;
  background: rgba(10,4,24,0.5);
  border: 1px solid rgba(232,198,106,0.18);
  border-radius: 999px;
}

/* 一键备份 */
.backup-row {
  display: flex; align-items: center; gap: 12px;
  margin-top: 16px; padding-top: 16px;
  border-top: 1px dashed rgba(232,198,106,0.25);
}
.data-btn.backup {
  background: linear-gradient(135deg, rgba(232,198,106,0.14), rgba(200,150,255,0.14));
  color: var(--om-gold);
  border: 1px solid rgba(232,198,106,0.4);
}
.data-btn.backup:hover:not(:disabled) { background: linear-gradient(135deg, rgba(232,198,106,0.24), rgba(200,150,255,0.24)); transform: translateY(-1px); }
.backup-info { font-size: 12px; color: var(--om-text-sec); }
.backup-warn { color: #FFB347; font-weight: 600; }

/* 连通性测试 */
.test-btn {
  height: 36px; padding: 0 18px;
  background: rgba(108,164,255,0.12);
  color: #A8D8FF;
  border: 1px solid rgba(108,164,255,0.35);
  border-radius: 8px;
  font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.18s;
}
.test-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.test-btn:hover:not(:disabled) { background: rgba(108,164,255,0.20); }
.test-result { margin-left: 12px; font-size: 13px; font-weight: 600; }
.test-result.success { color: #7DE3C8; }
.test-result.error { color: #FF6E5A; }
.model-toggle-btn {
  margin-left: 8px; font-size: 12px; font-weight: 600;
  color: #A8D8FF; background: none;
  border: 1px solid rgba(108,164,255,0.35);
  border-radius: 6px; padding: 2px 8px;
  cursor: pointer;
}

/* 使用说明 */
.guide-list { display: flex; flex-direction: column; gap: 14px; }
.guide-item { display: flex; gap: 14px; align-items: flex-start; }
.guide-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, var(--om-gold) 0%, var(--om-gold-deep) 100%);
  color: #1A0F0A; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 10px rgba(232,198,106,0.35);
}
.guide-body { display: flex; flex-direction: column; gap: 2px; }
.guide-title { font-size: 13px; font-weight: 600; color: var(--om-text-pri); }
.guide-desc { font-size: 12px; color: var(--om-text-mute); line-height: 1.55; }

/* 数据统计 */
.data-stats { display: flex; gap: 12px; margin-bottom: 20px; }
.data-stat-item {
  flex: 1; display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px;
  background: rgba(10,4,24,0.45);
  border: 1px solid rgba(232,198,106,0.20);
  border-radius: 10px;
}
.data-stat-label { font-size: 11px; color: var(--om-text-mute); letter-spacing: 1px; }
.data-stat-value { font-size: 22px; font-weight: 700; color: var(--om-gold); text-shadow: 0 0 8px rgba(232,198,106,0.3); }

.data-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.data-btn {
  height: 36px; padding: 0 18px;
  border-radius: 8px;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(232,198,106,0.25);
  background: rgba(10,4,24,0.45);
  color: var(--om-text-pri);
  transition: all 0.18s;
}
.data-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.data-btn.export {
  background: rgba(108,164,255,0.12); color: #A8D8FF;
  border-color: rgba(108,164,255,0.35);
}
.data-btn.export:hover:not(:disabled) { background: rgba(108,164,255,0.20); }
.data-btn.import {
  background: rgba(125,227,200,0.10); color: #7DE3C8;
  border-color: rgba(125,227,200,0.35);
}
.data-btn.import:hover:not(:disabled) { background: rgba(125,227,200,0.18); }
.data-btn.danger {
  background: rgba(255,110,90,0.10); color: #FF8B7E;
  border-color: rgba(255,110,90,0.35);
}
.data-btn.danger:hover:not(:disabled) { background: rgba(255,110,90,0.18); }
.data-btn.ghost {
  background: rgba(10,4,24,0.4);
  color: var(--om-text-sec);
  border-color: rgba(232,198,106,0.25);
}
.data-btn.ghost:hover:not(:disabled) { background: rgba(232,198,106,0.08); border-color: var(--om-gold); color: var(--om-gold); }
.data-btn.primary {
  background: linear-gradient(135deg, var(--om-gold) 0%, var(--om-gold-deep) 100%);
  color: #1A0F0A;
  border-color: rgba(232,198,106,0.6);
  box-shadow: 0 3px 10px rgba(232,198,106,0.30);
}
.data-btn.primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(232,198,106,0.45); }

.data-msg { margin-top: 12px; font-size: 13px; font-weight: 600; }
.data-msg.success { color: #7DE3C8; }
.data-msg.error { color: #FF8B7E; }

/* 录屏管理卡片 */
.rec-session-block {
  margin-top: 16px; padding-top: 16px;
  border-top: 1px dashed rgba(232,198,106,0.25);
  display: flex; flex-direction: column; gap: 10px;
}
.rec-session-head { display: flex; align-items: center; justify-content: space-between; }
.rec-session-count { font-size: 13px; font-weight: 700; color: var(--om-gold); letter-spacing: 1px; }
.rec-session-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.rs-session {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 8px;
  background: rgba(10,4,24,0.45);
  border: 1px solid rgba(232,198,106,0.20);
  border-radius: 10px;
}
.rs-card-btn {
  display: flex; flex-direction: row; align-items: stretch; gap: 10px;
  padding: 0; background: transparent; border: none;
  cursor: pointer; text-align: left;
  border-radius: 8px; min-width: 0; flex: 1;
}
.rs-thumb {
  width: 120px; height: 68px; object-fit: cover;
  border-radius: 6px; background: #000;
  flex-shrink: 0;
  border: 1px solid rgba(232,198,106,0.25);
}
.rs-thumb-placeholder {
  display: flex; align-items: center; justify-content: center;
  color: var(--om-text-mute); background: rgba(10,4,24,0.6);
  font-size: 24px;
}
.rs-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 2px; flex: 1; }
.rs-title { font-size: 12px; font-weight: 700; color: var(--om-text-pri); white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.rs-meta { font-size: 10px; color: var(--om-text-mute); }
.rs-del-btn {
  flex-shrink: 0; width: 28px; height: 28px;
  align-self: flex-start;
  border: 1px solid rgba(232,198,106,0.25);
  border-radius: 7px;
  background: rgba(10,4,24,0.5);
  color: var(--om-text-sec);
  cursor: pointer; font-size: 13px; line-height: 1;
  transition: all 0.18s;
}
.rs-del-btn:hover { color: #fff; background: #FF6E5A; border-color: #FF6E5A; }
.rec-list-empty {
  font-size: 12px; color: var(--om-text-mute);
  text-align: center; padding: 18px;
  border: 1px dashed rgba(232,198,106,0.20);
  border-radius: 10px;
}

/* 设置行（视觉模型 / 截图窗口 / 告警阈值等） */
.setting-row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(232,198,106,0.15);
}
.setting-row:last-child { border-bottom: none; }
.setting-label {
  flex-shrink: 0; min-width: 110px;
  font-size: 12px; font-weight: 600;
  color: var(--om-text-sec); letter-spacing: 1px;
}
.setting-value { font-size: 12px; color: var(--om-text-pri); }
.setting-input {
  height: 32px; padding: 0 12px;
  background: rgba(10,4,24,0.55);
  border: 1px solid rgba(232,198,106,0.25);
  border-radius: 6px;
  color: var(--om-text-pri); font-size: 12px;
  outline: none;
}
.setting-input:focus { border-color: var(--om-gold); }
.setting-input.select { min-width: 180px; }
.model-installed {
  display: inline-flex; align-items: center;
  padding: 2px 8px; font-size: 11px; font-weight: 600;
  color: #7DE3C8;
  background: rgba(125,227,200,0.10);
  border: 1px solid rgba(125,227,200,0.30);
  border-radius: 999px;
}
.rec-usage { font-size: 12px; color: var(--om-text-sec); }
.rec-usage b { color: var(--om-gold); font-weight: 700; }

/* 卡片背景图设置 */
.card-bg-block {
  margin-top: 14px;
  padding: 14px 16px 16px;
  background: rgba(10, 4, 24, 0.45);
  border: 1px solid rgba(232, 198, 106, 0.22);
  border-radius: 12px;
}
.card-bg-head { margin-bottom: 10px; }
.card-bg-title { font-size: 12px; font-weight: 700; color: #C896FF; letter-spacing: 1px; }
.card-bg-sub { margin-top: 3px; font-size: 11px; color: var(--om-text-mute); line-height: 1.5; }
.card-bg-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.card-bg-preview {
  width: 132px; height: 72px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(232, 198, 106, 0.4);
  box-shadow: inset 0 0 12px rgba(10, 4, 24, 0.6);
  flex-shrink: 0;
}
.card-bg-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ── 卡片背景系统 v2：Tab / 预设网格 / 预览 / 遮罩滑块 ── */
.card-bg-tabs { display: flex; gap: 6px; margin: 4px 0 12px; flex-wrap: wrap; }
.card-bg-tab {
  position: relative;
  padding: 6px 14px;
  font-size: 11px; font-weight: 600;
  color: var(--om-text-sec, #C9B8E8);
  background: rgba(139, 95, 196, 0.14);
  border: 1px solid rgba(139, 95, 196, 0.3);
  border-radius: 999px;
  cursor: pointer;
  transition: all .18s ease;
}
.card-bg-tab:hover { background: rgba(139, 95, 196, 0.24); }
.card-bg-tab.active {
  color: #17112B;
  background: linear-gradient(135deg, var(--om-gold, #E8C66A), #F0D99A);
  border-color: transparent;
  font-weight: 700;
}
.card-bg-dot {
  display: inline-block; width: 6px; height: 6px;
  margin-left: 6px; border-radius: 50%;
  background: #5EE08A;
  vertical-align: 2px;
}
.card-bg-live { margin-bottom: 12px; }
.card-bg-live-label { display: block; font-size: 10px; color: var(--om-text-mute, #8B7DAB); margin-bottom: 6px; letter-spacing: .5px; }
.card-bg-preview-box {
  position: relative;
  height: 96px; border-radius: 10px;
  border: 1px solid rgba(232, 198, 106, 0.45);
  background: linear-gradient(150deg, #241A4A 0%, #1A1140 100%);
  background-size: cover; background-position: center;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.card-bg-preview-box.empty { border-style: dashed; border-color: rgba(232, 198, 106, 0.3); }
.card-bg-preview-box img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.card-bg-empty-text { font-size: 11px; color: var(--om-text-mute, #8B7DAB); }
.card-bg-preset-name {
  position: relative; z-index: 1;
  padding: 4px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 700;
  color: #FFF;
  background: rgba(10, 4, 24, 0.55);
  text-shadow: 0 1px 4px rgba(0,0,0,.6);
}
.card-bg-live-sub { margin-top: 6px; font-size: 10px; color: var(--om-text-mute, #8B7DAB); line-height: 1.5; }
.card-bg-section-label {
  font-size: 10px; font-weight: 700; letter-spacing: 1px;
  color: var(--om-text-sec, #C9B8E8);
  margin: 10px 0 8px;
}
.card-bg-presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 8px; margin-bottom: 12px; }
.card-bg-preset {
  position: relative;
  height: 52px; border-radius: 9px;
  border: 2px solid transparent;
  background-size: cover; background-position: center;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  transition: border-color .15s ease, transform .15s ease;
}
.card-bg-preset:hover { transform: translateY(-2px); border-color: rgba(232, 198, 106, 0.6); }
.card-bg-preset.active { border-color: var(--om-gold, #E8C66A); box-shadow: 0 0 0 2px rgba(232, 198, 106, 0.3); }
.card-bg-preset-name-mini {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 3px 4px; font-size: 9px; text-align: center;
  color: #FFF; background: rgba(10, 4, 24, 0.6);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card-bg-veil { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(232, 198, 106, 0.18); }
.card-bg-veil-label { font-size: 11px; font-weight: 600; color: var(--om-text-sec, #C9B8E8); white-space: nowrap; }
.card-bg-veil-slider { flex: 1; accent-color: var(--om-gold, #E8C66A); cursor: pointer; }
.card-bg-veil-val { font-size: 11px; font-weight: 700; color: var(--om-gold, #E8C66A); min-width: 36px; text-align: right; }

/* ── 个人资料 ── */
.profile-row { display: flex; align-items: center; gap: 18px; }
.profile-avatar-wrap {
  width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(255,107,157,0.25), rgba(139,95,196,0.25));
  border: 2px solid rgba(232,198,106,0.6);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(139,95,196,0.3);
}
.profile-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.profile-avatar-fallback { font-size: 30px; font-weight: 700; color: var(--om-gold, #E8C66A); }
.profile-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.profile-field .form-label { display: block; margin-bottom: 4px; }
.profile-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.profile-saved { font-size: 12px; font-weight: 700; color: #5EE08A; }

/* 关于本项目入口卡（button 复刻 settings-section 外观） */
.about-entry {
  width: 100%;
  display: flex; align-items: center; gap: 16px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
}
.about-entry:hover {
  border-color: rgba(232, 198, 106, 0.7);
  transform: translateY(-1px);
  box-shadow: 0 10px 30px rgba(10, 4, 24, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.about-entry-ico {
  flex-shrink: 0; width: 46px; height: 46px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 30% 20%, rgba(232, 198, 106, 0.2), rgba(10, 4, 24, 0.4));
  border: 1px solid rgba(232, 198, 106, 0.45);
  box-shadow: inset 0 0 14px rgba(232, 198, 106, 0.12);
}
.about-entry-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.about-entry-title { font-size: 15px; font-weight: 700; letter-spacing: 1px; color: var(--om-gold, #E8C66A); }
.about-entry-desc { font-size: 12px; color: var(--om-text-mute, #8B7FC4); letter-spacing: .4px; }
.about-entry-arrow { flex-shrink: 0; color: var(--om-gold, #E8C66A); opacity: .8; transition: transform .25s ease; }
.about-entry:hover .about-entry-arrow { transform: translateX(3px); opacity: 1; }

/* ── 自动更新 ── */
.update-body { display: flex; flex-direction: column; gap: 12px; }
.update-info-row { display: flex; align-items: center; gap: 10px; }
.update-label { font-size: 13px; color: var(--om-text-sec, #C9BDE4); }
.update-value { font-size: 13px; font-weight: 700; color: var(--om-text-pri, #F5E0B0); letter-spacing: 1px; }
.update-new { color: #5EE08A; }
.update-progress { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--om-text-sec, #C9BDE4); }
.update-spinner { width: 14px; height: 14px; border: 2px solid rgba(232, 198, 106, 0.3); border-top-color: var(--om-gold, #E8C66A); border-radius: 50%; animation: update-spin .7s linear infinite; }
@keyframes update-spin { to { transform: rotate(360deg); } }
.update-bar-wrap { width: 100%; height: 6px; background: rgba(232, 198, 106, 0.15); border-radius: 3px; overflow: hidden; }
.update-bar-fill { height: 100%; background: linear-gradient(90deg, var(--om-gold, #E8C66A), #5EE08A); border-radius: 3px; transition: width .3s ease; }
.update-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.update-btn {
  padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(232, 198, 106, 0.35);
  font-size: 12px; font-weight: 700; letter-spacing: 1px; cursor: pointer;
  color: var(--om-text-pri, #F5E0B0);
  background: rgba(232, 198, 106, 0.08);
  transition: all .2s ease; font-family: inherit;
}
.update-btn:hover:not(:disabled) { background: rgba(232, 198, 106, 0.18); border-color: rgba(232, 198, 106, 0.6); }
.update-btn:disabled { opacity: .4; cursor: not-allowed; }
.update-btn-dl { background: rgba(94, 224, 138, 0.12); border-color: rgba(94, 224, 138, 0.35); color: #5EE08A; }
.update-btn-dl:hover:not(:disabled) { background: rgba(94, 224, 138, 0.22); }
.update-btn-install { background: rgba(232, 198, 106, 0.2); border-color: var(--om-gold, #E8C66A); color: var(--om-gold, #E8C66A); }
.update-btn-install:hover:not(:disabled) { background: rgba(232, 198, 106, 0.3); }
.update-notes { font-size: 12px; line-height: 1.6; color: var(--om-text-mute, #8B7FC4); padding: 8px 10px; background: rgba(10, 4, 24, 0.3); border-radius: 8px; }
</style>
