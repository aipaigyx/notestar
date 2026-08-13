<template>
  <div class="note-page">
    <div class="glow-orb glow-pink" style="width: 480px; height: 480px; top: 60px; left: -60px;"></div>
    <div class="glow-orb glow-purple" style="width: 500px; height: 500px; bottom: -100px; right: 200px;"></div>

    <div class="content-layer">
      <!-- 笔记列表区 -->
      <div class="note-list-panel">
        <div class="search-bar">
          <input ref="searchInput" v-model="searchQuery" class="search-input" placeholder="搜索笔记...（Ctrl+K）" />
          <button class="new-note-btn plain" @click="showImportDialog = true" title="导入转写文本 / 音频转文字">导入</button>
          <button class="new-note-btn primary" @click="createNewNote">+ 新建</button>
        </div>

        <div class="filter-tabs" v-if="courses.length > 0">
          <button class="filter-tab" :class="{ active: selectedCourse === 'all' }" @click="selectedCourse = 'all'">
            全部 ({{ notes.length }})
          </button>
          <button
            v-for="c in courses"
            :key="c.id"
            class="filter-tab"
            :class="{ active: selectedCourse === c.id }"
            @click="selectedCourse = c.id"
          >
            {{ c.name }} ({{ c.noteCount }})
          </button>
          <button class="filter-tab recycle" :class="{ active: showRecycleBin }" @click="toggleRecycleBin">
            🗑 回收站 ({{ deletedNotes.length }})
          </button>
        </div>

        <!-- 回收站视图 -->
        <div v-if="showRecycleBin" class="recycle-body">
          <div v-if="deletedNotes.length === 0" class="empty-state">
            <p>回收站是空的</p>
            <span class="empty-desc">删除的笔记会在这里保留 30 天</span>
          </div>
          <div v-for="note in deletedNotes" :key="note.id" class="recycle-item">
            <div class="recycle-info">
              <span class="recycle-title">{{ note.title }}</span>
              <span class="recycle-date">删除于 {{ formatDeletedAt(note.deletedAt) }}</span>
            </div>
            <div class="recycle-actions">
              <button class="recycle-btn restore" @click="doRestoreNote(note.id)" title="恢复到笔记列表">恢复</button>
              <button class="recycle-btn purge" @click="doPurgeNote(note)" title="永久删除，不可恢复">删除</button>
            </div>
          </div>
        </div>

        <!-- 笔记列表 -->
        <div v-else class="notes-scroll">
          <div
            v-for="note in filteredNotes"
            :key="note.id"
            class="note-card"
            :class="{ selected: currentNote?.id === note.id }"
            @click="selectNote(note)"
          >
            <div class="note-color-bar" :style="{ background: getCourseColor(note.courseId) }"></div>
            <div class="note-card-body">
              <div class="note-card-top">
                <span class="note-card-tag" v-for="t in note.tags?.slice(0,2)" :key="t">{{ t }}</span>
              </div>
              <span class="note-card-title" v-html="highlight(note.title, searchQuery)"></span>
              <span class="note-card-date">{{ formatDate(note.updatedAt) }} · {{ note.paragraphs }} 段</span>
            </div>
          </div>
          <div v-if="filteredNotes.length === 0" class="empty-state">
            <p>暂无笔记</p>
            <button class="empty-btn" @click="showImportDialog = true">导入转写文本</button>
            <button class="empty-btn-text" @click="createNewNote">或手动创建</button>
          </div>
        </div>
      </div>

      <!-- 编辑器区 -->
      <div class="editor-panel">
        <template v-if="currentNote">
          <div class="editor-header">
            <input v-model="currentNote.title" class="editor-title" placeholder="输入标题..." @input="markDirty" />
            <div class="editor-actions">
              <button class="editor-btn import" @click="showImportDialog = true" title="导入转写文本 / 粘贴文本 / 音频转文字">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style="vertical-align: -2px; margin-right: 4px;">
                  <path d="M7 1V9M3.5 5.5L7 9.5L10.5 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M2 12H12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                导入
              </button>
              <button class="editor-btn ai" @click="aiAnalyzeNote($event)" :disabled="aiAnalyzing" title="分析笔记知识点（Ctrl/Shift+点击强制重新分析）">
                {{ aiAnalyzing ? 'AI 分析中...' : 'AI 知识分析' }}
              </button>
              <button class="editor-btn expand" @click="aiExpandNote" :disabled="aiExpanding">
                {{ aiExpanding ? '扩展中...' : 'AI 知识扩展' }}
              </button>
              <button class="editor-btn export" @click="doExportNote('md')" title="导出当前笔记为 Markdown 文件">导出 MD</button>
              <button class="editor-btn export" @click="doExportNote('html')" title="导出当前笔记为 HTML 文件">导出 HTML</button>
              <button class="editor-btn save" :disabled="!isDirty" @click="saveCurrent">保存</button>
              <button class="editor-btn danger" @click="deleteCurrent">删除</button>
            </div>
          </div>

          <div class="editor-tags">
            <span class="tag-chip" v-for="(t, i) in currentNote.tags" :key="i">
              {{ t }}
              <button class="tag-remove" @click="currentNote.tags.splice(i, 1); markDirty()">×</button>
            </span>
            <input v-model="newTag" class="tag-input" placeholder="+ 添加标签" @keyup.enter="addTag" />
          </div>

          <div class="editor-course-select">
            <label>课程：</label>
            <select v-model="currentNote.courseId" @change="markDirty">
              <option value="">未分类</option>
              <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <button class="add-course-btn" @click="showCourseDialog = true">+ 新建课程</button>
          </div>

          <div class="editor-mode-tabs">
            <button class="mode-tab" :class="{ active: editorMode === 'edit' }" @click="editorMode = 'edit'">编辑</button>
            <button class="mode-tab" :class="{ active: editorMode === 'preview' }" @click="editorMode = 'preview'">预览</button>
            <!-- 字号调节 -->
            <div class="font-size-control" title="调整文字大小">
              <button class="font-size-btn" @click="fontSize = Math.max(12, fontSize - 1)">A−</button>
              <span class="font-size-val">{{ fontSize }}px</span>
              <button class="font-size-btn" @click="fontSize = Math.min(26, fontSize + 1)">A＋</button>
            </div>
            <button class="mode-tab img-btn" @click="insertImage" title="插入图片（支持粘贴 Ctrl+V）">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                <circle cx="4.5" cy="6" r="1" fill="currentColor"/>
                <path d="M2 10L5 7L7.5 9L10 6.5L13 9.5V11C13 11.55 12.55 12 12 12H2C1.45 12 1 11.55 1 11V10Z" fill="currentColor"/>
              </svg>
              图片
            </button>
            <!-- 一键截屏：看视频记笔记用 -->
            <div class="capture-group" title="一键截取屏幕画面插入笔记（Ctrl+Alt+S）">
              <button class="mode-tab img-btn capture-btn" @click="quickCapture">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="2.5" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.2"/>
                  <circle cx="7" cy="7" r="2.8" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M4.5 2.5L5 1H9L9.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                </svg>
                截屏
              </button>
              <button class="capture-arrow" @click="openCapturePicker" title="选择要截取的窗口/屏幕">▾</button>
            </div>
          </div>

          <!-- Markdown 工具栏（编辑模式） -->
          <MarkdownToolbar v-if="editorMode === 'edit'" @action="onToolbarAction" />

          <!-- TTS 朗读控制条（预览模式） -->
          <div v-if="editorMode === 'preview'" class="tts-bar">
            <button class="tts-btn tts-primary" @click="toggleTTS" :title="ttsPlaying ? '暂停/继续' : '朗读笔记内容'">
              <svg v-if="!ttsPlaying" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 5V9H4L7.5 12V2L4 5H1.5Z" fill="currentColor"/>
                <path d="M9.5 5.2C10.2 5.9 10.2 8.1 9.5 8.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M11 3.5C12.4 4.8 12.4 9.2 11 10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              <svg v-else-if="!ttsPaused" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor"/>
                <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 2.5L11 7L4 11.5V2.5Z" fill="currentColor"/>
              </svg>
              {{ ttsPlaying ? (ttsPaused ? '继续' : '暂停') : '朗读' }}
            </button>
            <button v-if="ttsPlaying" class="tts-btn" @click="stopTTS" title="停止朗读">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor"/>
              </svg>
              停止
            </button>
            <div class="tts-rate" title="朗读语速">
              <span class="tts-rate-label">语速</span>
              <button class="tts-rate-btn" :class="{ active: ttsRate === 0.8 }" @click="setTtsRate(0.8)">慢</button>
              <button class="tts-rate-btn" :class="{ active: ttsRate === 1 }" @click="setTtsRate(1)">正常</button>
              <button class="tts-rate-btn" :class="{ active: ttsRate === 1.2 }" @click="setTtsRate(1.2)">快</button>
            </div>
            <span v-if="ttsPlaying" class="tts-progress">{{ ttsIdx + 1 }}/{{ ttsTotal }}</span>
          </div>

          <textarea
            v-if="editorMode === 'edit'"
            v-model="currentNote.content"
            class="editor-body"
            :style="{ fontSize: fontSize + 'px' }"
            placeholder="开始输入笔记内容..."
            @input="markDirty"
            @paste="handlePaste"
            ref="editorTextarea"
          ></textarea>
          <div v-else ref="editorPreviewEl" class="editor-preview markdown-body" :style="{ fontSize: fontSize + 'px' }" v-html="renderMarkdown(currentNote.content || '')"></div>

          <div class="editor-footer">
            <span>{{ currentNote.content.length }} 字 · {{ currentNote.paragraphs }} 段</span>
            <span v-if="isDirty" class="unsaved">未保存</span>
            <span v-else class="saved">已保存</span>
          </div>
        </template>

        <template v-else>
          <div class="no-selection">
            <div class="no-sel-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M10 4C10 2.9 10.9 2 12 2H28L40 14V44C40 45.1 39.1 46 38 46H12C10.9 46 10 45.1 10 44V4Z" stroke="#D0D0E0" stroke-width="2"/>
                <path d="M28 2V14H40" stroke="#D0D0E0" stroke-width="2"/>
                <path d="M18 24H32 M18 30H32 M18 36H28" stroke="#D0D0E0" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="no-sel-title">导入转写文本或手动创建</p>
            <p class="no-sel-desc">将录音转写后的 .txt 文件导入，AI 自动整理成结构化笔记</p>
            <div class="no-sel-actions">
              <button class="no-sel-btn primary" @click="showImportDialog = true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1V11 M4 7L8 11L12 7 M2 14H14" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
                导入转写文本
              </button>
              <button class="no-sel-btn" @click="createNewNote">手动新建</button>
            </div>
          </div>
        </template>
      </div>

      <!-- 右侧大纲/知识分析面板 -->
      <div class="outline-panel">
        <div class="outline-header">
          <div class="outline-tabs">
            <button class="outline-tab" :class="{ active: rightPanelTab === 'outline' }" @click="rightPanelTab = 'outline'">大纲</button>
            <button class="outline-tab" :class="{ active: rightPanelTab === 'analysis' }" @click="rightPanelTab = 'analysis'">
              知识分析<span v-if="analysisLoadedFromCache" class="cache-badge" title="已加载上次分析结果（内容未变，无需重新分析）">已缓存</span>
            </button>
            <button class="outline-tab" :class="{ active: rightPanelTab === 'expansion' }" @click="rightPanelTab = 'expansion'">知识扩展</button>
          </div>
        </div>

        <!-- 大纲视图 -->
        <div class="outline-body" v-if="rightPanelTab === 'outline' && currentNote">
          <div v-for="(line, i) in noteOutline" :key="i" class="outline-item" :class="{ heading: line.isHeading }">
            {{ line.text }}
          </div>
        </div>

        <!-- 知识分析视图 -->
        <div class="analysis-body" v-if="rightPanelTab === 'analysis'">
          <div v-if="!noteAnalysis && !aiAnalyzing" class="analysis-empty">
            <div class="analysis-empty-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="6" y="6" width="12" height="12" rx="3" stroke="#D0D0E0" stroke-width="1.5"/>
                <rect x="22" y="6" width="12" height="12" rx="3" stroke="#D0D0E0" stroke-width="1.5"/>
                <rect x="6" y="22" width="12" height="12" rx="3" stroke="#D0D0E0" stroke-width="1.5"/>
                <rect x="22" y="22" width="12" height="12" rx="3" stroke="#D0D0E0" stroke-width="1.5"/>
                <line x1="18" y1="12" x2="22" y2="12" stroke="#D0D0E0" stroke-width="1.5"/>
                <line x1="12" y1="18" x2="12" y2="22" stroke="#D0D0E0" stroke-width="1.5"/>
              </svg>
            </div>
            <p class="analysis-empty-text">点击「AI 知识分析」生成知识树和卡片</p>
          </div>

          <!-- 加载中 -->
          <div v-if="aiAnalyzing" class="analysis-loading">
            <div class="loading-spinner"></div>
            <p>AI 正在分析知识结构...</p>
          </div>

          <!-- 分析结果 -->
          <div v-if="noteAnalysis && !aiAnalyzing" class="analysis-result">
            <!-- 摘要 -->
            <div class="analysis-section">
              <h4 class="analysis-section-title">📊 内容摘要</h4>
              <p class="analysis-summary">{{ noteAnalysis.summary }}</p>
            </div>

            <!-- 知识树 -->
            <div class="analysis-section" v-if="noteAnalysis.tree?.children?.length">
              <h4 class="analysis-section-title">🌳 知识树</h4>
              <KnowledgeTree :tree="noteAnalysis.tree" />
            </div>

            <!-- 知识卡片 -->
            <div class="analysis-section" v-if="noteAnalysis.cards?.length">
              <h4 class="analysis-section-title">📇 知识卡片</h4>
              <div class="knowledge-cards">
                <div
                  v-for="(card, ci) in noteAnalysis.cards"
                  :key="ci"
                  class="knowledge-card"
                  :class="card.type"
                >
                  <div class="card-header">
                    <span class="card-type-badge" :class="card.type">{{ cardTypeLabel(card.type) }}</span>
                    <span class="card-difficulty" :class="card.difficulty">{{ difficultyLabel(card.difficulty) }}</span>
                  </div>
                  <h5 class="card-title">{{ card.title }}</h5>
                  <p class="card-content">{{ card.content }}</p>
                </div>
              </div>
            </div>

            <!-- 公式汇总（内容含公式时显示） -->
            <div class="analysis-section" v-if="noteAnalysis.formulas?.length">
              <h4 class="analysis-section-title">🧮 公式汇总</h4>
              <div class="formula-list">
                <div v-for="(f, fi) in noteAnalysis.formulas" :key="fi" class="formula-item">
                  <span class="formula-badge">公式 {{ fi + 1 }}</span>
                  <code class="formula-text">{{ f }}</code>
                </div>
              </div>
            </div>

            <!-- 代码示例（内容含代码时显示） -->
            <div class="analysis-section" v-if="noteAnalysis.codeSnippets?.length">
              <h4 class="analysis-section-title">💻 代码示例</h4>
              <div class="code-snippet-list">
                <div v-for="(snip, si) in noteAnalysis.codeSnippets" :key="si" class="code-snippet-item">
                  <div class="code-snippet-head">
                    <span class="code-lang-badge">{{ snip.language || 'code' }}</span>
                    <span v-if="snip.description" class="code-desc">{{ snip.description }}</span>
                  </div>
                  <pre class="code-snippet-body"><code>{{ snip.code }}</code></pre>
                </div>
              </div>
            </div>

            <!-- 数据图表（内容适合可视化时显示，支持柱/饼/折线/时间轴/流程/维恩/对比） -->
            <div class="analysis-section" v-if="noteAnalysis.charts?.length">
              <h4 class="analysis-section-title">📈 数据图表</h4>
              <div class="chart-list">
                <div v-for="(chart, chi) in noteAnalysis.charts" :key="chi" class="chart-card">
                  <h5 class="chart-title">{{ chart.title }}</h5>
                  <ChartRenderer :chart="chart" />
                </div>
              </div>
            </div>

            <!-- 关键点 -->
            <div class="analysis-section" v-if="noteAnalysis.keyPoints?.length">
              <h4 class="analysis-section-title">🔑 核心关键点</h4>
              <div class="key-points-list">
                <div v-for="(kp, ki) in noteAnalysis.keyPoints" :key="ki" class="key-point-item">
                  <span class="key-point-num">{{ ki + 1 }}</span>
                  <span class="key-point-text">{{ kp }}</span>
                </div>
              </div>
            </div>

            <!-- 学习建议 -->
            <div class="analysis-section" v-if="noteAnalysis.suggestions?.length">
              <h4 class="analysis-section-title">💡 学习建议</h4>
              <div class="suggestions-list">
                <div v-for="(sug, si) in noteAnalysis.suggestions" :key="si" class="suggestion-item">
                  <span class="suggestion-icon">→</span>
                  <span class="suggestion-text">{{ sug }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 知识扩展视图 -->
        <div class="analysis-body" v-if="rightPanelTab === 'expansion'">
          <div v-if="!noteExpansion && !aiExpanding" class="analysis-empty">
            <div class="analysis-empty-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="12" stroke="#D0D0E0" stroke-width="1.5"/>
                <path d="M20 8v4M20 28v4M8 20h4M28 20h4" stroke="#D0D0E0" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="20" cy="20" r="4" fill="#D0D0E0"/>
              </svg>
            </div>
            <p class="analysis-empty-text">点击「AI 知识扩展」让 AI 发散补充相关知识</p>
          </div>

          <!-- 加载中 -->
          <div v-if="aiExpanding" class="analysis-loading">
            <div class="loading-spinner"></div>
            <p>AI 正在搜索扩展知识...</p>
          </div>

          <!-- 扩展结果 -->
          <div v-if="noteExpansion && !aiExpanding" class="analysis-result">
            <!-- 追加到笔记按钮 -->
            <button class="append-btn" @click="appendExpansionToNote">
              📝 将扩展内容追加到笔记
            </button>

            <!-- 扩展知识点 -->
            <div class="analysis-section" v-if="noteExpansion.expandedTopics?.length">
              <h4 class="analysis-section-title">🧩 扩展知识点</h4>
              <div class="expansion-topics">
                <div
                  v-for="(topic, ti) in noteExpansion.expandedTopics"
                  :key="ti"
                  class="expansion-topic"
                  :class="topic.relevance"
                >
                  <div class="topic-header">
                    <span class="topic-relevance-tag" :class="topic.relevance">
                      {{ relevanceLabel(topic.relevance) }}
                    </span>
                    <h5 class="topic-title">{{ topic.title }}</h5>
                  </div>
                  <p class="topic-content">{{ topic.content }}</p>
                </div>
              </div>
            </div>

            <!-- 遗漏概念 -->
            <div class="analysis-section" v-if="noteExpansion.missingConcepts?.length">
              <h4 class="analysis-section-title">⚠️ 笔记中遗漏的概念</h4>
              <div class="missing-concepts">
                <div v-for="(mc, mi) in noteExpansion.missingConcepts" :key="mi" class="missing-concept-item">
                  <span class="missing-icon">!</span>
                  <span class="missing-text">{{ mc }}</span>
                </div>
              </div>
            </div>

            <!-- 相关公式 -->
            <div class="analysis-section" v-if="noteExpansion.relatedFormulas?.length">
              <h4 class="analysis-section-title">📐 相关公式/定理</h4>
              <div class="formulas-list">
                <div v-for="(f, fi) in noteExpansion.relatedFormulas" :key="fi" class="formula-item">
                  <span class="formula-icon">∑</span>
                  <span class="formula-text">{{ f }}</span>
                </div>
              </div>
            </div>

            <!-- 实际应用 -->
            <div class="analysis-section" v-if="noteExpansion.realWorldApplications?.length">
              <h4 class="analysis-section-title">🌍 实际应用场景</h4>
              <div class="applications-list">
                <div v-for="(app, ai) in noteExpansion.realWorldApplications" :key="ai" class="application-item">
                  <span class="app-icon">▸</span>
                  <span class="app-text">{{ app }}</span>
                </div>
              </div>
            </div>

            <!-- 深入学习方向 -->
            <div class="analysis-section" v-if="noteExpansion.deeperTopics?.length">
              <h4 class="analysis-section-title">🎓 深入学习方向</h4>
              <div class="deeper-list">
                <div v-for="(dt, di) in noteExpansion.deeperTopics" :key="di" class="deeper-item">
                  <span class="deeper-num">{{ di + 1 }}</span>
                  <span class="deeper-text">{{ dt }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="rightPanelTab === 'outline' && !currentNote" class="outline-empty">
          <p>暂无大纲</p>
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <div v-if="showImportDialog" class="modal-overlay" @click.self="showImportDialog = false">
      <div class="modal-box">
        <h3 class="modal-title">导入转写文本</h3>
        <p class="modal-desc">选择录音转写后的文本文件，AI 会自动整理成结构化笔记</p>

        <div class="import-tabs">
          <button class="import-tab" :class="{ active: importMode === 'file' }" @click="importMode = 'file'">从文件导入</button>
          <button class="import-tab" :class="{ active: importMode === 'paste' }" @click="importMode = 'paste'">粘贴文本</button>
          <button class="import-tab" :class="{ active: importMode === 'audio' }" @click="importMode = 'audio'">🎤 音频转文字</button>
        </div>

        <!-- 文件导入 -->
        <div v-if="importMode === 'file'" class="import-file-area">
          <button class="import-file-btn" @click="doImportFiles" :disabled="importing">
            {{ importing ? '处理中...' : '选择 .txt / .md 文件（可多选）' }}
          </button>
          <p class="import-hint">可一次选择多个转写文本；确认队列后，系统会逐篇整理并创建独立笔记。</p>
          <p class="import-hint" v-if="!isElectron">浏览器模式下仅支持粘贴文本</p>
        </div>

        <!-- 粘贴文本 -->
        <div v-if="importMode === 'paste'" class="import-paste-area">
          <textarea
            v-model="pasteText"
            class="paste-textarea"
            placeholder="将录音转写文本粘贴到这里..."
            rows="8"
          ></textarea>
        </div>

        <!-- 音频转文字 -->
        <div v-if="importMode === 'audio'" class="audio-import-area">
          <div class="audio-source-picker" :class="{ disabled: isRecording || importing }">
            <button
              class="audio-source-option"
              :class="{ active: audioSource === 'microphone' }"
              @click="audioSource = 'microphone'"
              :disabled="isRecording || importing"
            >
              <strong>麦克风</strong>
              <span>录制你正在说的话</span>
            </button>
            <button
              class="audio-source-option"
              :class="{ active: audioSource === 'system' }"
              @click="audioSource = 'system'"
              :disabled="isRecording || importing"
            >
              <strong>电脑声音</strong>
              <span>录制网课、视频或应用播放的声音</span>
            </button>
          </div>

          <div class="audio-record-section">
            <button
              v-if="!isRecording && !audioTranscribed"
              class="audio-file-btn"
              @click="startRecording"
              :disabled="importing"
            >
              开始{{ audioSource === 'system' ? '录制电脑声音' : '录音' }}
            </button>
            <button
              v-if="isRecording"
              class="audio-file-btn stop"
              @click="stopRecording"
            >
              停止录制 ({{ recordingTime }}s)
            </button>
            <button
              v-if="!isRecording && audioTranscribed && pasteText"
              class="audio-file-btn"
              @click="resetRecording"
              :disabled="importing"
            >
              重新录制
            </button>
          </div>

          <div v-if="isRecording" class="recording-indicator">
            <div class="recording-pulse"></div>
            <span>正在录制{{ audioSource === 'system' ? '电脑声音' : '麦克风声音' }}...</span>
          </div>

          <!-- 转写中提示 -->
          <div v-if="isTranscribing" class="recording-indicator" style="background: rgba(66,146,245,0.1);">
            <div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid #4292F5; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span style="color: #4292F5;">正在本地转写音频（首次使用需下载模型，请耐心等待）...</span>
          </div>

          <div v-if="pasteText && importMode === 'audio'" class="audio-transcript-preview">
            <p class="audio-transcript-label">识别结果：</p>
            <textarea
              v-model="pasteText"
              class="paste-textarea"
              placeholder="语音识别结果将显示在这里..."
              rows="6"
            ></textarea>
          </div>

          <p v-if="audioSource === 'microphone'" class="audio-hint">
            选择"麦克风"后，点击开始录音并允许麦克风权限；完成后可编辑文本，再进行 AI 整理。
          </p>
          <p v-else class="audio-hint">
            点击开始后，在系统共享面板中选择正在播放网课的窗口或整个屏幕，并务必勾选"共享系统音频"。仅选择窗口但未共享音频时无法识别。录制结束后将自动使用本地 Whisper 转写。
          </p>
        </div>

        <!-- 选中的文件 -->
        <div v-if="importMode === 'file' && importedFiles.length > 0" class="imported-files">
          <div class="import-queue-head">
            <strong>已选择 {{ importedFiles.length }} 篇，待批量整理</strong>
            <button class="queue-clear-btn" @click="clearImportedFiles" :disabled="importing">清空队列</button>
          </div>
          <div v-for="(f, i) in importedFiles" :key="i" class="imported-file-item">
            <span class="file-name">{{ f.name }}</span>
            <span class="file-course" :class="{ pending: !importCourseLabels[i]?.matched }">
              {{ importCourseLabels[i]?.label || '正在识别课程...' }}
            </span>
            <span class="file-size">{{ f.content.length }} 字</span>
          </div>
        </div>

        <!-- AI 处理中 -->
        <div v-if="importing" class="importing-status">
          <div class="loading-spinner"></div>
          <p>AI 正在整理笔记，请稍候...</p>
        </div>

        <!-- 错误提示 -->
        <div v-if="importError" class="import-error">
          {{ importError }}
        </div>

        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showImportDialog = false" :disabled="importing || isRecording || isTranscribing">取消</button>
          <button
            v-if="importMode === 'file'"
            class="modal-btn confirm"
            @click="doProcessImportedFiles"
            :disabled="importedFiles.length === 0 || importing"
          >
            {{ importing ? `正在整理 ${importedFiles.length} 篇...` : `批量整理并创建 ${importedFiles.length || ''} 篇笔记` }}
          </button>
          <button
            v-if="importMode === 'paste' || importMode === 'audio'"
            class="modal-btn confirm"
            @click="doGenerateFromPaste"
            :disabled="!pasteText.trim() || importing || isRecording || isTranscribing"
          >
            {{ importing ? 'AI 整理中...' : 'AI 整理笔记' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 新建课程对话框 -->
    <div v-if="showCapturePicker" class="modal-overlay" @click.self="showCapturePicker = false">
      <div class="modal-box capture-box">
        <h3 class="modal-title">选择截屏目标</h3>
        <p class="modal-sub">选一次即可记住，之后点「截屏」直接截取该窗口（正在播放的视频画面）</p>
        <div class="capture-grid">
          <div
            v-for="s in captureSources"
            :key="s.id"
            class="capture-item"
            :class="{ active: rememberedSourceId === s.id }"
            @click="pickCaptureSource(s)"
          >
            <img v-if="s.thumbnail" :src="s.thumbnail" class="capture-thumb" alt="" />
            <div v-else class="capture-thumb empty"></div>
            <span class="capture-name">{{ s.name }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showCapturePicker = false">取消</button>
        </div>
      </div>
    </div>

    <div v-if="showCourseDialog" class="modal-overlay" @click.self="showCourseDialog = false">
      <div class="modal-box small">
        <h3 class="modal-title">新建课程</h3>
        <input v-model="newCourseName" class="modal-input" placeholder="课程名称（如：高等数学）" />
        <div class="color-picker">
          <div
            v-for="c in courseColors"
            :key="c"
            class="color-dot"
            :class="{ selected: newCourseColor === c }"
            :style="{ background: c }"
            @click="newCourseColor = c"
          ></div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showCourseDialog = false">取消</button>
          <button class="modal-btn confirm" @click="doCreateCourse" :disabled="!newCourseName.trim()">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  notes, courses, currentNote, createNote, updateNote, removeNote,
  createCourse, importFiles, generateNoteFromText, summarizeNote, analyzeNote, expandNote,
  addStudyTime, renderMarkdown, isElectron, frontendLogger, selectImage, readClipboardImage, saveImage, exportNotes,
  listScreenSources, captureScreen, getAnalysisCache,
  getDeletedNotes, restoreNote, purgeNote,
} from '../store'
import type { Note, ImportedFile, NoteAnalysis, NoteExpansion, KnowledgeTreeNode } from '../types'
import { showConfirm as globalShowConfirm, showAlert as globalShowAlert, showToast } from '../composables/useDialog'
import { buildAiCardHtml } from '../utils/aiCard'
import MarkdownToolbar from '../components/note/MarkdownToolbar.vue'
import KnowledgeTree from '../components/note/KnowledgeTree.vue'
import ChartRenderer from '../components/note/ChartRenderer.vue'

const route = useRoute()
const searchQuery = ref('')
const selectedCourse = ref('all')
const isDirty = ref(false)
const newTag = ref('')
const editorMode = ref<'edit' | 'preview'>('edit')
const fontSize = ref(14) // 编辑/预览区字号（12~26px）
const editorTextarea = ref<HTMLTextAreaElement | null>(null)
const editorPreviewEl = ref<HTMLElement | null>(null)

// ========== TTS 朗读（系统语音，免费离线） ==========
const ttsPlaying = ref(false)
const ttsPaused = ref(false)
const ttsRate = ref(1)
const ttsIdx = ref(0)
const ttsTotal = ref(0)
const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
let ttsSentences: { text: string; el: HTMLElement | null }[] = []
let ttsUtterance: SpeechSynthesisUtterance | null = null
let ttsHighlightEls: HTMLElement[] = []

// Markdown → 纯文本（朗读用，去除排版符号）
const extractPlainText = (md: string): string => {
  if (!md) return ''
  return md
    .replace(/```[\s\S]*?```/g, ' ')          // 代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // 链接只留文字
    .replace(/<[^>]+>/g, ' ')                  // HTML 标签
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')        // 标题符号
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // 加粗
    .replace(/\*([^*]+)\*/g, '$1')             // 斜体
    .replace(/`([^`]+)`/g, '$1')               // 行内代码
    .replace(/\|/g, ' ')                       // 表格分隔线
    .replace(/^\s*[-*+]\s+/gm, '')             // 无序列表
    .replace(/^\s*\d+\.\s+/gm, '')             // 有序列表
    .replace(/^>\s+/gm, '')                    // 引用
    .replace(/^[-=]{3,}$/gm, '')               // 分隔线
    .replace(/\s+/g, ' ')
    .trim()
}

// 按句子切分（。！？；换行）
const splitSentences = (text: string): string[] => {
  const out: string[] = []
  let cur = ''
  for (const ch of text) {
    cur += ch
    if (/[。！？!?；;\n]/.test(ch) || cur.length >= 55) {
      const s = cur.trim()
      if (s) out.push(s)
      cur = ''
    }
  }
  const rest = cur.trim()
  if (rest) out.push(rest)
  return out
}

// 收集预览区可朗读的块（段落/标题/列表项等）
const buildTtsSentences = (): { text: string; el: HTMLElement | null }[] => {
  const container = editorPreviewEl.value
  if (!container) return []
  const result: { text: string; el: HTMLElement | null }[] = []
  container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th').forEach((el) => {
    const e = el as HTMLElement
    // 跳过代码块内部的文字（代码不需要朗读）
    if (e.closest('pre')) return
    if (e.closest('code')) return
    const txt = extractPlainText(e.textContent || '')
    if (!txt) return
    for (const s of splitSentences(txt)) result.push({ text: s, el: e })
  })
  return result
}

// 选择中文语音（优先常见 Windows 中文语音名）
const pickZhVoice = (): SpeechSynthesisVoice | null => {
  const voices = speechSynthesis.getVoices()
  const zh = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('zh'))
  if (!zh.length) return null
  const preferred = ['Huihui', 'Yaoyao', 'Kangkang', 'Xiaoxiao', 'Yunxi', 'Yunyang', 'Xiaoyi', 'Xiaohan', 'Meijia', 'OneCore']
  for (const name of preferred) {
    const v = zh.find(v => v.name.includes(name))
    if (v) return v
  }
  return zh[0]
}

const clearTtsHighlight = () => {
  ttsHighlightEls.forEach(el => el.classList.remove('reading'))
  ttsHighlightEls = []
}

const highlightTtsBlock = (el: HTMLElement | null) => {
  clearTtsHighlight()
  if (el) {
    el.classList.add('reading')
    ttsHighlightEls = [el]
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const speakSentenceAt = (i: number) => {
  if (i >= ttsSentences.length) { finishTTS(); return }
  ttsIdx.value = i
  highlightTtsBlock(ttsSentences[i].el)
  const u = new SpeechSynthesisUtterance(ttsSentences[i].text)
  u.lang = 'zh-CN'
  u.rate = ttsRate.value
  u.pitch = 1
  const v = pickZhVoice()
  if (v) u.voice = v
  u.onend = () => speakSentenceAt(i + 1)
  u.onerror = () => speakSentenceAt(i + 1)
  ttsUtterance = u
  speechSynthesis.speak(u)
}

const startTTS = () => {
  if (!ttsSupported) { showAlert('无法朗读', '当前环境不支持语音合成'); return }
  stopTTS()
  // 预热语音列表（首次 getVoices 可能为空）
  if (!speechSynthesis.getVoices().length) speechSynthesis.getVoices()
  ttsSentences = buildTtsSentences()
  if (!ttsSentences.length) { showToast('没有可朗读的内容', 'warn'); return }
  ttsTotal.value = ttsSentences.length
  ttsPlaying.value = true
  ttsPaused.value = false
  speakSentenceAt(0)
}

const pauseTTS = () => { speechSynthesis.pause(); ttsPaused.value = true }
const resumeTTS = () => { speechSynthesis.resume(); ttsPaused.value = false }

const stopTTS = () => {
  if (ttsSupported) speechSynthesis.cancel()
  ttsPlaying.value = false
  ttsPaused.value = false
  ttsIdx.value = 0
  ttsTotal.value = 0
  ttsSentences = []
  ttsUtterance = null
  clearTtsHighlight()
}

const finishTTS = () => {
  ttsPlaying.value = false
  ttsPaused.value = false
  ttsIdx.value = 0
  ttsTotal.value = 0
  ttsSentences = []
  ttsUtterance = null
  clearTtsHighlight()
  showToast('朗读完成', 'success')
}

const toggleTTS = () => {
  if (!ttsPlaying.value) startTTS()
  else if (ttsPaused.value) resumeTTS()
  else pauseTTS()
}

const setTtsRate = (r: number) => {
  ttsRate.value = r
  // 朗读中改语速：停止后从当前句重读
  if (ttsPlaying.value) {
    speechSynthesis.cancel()
    if (!ttsPaused.value) speakSentenceAt(ttsIdx.value)
  }
}

// 切到编辑模式或切换笔记时停止朗读
watch(editorMode, (m) => { if (m === 'edit') stopTTS() })

// 生成知识树 SVG 图（将 tree 数据转为可视化 SVG 字符串）
const generateTreeSVG = (tree: KnowledgeTreeNode): string => {
  // 递归计算树的深度和宽度
  const measure = (node: KnowledgeTreeNode, depth: number): { depth: number; leaves: number } => {
    if (!node.children || node.children.length === 0) {
      return { depth, leaves: 1 }
    }
    let maxDepth = depth
    let totalLeaves = 0
    for (const child of node.children) {
      const m = measure(child, depth + 1)
      if (m.depth > maxDepth) maxDepth = m.depth
      totalLeaves += m.leaves
    }
    return { depth: maxDepth, leaves: totalLeaves }
  }
  const { depth: maxDepth, leaves: totalLeaves } = measure(tree, 0)
  const nodeHeight = 40
  const nodeWidth = 140
  const hGap = 20
  const vGap = 30
  const levelHeight = nodeHeight + vGap
  const svgWidth = Math.max((nodeWidth + hGap) * totalLeaves + 40, 320)
  const svgHeight = (maxDepth + 1) * levelHeight + 20

  // 递归计算每个节点的位置
  let leafIndex = 0
  const positions: { x: number; y: number; title: string; depth: number }[] = []
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []

  const layout = (node: KnowledgeTreeNode, depth: number, parentX?: number, parentY?: number) => {
    const y = 10 + depth * levelHeight
    let x: number
    if (!node.children || node.children.length === 0) {
      x = 20 + leafIndex * (nodeWidth + hGap)
      leafIndex++
    } else {
      let firstX = 0, lastX = 0
      node.children.forEach((child, i) => {
        layout(child, depth + 1, undefined, y + nodeHeight / 2)
        const childPos = positions[positions.length - 1]
        if (i === 0) firstX = childPos.x
        lastX = childPos.x
      })
      x = (firstX + lastX) / 2
    }
    positions.push({ x, y, title: node.title, depth })
    if (parentX !== undefined && parentY !== undefined) {
      edges.push({ x1: parentX, y1: parentY, x2: x + nodeWidth / 2, y2: y })
    }
  }

  layout(tree, 0)

  // 颜色配置
  const colors = ['#FF6B9D', '#4292F5', '#9B59B6', '#27AE60', '#F39C12', '#E74C3C']
  const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] || c)

  // 构建 SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;">`
  svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="#fafafa" rx="12"/>`

  // 绘制连接线（圆角折线）
  edges.forEach(e => {
    const midY = (e.y1 + e.y2) / 2
    svg += `<path d="M${e.x1},${e.y1} L${e.x1},${midY} L${e.x2},${midY} L${e.x2},${e.y2}" stroke="#cbd5e1" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
  })

  // 绘制节点
  positions.forEach(p => {
    const color = colors[p.depth % colors.length]
    const bg = p.depth === 0 ? color : `${color}15`
    const textColor = p.depth === 0 ? '#fff' : color
    const fontWeight = p.depth <= 1 ? '600' : '500'
    const fontSize = p.depth === 0 ? '13' : '12'
    const radius = p.depth === 0 ? '8' : '6'
    // 截断过长文字
    const maxChars = Math.floor(nodeWidth / 10)
    let title = escapeXml(p.title)
    if (p.title.length > maxChars) title = title.substring(0, maxChars - 1) + '…'
    svg += `<rect x="${p.x}" y="${p.y}" width="${nodeWidth}" height="${nodeHeight}" rx="${radius}" fill="${bg}" stroke="${color}" stroke-width="${p.depth === 0 ? '0' : '1'}"/>`
    svg += `<text x="${p.x + nodeWidth / 2}" y="${p.y + nodeHeight / 2 + 4}" text-anchor="middle" fill="${textColor}" font-size="${fontSize}" font-weight="${fontWeight}">${title}</text>`
  })

  svg += '</svg>'
  return svg
}

// 将知识树 SVG 嵌入到笔记内容（作为 Markdown 图片语法）
const embedTreeInNote = (tree: KnowledgeTreeNode): string => {
  const svg = generateTreeSVG(tree)
  // 将 SVG 编码为 data URI
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  const dataUri = `data:image/svg+xml,${encoded}`
  // 使用 Markdown 图片语法（alt 文字 + data URI）
  return `\n\n### 🌳 知识树状图\n\n![知识树](${dataUri})\n`
}

// 导入相关
const showImportDialog = ref(false)
const importMode = ref<'file' | 'paste' | 'audio'>('file')
const importedFiles = ref<ImportedFile[]>([])
const importCourseLabels = ref<{ label: string; matched: boolean }[]>([])
const autoCourseIds = new Map<string, string>()
let courseColorIndex = 0
const pasteText = ref('')
const importing = ref(false)
const importError = ref('')

// 音频转文字相关
const isRecording = ref(false)
const audioTranscribed = ref(false)
const recordingTime = ref(0)
const speechSupported = ref(false)
const audioSource = ref<'microphone' | 'system'>('microphone')
const isTranscribing = ref(false)
let recognition: any = null
let recordingTimer: ReturnType<typeof setInterval> | null = null
let systemAudioStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

// 检测 Web Speech API 支持
const checkSpeechSupport = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  speechSupported.value = !!SpeechRecognition
  return SpeechRecognition
}

