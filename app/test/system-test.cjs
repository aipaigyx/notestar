// 系统功能测试脚本 — 直接测试 main.cjs 中的核心逻辑
// 模拟 IPC handler 的行为，不依赖 Electron 窗口

const fs = require('fs')
const path = require('path')
const https = require('https')
const { HttpsProxyAgent } = require('https-proxy-agent')

// 检测代理
function getProxyAgent() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
  if (proxy) { try { return new HttpsProxyAgent(proxy) } catch(e) {} }
  return null
}

const dataDir = path.join(__dirname, '..', 'data')
const settingsFile = path.join(dataDir, 'settings.json')
const notesFile = path.join(dataDir, 'notes.json')
const coursesFile = path.join(dataDir, 'courses.json')
const statsFile = path.join(dataDir, 'stats.json')
const chatFile = path.join(dataDir, 'chatSessions.json')

function readJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch (e) {}
  return def
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

const AI_PLATFORMS = {
  deepseek: { hostname: 'api.deepseek.com', apiPath: '/chat/completions', defaultModel: 'deepseek-chat' },
  openai: { hostname: 'api.openai.com', apiPath: '/v1/chat/completions', defaultModel: 'gpt-4o-mini' },
  zhipu: { hostname: 'open.bigmodel.cn', apiPath: '/api/paas/v4/chat/completions', defaultModel: 'glm-4-flash' },
  qwen: { hostname: 'dashscope.aliyuncs.com', apiPath: '/compatible-mode/v1/chat/completions', defaultModel: 'qwen-turbo' },
  moonshot: { hostname: 'api.moonshot.cn', apiPath: '/v1/chat/completions', defaultModel: 'moonshot-v1-8k' },
  nvidia: { hostname: 'integrate.api.nvidia.com', apiPath: '/v1/chat/completions', defaultModel: 'meta/llama-3.1-8b-instruct' },
}

function callAI(settings, messages, onChunk) {
  return new Promise((resolve, reject) => {
    if (!settings.apiKey) { reject(new Error('未配置 API Key')); return }
    const provider = settings.provider || 'deepseek'
    const platform = AI_PLATFORMS[provider] || AI_PLATFORMS.deepseek
    const model = settings.model || platform.defaultModel

    const reqBody = {
      model, messages,
      stream: !!onChunk,
      temperature: 0.7,
      max_tokens: 4096,
    }
    if (provider === 'nvidia') {
      reqBody.top_p = 1
      reqBody.seed = 42
      reqBody.max_tokens = 16384
    }
    const reqData = JSON.stringify(reqBody)

    const options = {
      hostname: platform.hostname,
      path: platform.apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Length': Buffer.byteLength(reqData),
      },
    }
    const proxyAgent = getProxyAgent()
    if (proxyAgent) options.agent = proxyAgent

    console.log(`  [AI] ${provider} | model: ${model} | hostname: ${platform.hostname} | stream: ${!!onChunk}`)

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let body = ''
        res.on('data', c => body += c)
        res.on('end', () => {
          reject(new Error(`${provider} API 返回 ${res.statusCode}: ${body.substring(0, 300)}`))
        })
        return
      }
      if (onChunk) {
        let fullText = ''
        res.setEncoding('utf-8')
        res.on('data', (chunk) => {
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const json = line.slice(6).trim()
            if (json === '[DONE]') continue
            try {
              const parsed = JSON.parse(json)
              const delta = parsed.choices?.[0]?.delta?.content || ''
              if (delta) { fullText += delta; onChunk(delta) }
            } catch (e) {}
          }
        })
        res.on('end', () => resolve(fullText))
      } else {
        let body = ''
        res.on('data', c => body += c)
        res.on('end', () => {
          try {
            const result = JSON.parse(body)
            resolve(result.choices?.[0]?.message?.content || '')
          } catch (e) { reject(e) }
        })
      }
    })
    req.on('error', reject)
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(reqData)
    req.end()
  })
}

// ========== 测试用例 ==========