// ========== 麦克风录音（Web Speech API 实时识别） ==========
const startMicRecording = () => {
  const SpeechRecognition = checkSpeechSupport()
  if (!SpeechRecognition) {
    showAlert('不支持语音识别', '当前环境不支持 Web Speech API。\n请使用 Chrome 浏览器或在 Electron 环境中运行。')
    return
  }

  pasteText.value = ''
  audioTranscribed.value = false
  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true

  let finalText = ''
  let interimText = ''

  recognition.onresult = (event: any) => {
    finalText = ''
    interimText = ''
    for (let i = 0; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalText += transcript
      } else {
        interimText += transcript
      }
    }
    pasteText.value = finalText + interimText
  }

  recognition.onerror = (event: any) => {
    console.error('语音识别错误:', event.error)
    if (event.error === 'not-allowed') {
      showAlert('麦克风权限被拒绝', '请允许使用麦克风权限后重试')
    } else if (event.error === 'no-speech') {
      // 无语音输入，静默处理
    } else {
      importError.value = `语音识别错误: ${event.error}`
    }
    isRecording.value = false
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
  }

  recognition.onend = () => {
    isRecording.value = false
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
    if (pasteText.value.trim()) {
      audioTranscribed.value = true
    }
  }

  try {
    recognition.start()
    isRecording.value = true
    recordingTime.value = 0
    recordingTimer = setInterval(() => {
      recordingTime.value++
    }, 1000)
  } catch (e: any) {
    showAlert('录音启动失败', e.message || '请检查麦克风权限')
  }
}

// ========== 系统声音录音（getDisplayMedia + Whisper 离线转写） ==========
const startSystemRecording = async () => {
  try {
    // 请求屏幕共享（含系统音频）
    const stream = await (navigator as any).mediaDevices.getDisplayMedia({
      video: true,   // 必须为 true 才能触发共享面板
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
        }
      } as any,
    })
    systemAudioStream = stream

    // 检查是否真的拿到了音频轨道
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      showAlert('未捕获到系统音频', '请在共享面板中勾选"共享系统音频"选项。\n如果只选择了窗口但没有勾选音频，将无法识别声音内容。')
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      systemAudioStream = null
      return
    }

    // 只保留音频轨道
    stream.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop())

    pasteText.value = ''
    audioTranscribed.value = false
    audioChunks = []

    // 使用 MediaRecorder 录制音频
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    })

    mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data)
      }
    }

    mediaRecorder.onstop = async () => {
      // 停止所有轨道
      if (systemAudioStream) {
        systemAudioStream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
        systemAudioStream = null
      }

      if (audioChunks.length === 0) {
        importError.value = '录制内容为空，请重试'
        return
      }

      // 合并音频 Blob 并转写
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      isTranscribing.value = true
      importError.value = ''

      try {
        const arrayBuffer = await audioBlob.arrayBuffer()
        const result = await (window as any).noteAPI.transcribeAudio(arrayBuffer)
        if (result && result.text) {
          pasteText.value = result.text
          audioTranscribed.value = true
        } else {
          importError.value = '转写结果为空，请检查录音内容'
        }
      } catch (e: any) {
        importError.value = `转写失败: ${e.message || '请检查本地转写环境'}`
      } finally {
        isTranscribing.value = false
      }
    }

    // 用户停止共享时自动停止录制
    stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
      track.onended = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop()
        }
        isRecording.value = false
        if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
      }
    })

    mediaRecorder.start(1000) // 每秒产生一个数据块
    isRecording.value = true
    recordingTime.value = 0
    recordingTimer = setInterval(() => {
      recordingTime.value++
    }, 1000)
  } catch (e: any) {
    if (e.name === 'NotAllowedError') {
      // 用户取消了共享
      return
    }
    showAlert('系统声音录制启动失败', e.message || '请确保在 Electron 环境中运行')
  }
}