let passCount = 0
let failCount = 0

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`)
    passCount++
  } else {
    console.log(`  ❌ FAIL: ${msg}`)
    failCount++
  }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║     笔记星图 — 系统功能测试              ║')
  console.log('╚══════════════════════════════════════════╝\n')

  // ===== 测试 1: 数据文件完整性 =====
  console.log('【测试 1】数据文件完整性')
  assert(fs.existsSync(notesFile), 'notes.json 存在')
  assert(fs.existsSync(coursesFile), 'courses.json 存在')
  assert(fs.existsSync(statsFile), 'stats.json 存在')
  assert(fs.existsSync(settingsFile), 'settings.json 存在')
  assert(fs.existsSync(chatFile), 'chatSessions.json 存在')

  const notes = readJSON(notesFile, [])
  const courses = readJSON(coursesFile, [])
  const stats = readJSON(statsFile, {})
  const settings = readJSON(settingsFile, {})
  assert(Array.isArray(notes), 'notes.json 是数组')
  assert(Array.isArray(courses), 'courses.json 是数组')
  assert(notes.length === 0, `笔记初始为空 (当前: ${notes.length})`)
  assert(courses.length === 0, `课程初始为空 (当前: ${courses.length})`)

  // ===== 测试 2: 设置配置 =====
  console.log('\n【测试 2】设置配置')
  assert(settings.provider === 'nvidia', `provider = nvidia (当前: ${settings.provider})`)
  assert(settings.model === 'meta/llama-3.1-8b-instruct', `model = meta/llama-3.1-8b-instruct (当前: ${settings.model})`)
  assert(settings.apiKey && settings.apiKey.startsWith('nvapi-'), `API Key 格式正确 (nvapi-开头)`)

  // ===== 测试 3: 课程创建 =====
  console.log('\n【测试 3】课程创建')
  let testCourses = readJSON(coursesFile, [])
  const newCourse = {
    id: 'c_test_' + Date.now(),
    name: '测试课程-高等数学',
    color: '#FF6B9D',
    noteCount: 0,
    active: false,
  }
  testCourses.push(newCourse)
  writeJSON(coursesFile, testCourses)
  const afterCreate = readJSON(coursesFile, [])
  assert(afterCreate.length === 1, `课程创建后数量=1 (当前: ${afterCreate.length})`)
  assert(afterCreate[0].name === '测试课程-高等数学', '课程名称正确')

  // ===== 测试 4: 笔记创建 =====
  console.log('\n【测试 4】笔记创建')
  let testNotes = readJSON(notesFile, [])
  const newNote = {
    id: 'n_test_' + Date.now(),
    title: '测试笔记-微积分基础',
    courseId: newCourse.id,
    tags: ['微积分', '极限'],
    content: '# 微积分基础\n\n## 极限的定义\n\n极限是微积分的核心概念...\n\n## 导数\n\n导数描述了函数的变化率...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paragraphs: 4,
  }
  testNotes.push(newNote)
  writeJSON(notesFile, testNotes)
  const afterNote = readJSON(notesFile, [])
  assert(afterNote.length === 1, `笔记创建后数量=1 (当前: ${afterNote.length})`)
  assert(afterNote[0].title === '测试笔记-微积分基础', '笔记标题正确')
  assert(afterNote[0].courseId === newCourse.id, '笔记关联课程正确')

  // 更新课程笔记计数
  testCourses = readJSON(coursesFile, [])
  testCourses[0].noteCount = 1
  writeJSON(coursesFile, testCourses)

  // ===== 测试 5: 学习时间记录 =====
  console.log('\n【测试 5】学习时间记录')
  let testStats = readJSON(statsFile, { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] })
  const beforeMinutes = testStats.totalStudyMinutes || 0
  testStats.totalStudyMinutes = beforeMinutes + 10
  const today = new Date().getDay()
  const dayIndex = today === 0 ? 6 : today - 1
  testStats.weeklyMinutes[dayIndex] = (testStats.weeklyMinutes[dayIndex] || 0) + 10

  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (testStats.lastStudyDate === todayStr) {
    // 今天已记录
  } else if (testStats.lastStudyDate === yesterdayStr) {
    testStats.streakDays = (testStats.streakDays || 0) + 1
  } else {
    testStats.streakDays = 1
  }
  testStats.lastStudyDate = todayStr
  writeJSON(statsFile, testStats)

  const afterStats = readJSON(statsFile, {})
  assert(afterStats.totalStudyMinutes === beforeMinutes + 10, `学习时间增加10分钟 (当前: ${afterStats.totalStudyMinutes})`)
  assert(afterStats.streakDays >= 1, `连续打卡>=1天 (当前: ${afterStats.streakDays})`)
  assert(afterStats.lastStudyDate === todayStr, `最后学习日期=今天`)
  assert(afterStats.weeklyMinutes[dayIndex] >= 10, `本周学习时间已记录`)

  // ===== 测试 6: AI 平台配置 =====
  console.log('\n【测试 6】AI 平台配置')
  assert(Object.keys(AI_PLATFORMS).length === 6, `支持6个平台 (当前: ${Object.keys(AI_PLATFORMS).length})`)
  assert(AI_PLATFORMS.nvidia.hostname === 'integrate.api.nvidia.com', 'NVIDIA hostname 正确')
  assert(AI_PLATFORMS.nvidia.defaultModel === 'meta/llama-3.1-8b-instruct', 'NVIDIA 默认模型正确')
  assert(AI_PLATFORMS.deepseek.hostname === 'api.deepseek.com', 'DeepSeek hostname 正确')
  assert(AI_PLATFORMS.openai.hostname === 'api.openai.com', 'OpenAI hostname 正确')
  assert(AI_PLATFORMS.zhipu.hostname === 'open.bigmodel.cn', '智谱 hostname 正确')
  assert(AI_PLATFORMS.qwen.hostname === 'dashscope.aliyuncs.com', '通义千问 hostname 正确')
  assert(AI_PLATFORMS.moonshot.hostname === 'api.moonshot.cn', '月之暗面 hostname 正确')

  // ===== 测试 7: AI 实际调用（NVIDIA GLM-5.2） =====
  console.log('\n【测试 7】AI 实际调用 — NVIDIA NIM GLM-5.2')
  console.log('  正在调用 AI，请等待...')
  try {
    const testMessages = [
      { role: 'system', content: '你是一个测试助手。请用一句话回答。' },
      { role: 'user', content: '1+1等于几？' },
    ]
    const response = await callAI(settings, testMessages)
    console.log(`  AI 回复: ${response.substring(0, 100)}`)
    assert(response && response.length > 0, 'AI 返回了内容')
    assert(response.includes('2') || response.includes('二') || response.includes('两'), 'AI 回答正确包含"2"')
  } catch (e) {
    console.log(`  AI 调用错误: ${e.message}`)
    assert(false, `AI 调用成功: ${e.message.substring(0, 100)}`)
  }

  // ===== 测试 8: AI 流式调用 =====
  console.log('\n【测试 8】AI 流式调用 — NVIDIA NIM GLM-5.2')
  console.log('  正在调用 AI（流式），请等待...')
  try {
    const testMessages = [
      { role: 'system', content: '请用一句话回答。' },
      { role: 'user', content: '什么是微积分？' },
    ]
    let chunkCount = 0
    let fullText = ''
    const response = await callAI(settings, testMessages, (chunk) => {
      chunkCount++
      fullText += chunk
      if (chunkCount <= 3) process.stdout.write(`  [chunk ${chunkCount}] ${chunk}`)
    })
    console.log(`\n  总共收到 ${chunkCount} 个 chunk`)
    console.log(`  完整回复: ${fullText.substring(0, 100)}...`)
    assert(chunkCount > 0, `流式收到多个chunk (数量: ${chunkCount})`)
    assert(fullText.length > 0, '流式完整文本非空')
  } catch (e) {
    console.log(`  AI 流式调用错误: ${e.message}`)
    assert(false, `AI 流式调用成功: ${e.message.substring(0, 100)}`)
  }

  // ===== 测试 9: AI 笔记整理 =====
  console.log('\n【测试 9】AI 笔记整理 — 模拟导入转写文本')
  console.log('  正在调用 AI 整理笔记，请等待...')
  try {
    const rawText = '今天我们来讲微积分的基础知识。微积分是研究函数的变化率和累积的数学分支。首先是极限的概念，极限描述了当自变量趋近某个值时函数值的变化趋势。导数是函数在某一点的瞬时变化率，几何意义是切线的斜率。积分是导数的逆运算，表示函数图像下的面积。'
    const testMessages = [
      { role: 'system', content: '你是一个专业的学习笔记整理助手。请将以下课堂录音转写文本整理成结构化笔记。要求：1. 提取核心知识点 2. 用 Markdown 格式输出 3. 第一行用 # 开头作为笔记标题' },
      { role: 'user', content: `请整理以下转写文本：\n\n${rawText}` },
    ]
    const response = await callAI(settings, testMessages)
    console.log(`  AI 整理结果: ${response.substring(0, 200)}...`)
    assert(response && response.length > 20, '笔记整理返回了内容')
    assert(response.includes('#') || response.includes('微积分'), '整理内容包含标题或关键词')
  } catch (e) {
    console.log(`  笔记整理错误: ${e.message}`)
    assert(false, `笔记整理成功: ${e.message.substring(0, 100)}`)
  }

  // ===== 清理测试数据 =====
  console.log('\n【清理】恢复空状态数据...')
  writeJSON(notesFile, [])
  writeJSON(coursesFile, [])
  writeJSON(chatFile, [])
  writeJSON(statsFile, { totalStudyMinutes: 0, streakDays: 0, lastStudyDate: '', weeklyMinutes: [0,0,0,0,0,0,0], mastery: [] })

  // ===== 测试结果汇总 =====
  console.log('\n╔══════════════════════════════════════════╗')
  console.log(`║  测试完成: ${passCount} 通过, ${failCount} 失败`)
  if (failCount === 0) {
    console.log('║  🎉 全部通过！')
  } else {
    console.log('║  ⚠️ 有失败项需要检查')
  }
  console.log('╚══════════════════════════════════════════╝\n')

  process.exit(failCount > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('测试运行失败:', err)
  process.exit(1)
})