const startRecording = () => {
  if (audioSource.value === 'system') {
    startSystemRecording()
  } else {
    startMicRecording()
  }
}

const stopRecording = () => {
  if (audioSource.value === 'system') {
    // 系统声音：停止 MediaRecorder，触发 onstop 自动转写
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording.value = false
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
  } else {
    // 麦克风：停止 Web Speech API
    if (recognition) {
      try { recognition.stop() } catch (e) { /* ignore */ }
    }
    isRecording.value = false
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
    if (pasteText.value.trim()) {
      audioTranscribed.value = true
    }
  }
}

const resetRecording = () => {
  pasteText.value = ''
  audioTranscribed.value = false
  recordingTime.value = 0
}

// 课程创建
const showCourseDialog = ref(false)
const newCourseName = ref('')
const newCourseColor = ref('#FF6B9D')
const courseColors = ['#FF6B9D', '#B794F6', '#4292F5', '#26D0A8', '#FF9948']

// AI 知识分析
const aiAnalyzing = ref(false)
const noteAnalysis = ref<NoteAnalysis | null>(null)
const rightPanelTab = ref<'outline' | 'analysis' | 'expansion'>('outline')

// AI 知识扩展
const aiExpanding = ref(false)
const noteExpansion = ref<NoteExpansion | null>(null)

// 使用全局弹窗系统（替代本地实现）
const showAlert = (title: string, message: string) => {
  globalShowAlert(title, message)
}

const showConfirm = (title: string, message: string, danger: boolean = true): Promise<boolean> => {
  return globalShowConfirm({ title, message, danger })
}

// 卡片类型标签
const cardTypeLabel = (type: string) => {
  const map: Record<string, string> = { concept: '概念', formula: '公式', definition: '定义', example: '示例', keypoint: '重点' }
  return map[type] || type
}
const difficultyLabel = (d: string) => {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return map[d] || d
}
const relevanceLabel = (r: string) => {
  const map: Record<string, string> = { high: '高度相关', medium: '中度相关', low: '拓展相关' }
  return map[r] || r
}

const filteredNotes = computed(() => {
  let result = notes.value
  if (selectedCourse.value !== 'all') {
    result = result.filter(n => n.courseId === selectedCourse.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content?.toLowerCase().includes(q) ||
      n.tags?.some((t: string) => t.toLowerCase().includes(q))
    )
  }
  return result
})

// 搜索命中高亮（转义正则，防 XSS：文本经 v-html 渲染前先转义）
const highlight = (text: string, q: string) => {
  if (!q || !q.trim() || !text) return text
  const raw = String(text)
  const escapedQ = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const parts = raw.split(new RegExp(`(${escapedQ})`, 'ig'))
  return parts.map(p => p.toLowerCase() === q.trim().toLowerCase()
    ? `<mark class="hl">${esc(p)}</mark>`
    : esc(p)).join('')
}

// Ctrl+K 聚焦搜索框
const searchInput = ref<HTMLInputElement | null>(null)
const handleGlobalKeys = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchInput.value?.focus()
    searchInput.value?.select()
  }
  // Ctrl+Alt+S 一键截屏（不冲突 Ctrl+S 保存）
  if (e.ctrlKey && e.altKey && !e.metaKey && e.key.toLowerCase() === 's') {
    e.preventDefault()
    quickCapture()
  }
}
const handleFocusSearch = () => {
  searchInput.value?.focus()
  searchInput.value?.select()
}

const getCourseColor = (id: string) => courses.value.find(c => c.id === id)?.color || '#FF6B9D'

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const selectNote = (note: Note) => {
  currentNote.value = { ...note }
  isDirty.value = false
  // 等切换笔记的 watch（清空分析结果）执行后再加载缓存，避免时序覆盖
  nextTick(() => loadAnalysisCache())
}

// ========== 打开笔记自动加载分析缓存 ==========
const analysisLoadedFromCache = ref(false)
const loadAnalysisCache = async () => {
  const note = currentNote.value
  if (!note || !note.id) return
  analysisLoadedFromCache.value = false
  try {
    // 候选内容：原始 / 读图 / 不读图 三种构造，任一与缓存 hash 匹配即命中
    const raw = getRawNoteContent()
    if (!raw) return
    const candidates = [raw, buildAnalyzeInput(true), buildAnalyzeInput(false)].filter(Boolean)
    const hit = await getAnalysisCache(note.id, [...new Set(candidates)])
    if (hit.found && hit.result && currentNote.value?.id === note.id) {
      noteAnalysis.value = hit.result
      analysisLoadedFromCache.value = true
      frontendLogger.info('NoteOrganize', '已自动加载上次分析结果（缓存）', { noteId: note.id })
    }
  } catch (e) {
    /* 静默失败，不影响打开笔记 */
  }
}

const createNewNote = () => {
  currentNote.value = {
    id: '',
    title: '',
    courseId: selectedCourse.value !== 'all' ? selectedCourse.value : (courses.value[0]?.id || ''),
    tags: [],
    content: '',
    createdAt: '',
    updatedAt: '',
    paragraphs: 0,
  }
  isDirty.value = true
}

const markDirty = () => {
  isDirty.value = true
  if (currentNote.value) {
    currentNote.value.paragraphs = currentNote.value.content.split('\n').filter((l: string) => l.trim()).length
  }
}

// ========== Markdown 工具栏 ==========
// 在光标位置插入 Markdown 语法，选中文字时包裹选中内容
const insertMarkdown = (before: string, after = '', placeholder = '文本') => {
  const textarea = editorTextarea.value
  if (!textarea || !currentNote.value) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = currentNote.value.content.substring(start, end) || placeholder
  const insert = before + selected + after
  currentNote.value.content = currentNote.value.content.substring(0, start) + insert + currentNote.value.content.substring(end)
  markDirty()
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

// 插入代码块（支持选择语言）
const insertCodeBlock = () => {
  const textarea = editorTextarea.value
  if (!textarea || !currentNote.value) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = currentNote.value.content.substring(start, end)
  const block = selected
    ? `\n\`\`\`\n${selected}\n\`\`\`\n`
    : '\n```\n代码\n```\n'
  currentNote.value.content = currentNote.value.content.substring(0, start) + block + currentNote.value.content.substring(end)
  markDirty()
  nextTick(() => {
    textarea.focus()
    const pos = start + block.length
    textarea.setSelectionRange(pos, pos)
  })
}

// 插入 Markdown 表格
const insertTable = () => {
  const textarea = editorTextarea.value
  if (!textarea || !currentNote.value) return
  const table = '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |\n'
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  currentNote.value.content = currentNote.value.content.substring(0, start) + table + currentNote.value.content.substring(end)
  markDirty()
  nextTick(() => {
    textarea.focus()
    const pos = start + table.length
    textarea.setSelectionRange(pos, pos)
  })
}

// Markdown 工具栏动作分发
const onToolbarAction = (name: string) => {
  switch (name) {
    case 'h1': insertMarkdown('# ', '', '标题'); break
    case 'h2': insertMarkdown('## ', '', '标题'); break
    case 'h3': insertMarkdown('### ', '', '标题'); break
    case 'bold': insertMarkdown('**', '**', '加粗文字'); break
    case 'italic': insertMarkdown('*', '*', '斜体文字'); break
    case 'code': insertMarkdown('`', '`', '代码'); break
    case 'ul': insertMarkdown('\n- ', '', '列表项'); break
    case 'ol': insertMarkdown('\n1. ', '', '列表项'); break
    case 'quote': insertMarkdown('\n> ', '', '引用内容'); break
    case 'codeblock': insertCodeBlock(); break
    case 'formula': insertMarkdown('\n$$\n', '\n$$\n', '公式（LaTeX）'); break
    case 'link': insertMarkdown('[', '](https://)', '链接文字'); break
    case 'table': insertTable(); break
    case 'hr': insertMarkdown('\n\n---\n\n', '', ''); break
  }
}

// ========== 图片插入（外置存储：base64 落盘为文件，笔记存引用） ==========
const insertImageAtCursor = (src: string, altText: string = '笔记图片') => {
  if (!currentNote.value) return
  const textarea = editorTextarea.value
  const markdown = `\n\n![${altText}](${src})\n\n`
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const content = currentNote.value.content
    currentNote.value.content = content.slice(0, start) + markdown + content.slice(end)
    // 光标移到图片后
    nextTick(() => {
      textarea.focus()
      const pos = start + markdown.length
      textarea.setSelectionRange(pos, pos)
    })
  } else {
    currentNote.value.content += markdown
  }
  markDirty()
}

// 统一入口：base64 先落盘为文件（Electron），再插入引用
const insertImageRef = async (dataUri: string, altText: string) => {
  try {
    const src = await saveImage(dataUri)
    insertImageAtCursor(src, altText)
  } catch (e: any) {
    showAlert('图片保存失败', e.message || '无法保存图片')
  }
}

// ========== 一键截屏（看视频记笔记） ==========
const rememberedSourceId = ref(localStorage.getItem('notestar-capture-source') || '')
const showCapturePicker = ref(false)
const captureSources = ref<{ id: string; name: string; isScreen: boolean; thumbnail: string }[]>([])

// 一键截屏：截取记住的窗口；未设置时自动截当前活动窗口（通常就是视频）
const quickCapture = async () => {
  if (!isElectron) {
    showAlert('截屏', '仅桌面版支持截屏功能')
    return
  }
  try {
    const shot = await captureScreen(
      rememberedSourceId.value ? { sourceId: rememberedSourceId.value } : { mode: 'foreground' }
    )
    await insertImageRef(shot.dataUri, `视频截图_${Date.now()}`)
    frontendLogger.info('NoteOrganize', '一键截屏完成', { name: shot.name })
  } catch (e: any) {
    showAlert('截屏失败', e.message || '无法截取屏幕，请检查窗口是否最小化')
  }
}

// 打开窗口选择面板
const openCapturePicker = async () => {
  if (!isElectron) {
    showAlert('截屏', '仅桌面版支持截屏功能')
    return
  }
  try {
    captureSources.value = await listScreenSources()
    showCapturePicker.value = true
  } catch (e: any) {
    showAlert('无法获取窗口列表', e.message)
  }
}

// 选定截屏目标并立即截图插入，记住该窗口
const pickCaptureSource = async (s: { id: string; name: string }) => {
  showCapturePicker.value = false
  rememberedSourceId.value = s.id
  localStorage.setItem('notestar-capture-source', s.id)
  try {
    const shot = await captureScreen({ sourceId: s.id })
    await insertImageRef(shot.dataUri, `截图_${Date.now()}`)
  } catch (e: any) {
    showAlert('截屏失败', e.message || '无法截取该窗口')
  }
}

const insertImage = async () => {
  try {
    const img = await selectImage()
    if (img) {
      await insertImageRef(img.dataUri, img.name.replace(/\.[^.]+$/, ''))
    }
  } catch (e: any) {
    showAlert('图片插入失败', e.message || '无法读取图片文件')
  }
}

const handlePaste = async (e: ClipboardEvent) => {
  // 检查剪贴板是否含图片
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) continue
      // 转 base64
      const reader = new FileReader()
      reader.onload = () => {
        const dataUri = reader.result as string
        insertImageRef(dataUri, `粘贴图片_${Date.now()}`)
      }
      reader.readAsDataURL(blob)
      return
    }
  }
  // 非图片粘贴，走默认行为
}

const addTag = () => {
  if (newTag.value.trim() && currentNote.value) {
    if (!currentNote.value.tags) currentNote.value.tags = []
    currentNote.value.tags.push(newTag.value.trim())
    newTag.value = ''
    markDirty()
  }
}

const saveCurrent = async () => {
  if (!currentNote.value || !currentNote.value.title.trim()) return
  const saved = await (currentNote.value.id
    ? updateNote(currentNote.value)
    : createNote(currentNote.value.title, currentNote.value.courseId, currentNote.value.tags || [], currentNote.value.content))
  currentNote.value = saved
  isDirty.value = false
}

// ========== 自动保存 ==========
let autoSaveTimer: ReturnType<typeof setInterval> | null = null

const autoSave = async () => {
  if (isDirty.value && currentNote.value && currentNote.value.title.trim()) {
    try {
      await saveCurrent()
    } catch (e) {
      // 静默失败，不打断用户
    }
  }
}

const handleNewNoteShortcut = () => {
  if (route.path === '/notes') createNewNote()
}

// 每 30 秒自动保存一次
onMounted(() => {
  autoSaveTimer = setInterval(autoSave, 30000)
  // 监听全局 Ctrl+S 快捷键
  window.addEventListener('notestar:save', autoSave)
  // 监听 Ctrl+N 快捷键
  window.addEventListener('notestar:new-note', handleNewNoteShortcut)
  // Ctrl+K 聚焦搜索框
  window.addEventListener('keydown', handleGlobalKeys)
  window.addEventListener('notestar:focus-search', handleFocusSearch)
})

onUnmounted(() => {
  if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null }
  window.removeEventListener('notestar:save', autoSave)
  window.removeEventListener('notestar:new-note', handleNewNoteShortcut)
  window.removeEventListener('keydown', handleGlobalKeys)
  window.removeEventListener('notestar:focus-search', handleFocusSearch)
  // 组件卸载时执行最后一次保存
  if (isDirty.value && currentNote.value?.title?.trim()) {
    saveCurrent()
  }
})

const deleteCurrent = async () => {
  if (!currentNote.value?.id) {
    currentNote.value = null
    isDirty.value = false
    return
  }
  const confirmed = await showConfirm('删除笔记', `确定要删除「${currentNote.value.title || '未命名笔记'}」吗？\n\n删除后将移入回收站，30 天内可恢复。`)
  if (confirmed) {
    await removeNote(currentNote.value.id)
    currentNote.value = null
    isDirty.value = false
    refreshDeletedNotes()
  }
}

// ========== 笔记导出 ==========
const doExportNote = async (format: 'md' | 'html') => {
  if (!currentNote.value?.id) return
  try {
    // HTML 导出附带 AI 分析结果（当前笔记的分析/缓存），生成排版+图表
    const analysisMap: Record<string, NoteAnalysis> = {}
    if (format === 'html' && noteAnalysis.value) {
      analysisMap[currentNote.value.id] = noteAnalysis.value
    }
    const result = await exportNotes({ noteIds: [currentNote.value.id], format, analysisMap })
    if (result) {
      showToast(format === 'html' ? 'HTML 已导出' : 'Markdown 已导出', 'success')
    }
  } catch (e: any) {
    showAlert('导出失败', e.message || '无法导出笔记')
  }
}

// ========== 回收站 ==========
const showRecycleBin = ref(false)
const deletedNotes = ref<Note[]>([])

const refreshDeletedNotes = async () => {
  try {
    deletedNotes.value = await getDeletedNotes()
  } catch (e) {
    deletedNotes.value = []
  }
}

const toggleRecycleBin = async () => {
  showRecycleBin.value = !showRecycleBin.value
  if (showRecycleBin.value) {
    currentNote.value = null
    isDirty.value = false
    await refreshDeletedNotes()
  }
}

const formatDeletedAt = (d?: string) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const doRestoreNote = async (id: string) => {
  await restoreNote(id)
  await refreshDeletedNotes()
  showToast('已恢复到笔记列表', 'success')
}

const doPurgeNote = async (note: Note) => {
  const ok = await showConfirm('永久删除', `确定要永久删除「${note.title}」吗？\n\n此操作不可恢复！`)
  if (!ok) return
  await purgeNote(note.id)
  await refreshDeletedNotes()
  showToast('已永久删除', 'info')
}

const noteOutline = computed(() => {
  if (!currentNote.value?.content) return []
  return currentNote.value.content.split('\n').filter((l: string) => l.trim()).map((line: string) => ({
    text: line.replace(/^#+\s*/, '').substring(0, 40) + (line.length > 40 ? '...' : ''),
    isHeading: line.startsWith('#') || line.length < 15,
  }))
})

// ========== 导入课程自动识别 ==========
// 完全在本地运行：已有课程优先精确匹配；未命中时从标题、文件名和正文主题词推断新课程。
type CourseDetection = { courseId: string; courseName: string; label: string; matched: boolean; suggested: boolean }

const COURSE_PATTERNS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: '高等数学', patterns: [/高等数学|微积分|极限|导数|积分|函数|矩阵|线性代数|概率论|统计学/] },
  { name: '物理', patterns: [/物理|力学|电磁|光学|热学|量子|牛顿|动量|能量/] },
  { name: '化学', patterns: [/化学|元素|分子|原子|反应|有机|无机|化学式/] },
  { name: '生物', patterns: [/生物|细胞|基因|遗传|蛋白质|生态|进化/] },
  { name: '英语', patterns: [/英语|english|grammar|vocabulary|词汇|语法|阅读理解|听力/i] },
  { name: '计算机', patterns: [/编程|代码|算法|数据结构|python|javascript|typescript|html|css|数据库|操作系统|网络协议|人工智能/i] },
  { name: 'Blender 三渲二', patterns: [/blender|三渲二|建模|渲染|材质|贴图|动画|几何节点|eevee|cycles|uv|骨骼/i] },
  { name: '设计基础', patterns: [/设计|排版|配色|字体|ui|ux|视觉|figma|品牌|构图/i] },
  { name: '历史', patterns: [/历史|朝代|战争|政治制度|古代|近代|现代史/] },
  { name: '语文与写作', patterns: [/语文|写作|阅读|作文|诗词|文言文|修辞/] },
]

function sanitizeCourseName(value: string) {
  return value.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/[\[\](){}]/g, ' ').trim().slice(0, 18)
}

function inferCourseName(name: string, content: string): string {
  const source = `${name}\n${content.slice(0, 8000)}`
  for (const category of COURSE_PATTERNS) {
    if (category.patterns.some(pattern => pattern.test(source))) return category.name
  }
  // Markdown首标题往往最能代表一份课程笔记主题。
  const heading = content.match(/^\s*#\s+([^\n#]{2,24})/m)?.[1]?.trim()
  if (heading) return sanitizeCourseName(heading)
  const fileName = sanitizeCourseName(name)
  return fileName && !/^粘贴笔记$/.test(fileName) ? fileName : '待整理资料'
}

function detectCourseForImport(name: string, content: string): CourseDetection {
  const source = `${name} ${content.slice(0, 8000)}`.toLowerCase()
  let best: { courseId: string; courseName: string; score: number } | null = null

  for (const course of courses.value) {
    const courseName = course.name.trim().toLowerCase()
    if (!courseName) continue
    let score = 0
    if (name.toLowerCase().includes(courseName)) score += 100
    if (source.includes(courseName)) score += 30
    const chunks = courseName.match(/[\u4e00-\u9fff]{2,}|[a-z0-9]+/g) || []
    for (const chunk of chunks) if (chunk.length >= 2 && source.includes(chunk)) score += 8
    if (!best || score > best.score) best = { courseId: course.id, courseName: course.name, score }
  }

  if (best && best.score >= 16) {
    return { courseId: best.courseId, courseName: best.courseName, label: `✓ 自动归入：${best.courseName}`, matched: true, suggested: false }
  }

  const courseName = inferCourseName(name, content)
  return { courseId: '', courseName, label: `✦ 建议新建课程：${courseName}`, matched: false, suggested: true }
}

function detectImportedCourses(files: ImportedFile[]) {
  return files.map(file => detectCourseForImport(file.name, file.content))
}

async function ensureAutoCourse(detection: CourseDetection): Promise<CourseDetection> {
  if (detection.courseId) return detection
  const normalized = detection.courseName.trim() || '待整理资料'
  const existing = courses.value.find(course => course.name.trim().toLowerCase() === normalized.toLowerCase())
  if (existing) {
    return { ...detection, courseId: existing.id, courseName: existing.name, label: `✓ 自动归入：${existing.name}`, matched: true, suggested: false }
  }
  const cachedId = autoCourseIds.get(normalized)
  if (cachedId) return { ...detection, courseId: cachedId, label: `✓ 自动新建并归入：${normalized}`, matched: true, suggested: false }
  const color = courseColors[courseColorIndex++ % courseColors.length]
  const created = await createCourse(normalized, color)
  autoCourseIds.set(normalized, created.id)
  return { ...detection, courseId: created.id, label: `✓ 自动新建并归入：${created.name}`, matched: true, suggested: false }
}

// ========== 导入流程 ==========
const doImportFiles = async () => {
  importError.value = ''
  if (!isElectron) {
    importMode.value = 'paste'
    return
  }
  try {
    const files = await importFiles()
    if (files && files.length > 0) {
      importedFiles.value = files
      const detected = detectImportedCourses(files)
      importCourseLabels.value = detected.map(item => ({ label: item.label, matched: item.matched }))
    }
  } catch (e: any) {
    importError.value = e.message || '读取文件失败'
  }
}

const clearImportedFiles = () => {
  importedFiles.value = []
  importCourseLabels.value = []
  importError.value = ''
}

const doProcessImportedFiles = async () => {
  if (importedFiles.value.length === 0) return
  const detected = detectImportedCourses(importedFiles.value)
  await processImportedFiles(importedFiles.value, detected)
}

const doGenerateFromPaste = async () => {
  if (!pasteText.value.trim()) return
  importError.value = ''
  const detected = await ensureAutoCourse(detectCourseForImport('粘贴笔记', pasteText.value))
  await processWithAI(pasteText.value, detected.courseId, detected.label)
}

// 多文件逐篇保存，避免原先将所有文件合并为一篇笔记，也保证分类精确。
const processImportedFiles = async (
  files: ImportedFile[],
  detectedCourses: CourseDetection[]
) => {
  importing.value = true
  importError.value = ''
  const savedNotes: Note[] = []
  try {
    for (let i = 0; i < files.length; i++) {
      const generated = await generateNoteFromText(files[i].content)
      const lines = generated.split('\n')
      const titleLine = lines.find(l => l.startsWith('#'))
      const title = titleLine ? titleLine.replace(/^#+\s*/, '').trim() : files[i].name.replace(/\.[^.]+$/, '')
      const detected = await ensureAutoCourse(detectedCourses[i] || detectCourseForImport(files[i].name, files[i].content))
      const saved = await createNote(title || '导入笔记', detected.courseId, [], generated)
      savedNotes.push(saved)
      // 将完成状态反馈到文件列表。
      importCourseLabels.value[i] = { label: detected.label, matched: true }
    }
    currentNote.value = savedNotes[savedNotes.length - 1] || null
    showImportDialog.value = false
    importedFiles.value = []
    importCourseLabels.value = []
    await addStudyTime(Math.max(2, savedNotes.length * 2))
  } catch (e: any) {
    importError.value = e.message || '导入整理失败，请检查 API Key 设置'
  } finally {
    importing.value = false
  }
}

const processWithAI = async (rawText: string, detectedCourseId = '', detectedLabel = '') => {
  importing.value = true
  importError.value = ''
  try {
    // 流式生成笔记，实时显示进度
    const generated = await generateNoteFromText(rawText, (chunk) => {
      // 可以在这里更新进度提示
    })
    // 解析 AI 生成的笔记
    const lines = generated.split('\n')
    let title = '导入笔记'
    let content = generated
    // 从第一行 # 标题 提取标题
    const titleLine = lines.find(l => l.startsWith('#'))
    if (titleLine) {
      title = titleLine.replace(/^#+\s*/, '').trim()
    }

    const saved = await createNote(title, detectedCourseId, [], content)
    currentNote.value = saved
    if (detectedLabel) {
      importCourseLabels.value = [{ label: detectedLabel, matched: Boolean(detectedCourseId) }]
    }
    showImportDialog.value = false
    pasteText.value = ''
    importedFiles.value = []

    // 记录学习时间（导入笔记记录10分钟）
    await addStudyTime(10)
  } catch (e: any) {
    importError.value = e.message || 'AI 整理失败，请检查 API Key 设置'
  } finally {
    importing.value = false
  }
}

// ========== AI 知识分析 ==========
// 分析报告会追加到笔记中；再次分析时只取原始内容（去掉旧报告），避免笔记无限膨胀。
const REPORT_MARK = '## 🤖 AI 知识分析报告'
const getRawNoteContent = () => {
  const c = currentNote.value?.content || ''
  const idx = c.indexOf(REPORT_MARK)
  return (idx >= 0 ? c.slice(0, idx) : c).trim()
}

const IMAGE_URI_RE = /!\[[^\]]*\]\((data:image\/[^)]+)\)/g

// 统计内容中的图片数量（data URI 格式）
const countImagesInContent = (c: string) => {
  const matches = c.match(IMAGE_URI_RE)
  return matches ? matches.length : 0
}

// 询问是否读取图片（基于完整笔记内容统计，含旧报告中的图片）；返回 true=读取图片，false=仅文字
const askIncludeImages = async (): Promise<boolean> => {
  const imgCount = countImagesInContent(currentNote.value?.content || '')
  if (imgCount === 0) return true // 无图片直接分析
  const include = await globalShowConfirm({
    title: '是否读取图片',
    message: `笔记中包含 ${imgCount} 张图片。是否将图片一起发送给 AI 分析？\n\n注意：需要模型支持视觉才能识别图片内容（如 GLM-4V、qwen-vl）；当前模型若不支持，将自动降级为仅分析文字。`,
    confirmText: '读取图片',
    cancelText: '仅分析文字',
    danger: false,
  })
  return include
}

// 构建发送给 AI 的内容：
// - 不读图片 → 仅原始文字（去掉旧报告）
// - 读图片 → 原始文字；若原始文字无图但旧报告/笔记中有图，则把图片提取出来附加
const buildAnalyzeInput = (includeImages: boolean): string => {
  const raw = getRawNoteContent()
  if (!includeImages) return raw
  if (countImagesInContent(raw) > 0) return raw
  const full = currentNote.value?.content || ''
  const imgs = full.match(IMAGE_URI_RE)
  return imgs && imgs.length > 0 ? raw + '\n\n' + imgs.join('\n') : raw
}

// 分析笔记。force 为 true（Ctrl/Shift+点击按钮）时忽略缓存强制重新调用 AI。
const aiAnalyzeNote = async (e?: MouseEvent) => {
  if (!currentNote.value) return
  if (!getRawNoteContent()) {
    frontendLogger.warn('NoteOrganize', 'AI分析跳过：笔记内容为空')
    return
  }
  analysisLoadedFromCache.value = false // 主动分析后标记为最新结果
  const force = Boolean(e && (e.ctrlKey || e.shiftKey || e.metaKey))
  const includeImages = await askIncludeImages()
  const rawContent = buildAnalyzeInput(includeImages)
  frontendLogger.info('NoteOrganize', 'AI知识分析开始', {
    contentLength: rawContent.length,
    includeImages,
    force,
  })
  aiAnalyzing.value = true
  noteAnalysis.value = null
  rightPanelTab.value = 'analysis'
  try {
    const result = await analyzeNote(rawContent, includeImages, currentNote.value.id, force)
    frontendLogger.info('NoteOrganize', 'AI知识分析成功', {
      summary: result.summary?.substring(0, 50),
      cardsCount: result.cards?.length,
      keyPointsCount: result.keyPoints?.length,
    })
    noteAnalysis.value = result
    // 记录学习时间
    await addStudyTime(5)

    // ===== 构建嵌入笔记预览区的完整分析报告 =====
    const now = new Date()
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const appendParts: string[] = []

    // 分析报告头部（含时间信息）
    appendParts.push(`\n\n---\n\n## 🤖 AI 知识分析报告\n\n> 📅 分析时间：${timeStr} ｜ 📝 笔记字数：${currentNote.value.content.length} 字\n`)

    // 摘要
    if (result.summary) {
      appendParts.push(`### 📊 内容摘要\n\n${result.summary}\n`)
    }

    // 嵌入知识树 SVG 图
    if (result.tree?.children?.length) {
      appendParts.push(embedTreeInNote(result.tree))
    }

    // 知识卡片
    if (result.cards?.length) {
      appendParts.push(`### 📇 知识卡片\n`)
      for (const card of result.cards) {
        const typeLabel = cardTypeLabel(card.type)
        const diffLabel = difficultyLabel(card.difficulty)
        appendParts.push(`#### ${card.title}\n\n- **类型：** ${typeLabel} ｜ **难度：** ${diffLabel}\n- **内容：** ${card.content}\n`)
      }
    }

    // 公式汇总（仅当内容含公式时）
    if (result.formulas?.length) {
      appendParts.push(`### 🧮 公式汇总\n`)
      for (const f of result.formulas) {
        appendParts.push(`$$\n${f}\n$$\n`)
      }
    }

    // 代码示例（仅当内容含代码时）
    if (result.codeSnippets?.length) {
      appendParts.push(`### 💻 代码示例\n`)
      for (const snip of result.codeSnippets) {
        appendParts.push(snip.description ? `> ${snip.description}\n` : '')
        appendParts.push(`\`\`\`${snip.language || ''}\n${snip.code}\n\`\`\`\n`)
      }
    }

    // 数据图表（仅当内容适合可视化时）
    if (result.charts?.length) {
      appendParts.push(`### 📈 数据图表\n`)
      for (const chart of result.charts) {
        appendParts.push(`**${chart.title}**\n`)
        if (chart.type === 'bar' && chart.labels?.length) {
          const max = Math.max(...(chart.values || []).map(Number).filter(v => !isNaN(v)), 1)
          chart.labels.forEach((label, li) => {
            const v = Number(chart.values?.[li]) || 0
            const barLen = Math.round(v / max * 20)
            appendParts.push(`- ${label}：${'█'.repeat(Math.max(barLen, 1))} ${v}\n`)
          })
        } else if (chart.type === 'pie' && chart.labels?.length) {
          chart.labels.forEach((label, li) => {
            appendParts.push(`- ${label}：${chart.values?.[li] ?? ''}%\n`)
          })
        } else if (chart.type === 'comparison' && chart.rows?.length) {
          const headers = (chart.labels || []).map(l => ` ${l} `).join('|')
          appendParts.push(`| 对比项 |${headers}|\n| --- |${(chart.labels || []).map(() => ' --- ').join('|')}|\n`)
          for (const row of chart.rows) {
            appendParts.push(`| ${row.label} |${row.items.map(i => ` ${i} `).join('|')}|\n`)
          }
        }
        appendParts.push('\n')
      }
    }

    // 核心关键点
    if (result.keyPoints?.length) {
      appendParts.push(`### 🔑 核心关键点\n\n${result.keyPoints.map((k, i) => `${i + 1}. ${k}`).join('\n')}\n`)
    }

    // 学习建议
    if (result.suggestions?.length) {
      appendParts.push(`### 💡 学习建议\n\n${result.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`)
    }

    // 报告尾部时间戳
    appendParts.push(`\n---\n*⏱ 本报告由 AI 于 ${timeStr} 自动生成*\n`)

    if (appendParts.length) {
      // 已有旧报告时替换，避免笔记无限膨胀
      const oldIdx = currentNote.value.content.indexOf(REPORT_MARK)
      const base = oldIdx >= 0 ? currentNote.value.content.slice(0, oldIdx).trimEnd() : currentNote.value.content.trimEnd()
      currentNote.value.content = base + appendParts.join('\n')
      markDirty()
      await saveCurrent()
      // 切换到预览模式查看嵌入的分析报告
      editorMode.value = 'preview'
    }
  } catch (e: any) {
    const errMsg = e?.message || String(e || '未知错误')
    frontendLogger.error('NoteOrganize', 'AI知识分析失败', { error: errMsg, stack: e?.stack })
    // 给用户更友好的错误提示
    if (errMsg.includes('超时') || errMsg.includes('timeout')) {
      showAlert('AI 分析超时', '笔记内容较长，AI 处理超时。\n建议：\n1. 稍后重试\n2. 减少笔记内容长度\n3. 检查网络连接')
    } else if (errMsg.includes('401') || errMsg.includes('403')) {
      showAlert('API Key 无效', 'NVIDIA API Key 验证失败，请检查设置中的 Key 是否正确。')
    } else if (errMsg.includes('429')) {
      showAlert('请求频率超限', 'API 调用频率过高，请稍等几分钟后重试。')
    } else if (errMsg.includes('500') || errMsg.includes('502') || errMsg.includes('503')) {
      showAlert('AI 服务暂时不可用', 'AI 服务器返回错误，请稍后重试。')
    } else {
      showAlert('AI 分析失败', errMsg)
    }
    rightPanelTab.value = 'outline'
  } finally {
    aiAnalyzing.value = false
  }
}

// ========== AI 知识扩展（联网发散补充） ==========
const aiExpandNote = async () => {
  if (!getRawNoteContent()) return
  const includeImages = await askIncludeImages()
  const rawContent = buildAnalyzeInput(includeImages)
  aiExpanding.value = true
  noteExpansion.value = null
  rightPanelTab.value = 'expansion'
  try {
    const result = await expandNote(rawContent, includeImages)
    noteExpansion.value = result
    await addStudyTime(5)
  } catch (e: any) {
    showAlert('AI 扩展失败', e.message || 'AI 知识扩展失败，请检查 API Key 设置')
    rightPanelTab.value = 'outline'
  } finally {
    aiExpanding.value = false
  }
}

// 将扩展内容追加到笔记（以 AI 卡片样式写入，预览模式可见）
const appendExpansionToNote = async () => {
  if (!noteExpansion.value || !currentNote.value) return
  const exp = noteExpansion.value
  let md = ''

  if (exp.expandedTopics?.length) {
    md += '### 扩展知识点\n'
    for (const t of exp.expandedTopics) {
      md += `- **${t.title}**（相关度：${t.relevance}）：${t.content}\n`
    }
    md += '\n'
  }
  if (exp.missingConcepts?.length) {
    md += `### 遗漏概念补充\n${exp.missingConcepts.map(c => `- ${c}`).join('\n')}\n\n`
  }
  if (exp.relatedFormulas?.length) {
    md += `### 相关公式/定理\n${exp.relatedFormulas.map(f => `- ${f}`).join('\n')}\n\n`
  }
  if (exp.realWorldApplications?.length) {
    md += `### 实际应用场景\n${exp.realWorldApplications.map(a => `- ${a}`).join('\n')}\n\n`
  }
  if (exp.deeperTopics?.length) {
    md += `### 深入学习方向\n${exp.deeperTopics.map(d => `- ${d}`).join('\n')}\n\n`
  }

  const cardHtml = buildAiCardHtml('expansion', 'AI 知识扩展', md)
  currentNote.value.content += cardHtml
  markDirty()
  await saveCurrent()
  editorMode.value = 'preview' // 追加后切到预览模式，让用户直接看到卡片效果
  showAlert('已追加到笔记', 'AI 扩展内容已以卡片形式追加到笔记末尾，当前已切换到「预览」模式查看。编辑模式中会显示卡片源码，属正常现象。')
}

// 切换笔记时清空分析结果（仅当笔记 id 变化时清空；保存导致的引用替换不清空，否则刚生成的结果会被误清）
watch(() => currentNote.value?.id, () => {
  stopTTS()
  noteAnalysis.value = null
  noteExpansion.value = null
})

// ========== 课程创建 ==========
const doCreateCourse = async () => {
  if (!newCourseName.value.trim()) return
  try {
    const saved = await createCourse(newCourseName.value.trim(), newCourseColor.value)
    // 自动选中新创建的课程
    selectedCourse.value = saved.id
    // 如果正在编辑笔记，自动关联新课程
    if (currentNote.value && !currentNote.value.courseId) {
      currentNote.value.courseId = saved.id
      markDirty()
    }
    newCourseName.value = ''
    newCourseColor.value = '#FF6B9D'
    showCourseDialog.value = false
  } catch (e: any) {
    showAlert('创建课程失败', e.message || '未知错误')
  }
}

// 从 Dashboard 携带搜索词 / 从侧边栏携带课程筛选
onMounted(() => {
  if (route.query.q && typeof route.query.q === 'string') {
    searchQuery.value = route.query.q
  }
  if (route.query.course && typeof route.query.course === 'string') {
    selectedCourse.value = route.query.course
  }
})

watch(() => route.query.q, (q) => {
  if (q && typeof q === 'string') {
    searchQuery.value = q
  }
})

watch(() => route.query.course, (c) => {
  if (c && typeof c === 'string') {
    selectedCourse.value = c
  }
})

// 初始化时检测语音识别支持
checkSpeechSupport()

// 组件卸载时清理录音资源
onUnmounted(() => {
  if (recognition) {
    try { recognition.stop() } catch (e) { /* ignore */ }
  }
  if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
  stopTTS()
})
</script>

<style scoped>
.note-page { width: 100%; height: 100%; position: relative; overflow: hidden; background: var(--color-bg); }
.content-layer { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; }

/* 笔记列表 */
.note-list-panel { width: 280px; height: 100%; display: flex; flex-direction: column; background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); border-right: 1px solid rgba(255,192,213,0.35); flex-shrink: 0; }
.search-bar { display: flex; gap: 8px; padding: 16px; }
.search-input { flex: 1; height: 36px; padding: 0 14px; background: rgba(255,255,255,0.85); border: 1.5px solid rgba(255,192,213,0.5); border-radius: var(--radius-pill); font-size: 13px; color: var(--color-text); outline: none; transition: all 0.2s; }
.search-input:focus { border-color: var(--color-pink); box-shadow: var(--shadow-glow); }
.new-note-btn { height: 36px; padding: 0 16px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: var(--radius-pill); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; box-shadow: 0 3px 10px rgba(255,107,157,0.25); transition: all 0.2s; }
.new-note-btn:hover { opacity: 0.92; transform: translateY(-1px); }
.new-note-btn:active { transform: scale(0.95); }
/* 左侧列表的"导入"按钮（次要样式，突出"新建"主按钮） */
.new-note-btn.plain { background: rgba(183,148,246,0.14); color: #7A5AF8; border: 1px solid rgba(183,148,246,0.4); box-shadow: none; }
.new-note-btn.plain:hover { background: rgba(183,148,246,0.22); }

.filter-tabs { display: flex; gap: 4px; padding: 0 16px 12px; flex-wrap: wrap; }
.filter-tab { height: 26px; padding: 0 12px; background: transparent; border: 1px solid rgba(255,192,213,0.45); border-radius: var(--radius-pill); font-size: 11px; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; }
.filter-tab:hover { border-color: var(--color-pink); color: var(--color-pink); }
.filter-tab.active { background: var(--color-pink-light); border-color: var(--color-pink); color: var(--color-pink); font-weight: 600; }
.filter-tab.recycle { border-style: dashed; }
.filter-tab.recycle.active { border-style: solid; }

/* 回收站 */
.recycle-body { flex: 1; overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
.recycle-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: var(--color-white); border: 1px dashed rgba(255,192,213,0.5); border-radius: var(--radius-md); }
.recycle-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.recycle-title { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recycle-date { font-size: 11px; color: var(--color-text-muted); }
.recycle-actions { display: flex; gap: 6px; flex-shrink: 0; }
.recycle-btn { height: 26px; padding: 0 12px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid var(--color-border); background: transparent; color: var(--color-text-secondary); transition: all 0.15s; }
.recycle-btn.restore { color: #4292F5; border-color: rgba(66,146,245,0.4); background: rgba(66,146,245,0.06); }
.recycle-btn.restore:hover { background: rgba(66,146,245,0.12); }
.recycle-btn.purge { color: #e74c3c; border-color: rgba(231,76,60,0.4); background: rgba(231,76,60,0.05); }
.recycle-btn.purge:hover { background: rgba(231,76,60,0.12); }
.empty-desc { font-size: 12px; color: var(--color-text-muted); }

.notes-scroll { flex: 1; overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
.note-card { display: flex; gap: 10px; padding: 12px; background: var(--color-white); border: 1px solid rgba(255,192,213,0.35); border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s; }
.note-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); border-color: rgba(255,107,157,0.35); }
.note-card.selected { border-color: var(--color-pink); box-shadow: 0 0 0 3px rgba(255,107,157,0.15); background: linear-gradient(135deg, #fff, rgba(255,192,213,0.12)); }
.note-color-bar { width: 4px; border-radius: var(--radius-pill); flex-shrink: 0; }
.note-card-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.note-card-top { display: flex; gap: 4px; }
.note-card-tag { font-size: 9px; font-weight: 600; color: var(--color-text-tertiary); background: var(--color-bg-soft); padding: 1px 6px; border-radius: 4px; }
.note-card-title { font-size: 13px; font-weight: 600; color: var(--color-text); }
.note-card-date { font-size: 10px; color: var(--color-text-muted); }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 16px; }
.empty-state p { font-size: 13px; color: var(--color-text-muted); }
.empty-btn { padding: 8px 16px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: var(--radius-sm); font-size: 12px; cursor: pointer; }
.empty-btn-text { background: none; border: none; color: var(--color-pink); font-size: 12px; cursor: pointer; text-decoration: underline; }

/* 编辑器 */
.editor-panel { flex: 1; height: 100%; display: flex; flex-direction: column; background: rgba(255,255,255,0.4); overflow: hidden; }
.editor-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
.editor-title { flex: 1; min-width: 160px; height: 34px; font-size: 18px; font-weight: 700; color: var(--color-text); background: transparent; border: none; outline: none; }
.editor-title::placeholder { color: var(--color-text-muted); }
.editor-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.editor-btn { height: 30px; padding: 0 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; border: none; white-space: nowrap; line-height: 1; display: inline-flex; align-items: center; }
.editor-btn.import { background: rgba(183,148,246,0.12); color: #7A5AF8; border: 1px solid rgba(183,148,246,0.35); }
.editor-btn.import:hover { background: rgba(183,148,246,0.2); }
.editor-btn.save { background: var(--gradient-pink-purple); color: white; }
.editor-btn.save:disabled { opacity: 0.4; cursor: not-allowed; }
.editor-btn.save:not(:disabled):hover { opacity: 0.9; }
.editor-btn.ai { background: rgba(66,146,245,0.1); color: #4292F5; border: 1px solid rgba(66,146,245,0.3); }
.editor-btn.ai:disabled { opacity: 0.5; }
.editor-btn.ai:hover:not(:disabled) { background: rgba(66,146,245,0.15); }
.editor-btn.danger { background: transparent; color: #e74c3c; border: 1px solid #e74c3c33; }
.editor-btn.danger:hover { background: #e74c3c0f; }

.editor-tags { display: flex; align-items: center; gap: 6px; padding: 0 24px 8px; flex-wrap: wrap; }
.tag-chip { display: flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; background: var(--color-pink-light); border-radius: var(--radius-pill); font-size: 11px; color: var(--color-pink); }
.tag-remove { background: none; border: none; color: var(--color-pink); cursor: pointer; font-size: 14px; line-height: 1; padding: 0; opacity: 0.6; }
.tag-remove:hover { opacity: 1; }
.tag-input { height: 24px; width: 80px; background: transparent; border: 1px dashed var(--color-border); border-radius: var(--radius-pill); font-size: 11px; padding: 0 8px; color: var(--color-text-secondary); outline: none; }
.tag-input:focus { border-color: var(--color-pink); border-style: solid; }

.editor-course-select { display: flex; align-items: center; gap: 8px; padding: 0 24px 8px; font-size: 12px; color: var(--color-text-secondary); }
.editor-course-select select { height: 28px; padding: 0 8px; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: 4px; font-size: 12px; color: var(--color-text); outline: none; }
.add-course-btn { height: 28px; padding: 0 10px; background: none; border: 1px dashed var(--color-border); border-radius: 4px; font-size: 11px; color: var(--color-text-tertiary); cursor: pointer; }
.add-course-btn:hover { border-color: var(--color-pink); color: var(--color-pink); }

.editor-body { flex: 1; padding: 14px 20px; background: transparent; border: none; outline: none; resize: none; font-size: 14px; line-height: 1.8; color: var(--color-text); font-family: inherit; }
.editor-body::placeholder { color: var(--color-text-muted); }

.editor-preview { flex: 1; padding: 14px 20px; overflow-y: auto; font-size: 14px; line-height: 1.8; color: var(--color-text); }

/* TTS 朗读控制条 */
.tts-bar { display: flex; align-items: center; gap: 8px; padding: 6px 20px 8px; flex-wrap: wrap; }
.tts-btn {
  display: inline-flex; align-items: center; gap: 5px;
  height: 26px; padding: 0 12px;
  background: transparent; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 11px;
  color: var(--color-text-secondary); cursor: pointer;
  transition: all 0.2s;
}
.tts-btn:hover { border-color: var(--color-pink); color: var(--color-pink); background: rgba(255, 107, 157, 0.08); }
.tts-btn.tts-primary { background: linear-gradient(120deg, var(--color-pink), var(--color-purple)); border: none; color: #fff; font-weight: 600; }
.tts-btn.tts-primary:hover { opacity: 0.9; filter: brightness(1.05); }
.tts-rate { display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; }
.tts-rate-label { font-size: 11px; color: var(--color-text-muted); }
.tts-rate-btn {
  height: 22px; padding: 0 8px;
  background: transparent; border: 1px solid var(--color-border);
  border-radius: var(--radius-xs, 6px); font-size: 10px;
  color: var(--color-text-secondary); cursor: pointer;
}
.tts-rate-btn.active { background: linear-gradient(120deg, rgba(255, 107, 157, 0.18), rgba(183, 148, 246, 0.18)); border-color: var(--color-purple); color: var(--color-purple); font-weight: 600; }
.tts-progress { font-size: 11px; color: var(--color-text-muted); margin-left: auto; }

/* 朗读中高亮的段落 */
.editor-preview :deep(.reading) {
  background: linear-gradient(120deg, rgba(255, 107, 157, 0.18), rgba(183, 148, 246, 0.18));
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(255, 107, 157, 0.35);
}

.editor-mode-tabs { display: flex; gap: 4px; padding: 0 20px 8px; align-items: center; }
.mode-tab { height: 26px; padding: 0 12px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 11px; color: var(--color-text-secondary); cursor: pointer; }
.mode-tab.active { background: var(--color-pink-light); border-color: var(--color-pink); color: var(--color-pink); font-weight: 600; }
.mode-tab.img-btn { display: flex; align-items: center; gap: 4px; margin-left: auto; color: var(--color-text-tertiary); }
.mode-tab.img-btn:hover { border-color: var(--color-pink); color: var(--color-pink); }

/* 一键截屏 */
.capture-group { display: flex; align-items: center; border: 1px solid rgba(255,107,157,0.35); border-radius: 6px; overflow: hidden; }
.capture-group .capture-btn { margin-left: 0; border: none; border-radius: 0; height: 24px; }
.capture-group .capture-btn:hover { background: var(--color-pink-light); }
.capture-arrow { width: 18px; height: 24px; background: rgba(255,107,157,0.08); border: none; border-left: 1px solid rgba(255,107,157,0.25); color: var(--color-pink); font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.capture-arrow:hover { background: var(--color-pink-light); }

/* 截屏选择面板 */
.capture-box { max-width: 640px; width: 640px; }
.modal-sub { font-size: 12px; color: var(--color-text-secondary); margin: 4px 0 14px; line-height: 1.6; }
.capture-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-height: 380px; overflow-y: auto; padding: 2px; }
.capture-item { border: 2px solid transparent; border-radius: 10px; overflow: hidden; cursor: pointer; background: var(--color-white); transition: all 0.15s; }
.capture-item:hover { border-color: rgba(255,107,157,0.5); transform: translateY(-1px); }
.capture-item.active { border-color: var(--color-pink); box-shadow: 0 0 0 3px rgba(255,107,157,0.15); }
.capture-thumb { width: 100%; height: 110px; object-fit: cover; background: #0f0f14; display: block; }
.capture-thumb.empty { background: linear-gradient(135deg, #2a2a3a, #1a1a28); }
.capture-name { display: block; padding: 7px 10px; font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 字号调节 */
.font-size-control { display: flex; align-items: center; gap: 2px; margin-left: 8px; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: 6px; padding: 1px 4px; }
.font-size-btn { width: 22px; height: 20px; background: none; border: none; font-size: 12px; font-weight: 700; color: var(--color-text-secondary); cursor: pointer; line-height: 1; border-radius: 4px; }
.font-size-btn:hover { background: var(--color-pink-light); color: var(--color-pink); }
.font-size-val { font-size: 10px; color: var(--color-text-muted); min-width: 30px; text-align: center; }

/* Markdown 工具栏 */
.editor-footer { display: flex; align-items: center; gap: 12px; padding: 8px 24px; border-top: 1px solid var(--color-border); font-size: 11px; color: var(--color-text-muted); }
.unsaved { color: #e74c3c; }
.saved { color: #26D0A8; }

/* 无选中状态 */
.no-selection { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.no-sel-icon { margin-bottom: 8px; }
.no-sel-title { font-size: 16px; font-weight: 600; color: var(--color-text-secondary); }
.no-sel-desc { font-size: 13px; color: var(--color-text-muted); text-align: center; max-width: 320px; }
.no-sel-actions { display: flex; gap: 12px; margin-top: 8px; }
.no-sel-btn { padding: 10px 20px; background: rgba(255,255,255,0.8); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; color: var(--color-text-secondary); display: flex; align-items: center; gap: 6px; }
.no-sel-btn.primary { background: var(--gradient-pink-purple); color: white; border: none; }
.no-sel-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }

/* 右侧大纲 + 知识分析面板 */
.outline-panel { width: 330px; height: 100%; display: flex; flex-direction: column; padding: 18px 16px; background: rgba(255,255,255,0.6); border-left: 1px solid var(--color-border); flex-shrink: 0; overflow-y: auto; }
.outline-header { margin-bottom: 12px; }
.outline-tabs { display: flex; gap: 4px; }
.outline-tab { flex: 1; height: 30px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 12px; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
.outline-tab.active { background: var(--color-pink-light); border-color: var(--color-pink); color: var(--color-pink); font-weight: 600; }
.cache-badge { display: inline-block; margin-left: 5px; padding: 1px 7px; border-radius: var(--radius-pill); background: rgba(38,208,168,0.14); border: 1px solid rgba(38,208,168,0.4); color: #26D0A8; font-size: 9px; font-weight: 700; vertical-align: 1px; }
.outline-body { display: flex; flex-direction: column; gap: 6px; }
.outline-item { font-size: 12.5px; color: var(--color-text-secondary); padding: 6px 0 6px 12px; border-left: 2px solid var(--color-border); line-height: 1.5; }
.outline-item.heading { font-weight: 600; color: var(--color-text); border-left-color: var(--color-pink); }
.outline-empty { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 20px 0; }

/* 知识分析面板 */
.analysis-body { display: flex; flex-direction: column; gap: 16px; }
.analysis-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0; }
.analysis-empty-text { font-size: 12px; color: var(--color-text-muted); }
.analysis-loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0; }
.analysis-loading p { font-size: 12px; color: var(--color-text-secondary); }
.analysis-loading .loading-spinner { width: 28px; height: 28px; border: 3px solid var(--color-border); border-top-color: var(--color-pink); border-radius: 50%; animation: spin 0.8s linear infinite; }

.analysis-result { display: flex; flex-direction: column; gap: 20px; }
.analysis-section { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: rgba(255,255,255,0.55); border: 1px solid var(--color-border); border-radius: 12px; }
.analysis-section-title { font-size: 13px; font-weight: 700; color: var(--color-text); }
.analysis-summary { font-size: 12px; line-height: 1.7; color: var(--color-text-secondary); padding: 10px 12px; background: rgba(255,107,157,0.06); border-radius: 8px; border: 1px solid rgba(255,107,157,0.12); }

/* 知识卡片 */
.knowledge-cards { display: flex; flex-direction: column; gap: 10px; }
.knowledge-card { padding: 14px; border-radius: 10px; border: 1px solid var(--color-border); background: white; transition: all 0.15s; }
.knowledge-card:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.knowledge-card.concept { border-left: 3px solid #4292F5; }
.knowledge-card.formula { border-left: 3px solid #FF6B9D; }
.knowledge-card.definition { border-left: 3px solid #26D0A8; }
.knowledge-card.example { border-left: 3px solid #FF9948; }
.knowledge-card.keypoint { border-left: 3px solid #B794F6; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.card-type-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
.card-type-badge.concept { background: rgba(66,146,245,0.12); color: #4292F5; }
.card-type-badge.formula { background: rgba(255,107,157,0.12); color: #FF6B9D; }
.card-type-badge.definition { background: rgba(38,208,168,0.12); color: #26D0A8; }
.card-type-badge.example { background: rgba(255,153,72,0.12); color: #FF9948; }
.card-type-badge.keypoint { background: rgba(183,148,246,0.12); color: #B794F6; }
.card-difficulty { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
.card-difficulty.easy { background: rgba(38,208,168,0.1); color: #26D0A8; }
.card-difficulty.medium { background: rgba(255,153,72,0.1); color: #FF9948; }
.card-difficulty.hard { background: rgba(231,76,60,0.1); color: #e74c3c; }
.card-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 5px; }
.card-content { font-size: 12.5px; line-height: 1.7; color: var(--color-text-secondary); }

/* 公式汇总 */
.formula-list { display: flex; flex-direction: column; gap: 8px; }
.formula-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,107,157,0.06); border: 1px solid rgba(255,107,157,0.2); border-radius: 8px; }
.formula-badge { font-size: 10px; font-weight: 600; color: #FF6B9D; background: rgba(255,107,157,0.1); padding: 2px 8px; border-radius: 8px; flex-shrink: 0; }
.formula-text { font-size: 13px; font-family: 'Cambria Math', Georgia, serif; color: var(--color-text); overflow-x: auto; }

/* 代码示例 */
.code-snippet-list { display: flex; flex-direction: column; gap: 10px; }
.code-snippet-item { border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.03); }
.code-snippet-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,0,0,0.05); border-bottom: 1px solid var(--color-border); }
.code-lang-badge { font-size: 10px; font-weight: 600; color: #4292F5; background: rgba(66,146,245,0.1); padding: 2px 8px; border-radius: 8px; }
.code-desc { font-size: 11px; color: var(--color-text-muted); }
.code-snippet-body { padding: 12px 14px; margin: 0; font-size: 12px; line-height: 1.7; font-family: 'Consolas', 'Courier New', monospace; color: var(--color-text); overflow-x: auto; white-space: pre-wrap; word-break: break-all; }

/* 数据图表 */
.chart-list { display: flex; flex-direction: column; gap: 12px; }
.chart-card { padding: 14px; border: 1px solid rgba(255,192,213,0.4); border-radius: 12px; background: var(--color-white); box-shadow: var(--shadow-sm); }
.chart-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 10px; }

/* 关键点 */
.key-points-list { display: flex; flex-direction: column; gap: 8px; }
.key-point-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: rgba(255,255,255,0.6); border-radius: 8px; }
.key-point-num { width: 20px; height: 20px; border-radius: 50%; background: var(--gradient-pink-purple); color: white; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.key-point-text { font-size: 12.5px; color: var(--color-text); line-height: 1.6; }

/* 学习建议 */
.suggestions-list { display: flex; flex-direction: column; gap: 8px; }
.suggestion-item { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; background: rgba(255,255,255,0.6); border-radius: 8px; }
.suggestion-icon { color: var(--color-pink); font-weight: 700; flex-shrink: 0; }
.suggestion-text { font-size: 12.5px; color: var(--color-text); line-height: 1.6; }

/* 知识扩展 */

/* ========== 知识扩展样式 ========== */
.editor-btn.expand { background: var(--gradient-pink-purple); color: white; }
.editor-btn.expand:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,107,157,0.3); }

/* 导出按钮 */
.editor-btn.export { background: rgba(66,146,245,0.1); color: #4292F5; border: 1px solid rgba(66,146,245,0.3); }
.editor-btn.export:hover:not(:disabled) { background: rgba(66,146,245,0.16); transform: translateY(-1px); }

.append-btn { width: 100%; padding: 10px 16px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 16px; transition: all 0.15s; }
.append-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,107,157,0.3); }

.expansion-topics { display: flex; flex-direction: column; gap: 10px; }
.expansion-topic { padding: 12px; border-radius: 10px; border-left: 3px solid #ddd; background: var(--color-bg-soft); }
.expansion-topic.high { border-left-color: #e74c3c; }
.expansion-topic.medium { border-left-color: #f39c12; }
.expansion-topic.low { border-left-color: #27ae60; }
.topic-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.topic-relevance-tag { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
.topic-relevance-tag.high { background: rgba(231,76,60,0.12); color: #e74c3c; }
.topic-relevance-tag.medium { background: rgba(243,156,18,0.12); color: #f39c12; }
.topic-relevance-tag.low { background: rgba(39,174,96,0.12); color: #27ae60; }
.topic-title { font-size: 13px; font-weight: 700; color: var(--color-text); margin: 0; }
.topic-content { font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; margin: 0; }

.missing-concepts { display: flex; flex-direction: column; gap: 8px; }
.missing-concept-item { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; background: rgba(231,76,60,0.06); border-radius: 8px; border: 1px solid rgba(231,76,60,0.12); }
.missing-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #e74c3c; color: white; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.missing-text { font-size: 12px; color: var(--color-text); line-height: 1.5; }

.formulas-list { display: flex; flex-direction: column; gap: 8px; }
.formula-item { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; background: rgba(155,89,182,0.06); border-radius: 8px; border: 1px solid rgba(155,89,182,0.12); }
.formula-icon { color: #9b59b6; font-size: 16px; font-weight: 700; flex-shrink: 0; }
.formula-text { font-size: 12px; color: var(--color-text); line-height: 1.5; font-family: 'Cambria Math', serif; }

.applications-list { display: flex; flex-direction: column; gap: 8px; }
.application-item { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; background: rgba(52,152,219,0.06); border-radius: 8px; border: 1px solid rgba(52,152,219,0.12); }
.app-icon { color: #3498db; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.app-text { font-size: 12px; color: var(--color-text); line-height: 1.5; }

.deeper-list { display: flex; flex-direction: column; gap: 8px; }
.deeper-item { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; background: rgba(39,174,96,0.06); border-radius: 8px; border: 1px solid rgba(39,174,96,0.12); }
.deeper-num { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: #27ae60; color: white; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.deeper-text { font-size: 12px; color: var(--color-text); line-height: 1.5; }

/* 模态框 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); }
.modal-box { background: white; border-radius: 16px; padding: 28px; width: 520px; max-width: 90vw; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); position: relative; z-index: 10000; }
.modal-box.small { width: 380px; }
.modal-title { font-size: 18px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; }
.modal-desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 20px; }
.modal-input { width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--color-border) !important; border-radius: 8px; font-size: 14px; color: var(--color-text); outline: none; margin-bottom: 16px; background: #fff; -webkit-appearance: none; appearance: none; -webkit-user-select: text; user-select: text; cursor: text; }
.modal-input:focus { border-color: var(--color-pink) !important; box-shadow: 0 0 0 3px rgba(255,107,157,0.1); }

.import-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.import-tab { flex: 1; height: 36px; border: 1px solid var(--color-border); background: transparent; border-radius: 8px; font-size: 13px; color: var(--color-text-secondary); cursor: pointer; }
.import-tab.active { background: var(--color-pink-light); border-color: var(--color-pink); color: var(--color-pink); font-weight: 600; }

.import-file-area { text-align: center; padding: 20px; }
.import-file-btn { padding: 12px 24px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.import-file-btn:disabled { opacity: 0.5; }
.import-hint { font-size: 12px; color: var(--color-text-muted); margin-top: 12px; }

.import-paste-area { margin-bottom: 16px; }
.paste-textarea { width: 100%; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 13px; line-height: 1.6; color: var(--color-text); outline: none; resize: vertical; font-family: inherit; }
.paste-textarea:focus { border-color: var(--color-pink); }

.imported-files { margin-bottom: 16px; text-align: left; }
.import-queue-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 13px; color: var(--color-text-secondary); }
.queue-clear-btn { border: none; background: transparent; color: #B794F6; font-size: 12px; cursor: pointer; padding: 4px 0; }
.queue-clear-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.imported-file-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 12px; background: var(--color-bg-soft); border-radius: 8px; margin-bottom: 4px; }
.file-course { font-size: 11px; font-weight: 600; color: #26A982; white-space: nowrap; }
.file-course.pending { color: #B794F6; }
.file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-name { font-size: 13px; color: var(--color-text); font-weight: 500; }
.file-size { font-size: 11px; color: var(--color-text-muted); }

.importing-status { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; }
.importing-status p { font-size: 14px; color: var(--color-text-secondary); }
.loading-spinner { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-pink); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.import-error { padding: 12px; background: rgba(231,76,60,0.08); border: 1px solid rgba(231,76,60,0.2); border-radius: 8px; font-size: 13px; color: #e74c3c; margin-bottom: 16px; }

.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.modal-btn { height: 36px; padding: 0 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
.modal-btn.cancel { background: var(--color-bg-soft); color: var(--color-text-secondary); }
.modal-btn.confirm { background: var(--gradient-pink-purple); color: white; }
.modal-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.modal-btn:hover:not(:disabled) { transform: translateY(-1px); }

.color-picker { display: flex; gap: 10px; margin-bottom: 16px; }
.color-dot { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.15s; }
.color-dot.selected { border-color: var(--color-text); transform: scale(1.1); }

/* 自定义确认/提示弹窗 */
.modal-box.tiny { width: 360px; }
.confirm-message { font-size: 14px; line-height: 1.6; color: var(--color-text-secondary); margin-bottom: 8px; }
.modal-btn.danger-btn { background: #e74c3c; color: white; }
.modal-btn.danger-btn:hover { background: #c0392b; transform: translateY(-1px); }

/* 音频导入区域 */
.audio-import-area { text-align: center; padding: 20px; }
.audio-source-picker { display: flex; gap: 10px; margin-bottom: 16px; }
.audio-source-picker.disabled { opacity: 0.5; pointer-events: none; }
.audio-source-option { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 10px; background: var(--color-bg-soft); border: 2px solid transparent; border-radius: 10px; cursor: pointer; transition: all 0.15s; font-size: 13px; color: var(--color-text-secondary); }
.audio-source-option:hover:not(:disabled) { border-color: var(--color-primary-light, #B794F6); }
.audio-source-option.active { border-color: #FF6B9D; background: rgba(255,107,157,0.08); color: var(--color-text); }
.audio-source-option.active strong { color: #FF6B9D; }
.audio-source-option strong { font-size: 14px; color: var(--color-text); }
.audio-source-option span { font-size: 11px; }
.audio-source-option:disabled { cursor: not-allowed; }
.audio-record-section { display: flex; justify-content: center; gap: 12px; margin-bottom: 16px; }
.audio-file-btn { padding: 12px 24px; background: var(--gradient-pink-purple); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.audio-file-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.audio-file-btn.stop { background: #e74c3c; animation: pulse-red 1.5s infinite; }
.audio-file-btn:hover:not(:disabled) { transform: translateY(-1px); }
.audio-hint { font-size: 12px; color: var(--color-text-muted); margin-top: 12px; line-height: 1.5; }
.audio-selected-file { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--color-bg-soft); border-radius: 8px; margin-top: 12px; font-size: 13px; color: var(--color-text); }
.audio-selected-file .file-icon { font-size: 20px; }

.recording-indicator { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px; margin-bottom: 12px; }
.recording-pulse { width: 12px; height: 12px; border-radius: 50%; background: #e74c3c; animation: pulse-red 1s infinite; }
.recording-indicator span { font-size: 13px; color: #e74c3c; font-weight: 600; }
@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(231,76,60,0.5); }
  70% { box-shadow: 0 0 0 10px rgba(231,76,60,0); }
  100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
}

.audio-transcript-preview { text-align: left; margin-top: 16px; }
.audio-transcript-label { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 6px; }
</style>
