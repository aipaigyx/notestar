// AI 调用模块：平台配置 / 模型路由 / OpenAI 兼容调用 / 多模态构建
// 通过 createAIModule 注入依赖（logger、getProxyAgent），保持模块可测。
const https = require('https')
const { extractImageURIs, replaceImagesWithPlaceholders } = require('./ai-utils.cjs')

const AI_PLATFORMS = {
  deepseek: {
    hostname: 'api.deepseek.com',
    apiPath: '/chat/completions',
    defaultModel: 'deepseek-chat',
  },
  openai: {
    hostname: 'api.openai.com',
    apiPath: '/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
  zhipu: {
    hostname: 'open.bigmodel.cn',
    apiPath: '/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
  },
  qwen: {
    hostname: 'dashscope.aliyuncs.com',
    apiPath: '/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-turbo',
  },
  moonshot: {
    hostname: 'api.moonshot.cn',
    apiPath: '/v1/chat/completions',
    defaultModel: 'moonshot-v1-8k',
  },
  nvidia: {
    hostname: 'integrate.api.nvidia.com',
    apiPath: '/v1/chat/completions',
    defaultModel: 'meta/llama-3.1-8b-instruct',
  },
  local: {
    hostname: '127.0.0.1',
    port: 11434,
    apiPath: '/v1/chat/completions',
    defaultModel: 'qwen2.5:7b-instruct',
    protocol: 'http',
    noAuth: true,
  },
}

const VISION_CAPABLE_MODELS = [
  // NVIDIA NIM 视觉模型
  'llava', 'vila', 'neva', 'fuyu', 'kosmos', 'nvclip', 'nemotron-nano-vl',
  'nemotron-embed-vl', 'nemoretriever', 'phi-3-vision',
  'llama-3.2-11b-vision', 'llama-3.2-90b-vision',
  // 其他平台视觉模型
  'qwen2-vl', 'qwen2.5-vl', 'pixtral', 'llama-3.2-vision',
  'gpt-4o', 'gpt-4-vision', 'claude-3', 'gemini', 'glm-4v',
]

function isVisionCapableModel(model) {
  if (!model) return false
  const modelLower = model.toLowerCase()
  return VISION_CAPABLE_MODELS.some(v => modelLower.includes(v))
}

// 判断模型是否支持多模态（视觉）
const RETRYABLE_NETWORK_CODES = new Set(['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE'])
const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableAIError(error) {
  return Boolean(error && (RETRYABLE_NETWORK_CODES.has(error.code) || RETRYABLE_HTTP_STATUS.has(error.statusCode)))
}

// 按功能路由模型：operation -> chat 对话 / generateNote 快速整理 / 其他(analyzeNote|expandNote|summarize) 深度分析
function resolveModelConfig(settings, operation = 'chat') {
  const routing = settings.modelRouting
  if (!routing) return settings
  const route = operation === 'chat'
    ? routing.chat
    : (operation === 'generateNote' ? routing.quick : routing.deep)
  if (!route || !route.model) return settings
  const platform = AI_PLATFORMS[route.provider] || AI_PLATFORMS[settings.provider] || AI_PLATFORMS.deepseek
  return {
    ...settings,
    provider: route.provider || settings.provider,
    model: route.model,
    apiKey: route.provider === 'local' ? '' : (route.apiKey || settings.apiKey),
    hostname: route.hostname || settings.hostname || platform.hostname,
    apiPath: route.apiPath || settings.apiPath || platform.apiPath,
  }
}

// 从笔记 Markdown 构建多模态消息：
// - 无图 → 纯文本；用户不读图或模型不支持视觉 → 降级纯文本；支持视觉 → 文字+图片
function buildMultimodalContent(noteContent, model, includeImages = true) {
  const images = extractImageURIs(noteContent)

  if (images.length === 0) {
    return { hasImages: false, textContent: noteContent, content: noteContent }
  }

  if (!includeImages || !isVisionCapableModel(model)) {
    return { hasImages: false, textContent: replaceImagesWithPlaceholders(noteContent), content: replaceImagesWithPlaceholders(noteContent) }
  }

  const textOnly = noteContent.replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, '\n').trim()
  const contentParts = []
  if (textOnly) {
    contentParts.push({ type: 'text', text: textOnly })
  }
  for (const img of images) {
    contentParts.push({ type: 'image_url', image_url: { url: img.dataUri } })
  }
  return { hasImages: true, textContent: textOnly, content: contentParts }
}

function createAIModule({ logger, getProxyAgent }) {
  async function callAIWithRetry(settings, messages, onChunk, options = {}) {
    settings = resolveModelConfig(settings, options.operation || 'chat')
    const model = settings.model || (AI_PLATFORMS[settings.provider || 'deepseek'] || AI_PLATFORMS.deepseek).defaultModel
    const shouldProtectGlm = settings.provider === 'nvidia' && model === 'z-ai/glm-5.2'
    const maxAttempts = shouldProtectGlm ? 3 : 1
    let lastError

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          const delayMs = attempt === 2 ? 2000 : 5000
          logger.warn('AI', '云端瞬时故障，等待后重试同一模型', { model, operation: options.operation || 'chat', attempt, maxAttempts, delayMs })
          await sleep(delayMs)
        }
        return await callAI(settings, messages, onChunk, { ...options, attempt, maxAttempts })
      } catch (error) {
        lastError = error
        if (!isRetryableAIError(error) || attempt === maxAttempts) break
        logger.warn('AI', '可重试的云端请求失败', { model, operation: options.operation || 'chat', attempt, code: error.code, statusCode: error.statusCode, message: error.message })
      }
    }

    if (shouldProtectGlm && isRetryableAIError(lastError)) {
      throw new Error('z-ai/glm-5.2 当前云端实例未及时响应，已自动重试 3 次仍失败。模型未被替换；请稍后重新发送。')
    }
    throw lastError
  }

  function callAI(settings, messages, onChunk, { outputTokens = 2048, operation = 'chat', attempt = 1, maxAttempts = 1 } = {}) {
    return new Promise((resolve, reject) => {
      if (!settings.apiKey && settings.provider !== 'local') { reject(new Error('未配置 API Key，请先在设置中填写')); return }

      settings = resolveModelConfig(settings, operation)
      const provider = settings.provider || 'deepseek'
      const platform = AI_PLATFORMS[provider] || AI_PLATFORMS.deepseek
      const model = settings.model || platform.defaultModel
      const startedAt = Date.now()
      let firstByteAt = null

      const reqBody = {
        model,
        messages,
        stream: !!onChunk,
        temperature: 0.7,
        max_tokens: Math.min(Math.max(outputTokens, 128), 4096),
      }

      if (provider === 'nvidia') {
        reqBody.top_p = 1
        reqBody.seed = 42
      }

      const reqData = JSON.stringify(reqBody)
      const isLocal = platform.protocol === 'http' || provider === 'local'
      const httpMod = isLocal ? require('http') : https
      const port = platform.port || (isLocal ? 80 : 443)
      const options = {
        hostname: platform.hostname,
        port,
        path: platform.apiPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(reqData),
        },
      }
      if (!platform.noAuth) {
        options.headers['Authorization'] = `Bearer ${settings.apiKey}`
      }

      if (!isLocal) {
        const proxyAgent = getProxyAgent()
        if (proxyAgent) options.agent = proxyAgent
      }

      logger.info('AI', `调用 ${provider}`, {
        operation, model, hostname: platform.hostname, port, stream: !!onChunk,
        attempt, maxAttempts, maxTokens: reqBody.max_tokens, requestBytes: Buffer.byteLength(reqData),
      })

      const req = httpMod.request(options, (res) => {
        firstByteAt = Date.now()
        const firstByteMs = firstByteAt - startedAt
        if (res.statusCode !== 200) {
          let body = ''
          res.on('data', c => body += c)
          res.on('end', () => {
            logger.error('AI', `HTTP ${res.statusCode} 错误响应`, { provider, operation, status: res.statusCode, firstByteMs, body: body.substring(0, 500) })
            const error = new Error(`${provider} API 返回 ${res.statusCode}: ${body.substring(0, 300)}`)
            error.statusCode = res.statusCode
            reject(error)
          })
          return
        }

        if (onChunk) {
          // SSE 数据可能跨 TCP chunk 分割，必须保留不完整行后再解析。
          let fullText = ''
          let buffer = ''
          let firstTokenAt = null
          let sawReasoning = false
          res.setEncoding('utf-8')
          res.on('data', (chunk) => {
            buffer += chunk
            const lines = buffer.split(/\r?\n/)
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const json = line.slice(6).trim()
              if (json === '[DONE]') continue
              try {
                const parsed = JSON.parse(json)
                const delta = parsed.choices?.[0]?.delta || {}
                if (delta.reasoning_content) sawReasoning = true
                if (delta.content) {
                  if (!firstTokenAt) {
                    firstTokenAt = Date.now()
                    logger.info('AI', '首个输出片段到达', { provider, operation, model, firstByteMs, firstTokenMs: firstTokenAt - startedAt })
                  }
                  fullText += delta.content
                  onChunk(delta.content)
                }
              } catch (e) {
                logger.warn('AI', '忽略无效 SSE 数据片段', { operation, error: e.message })
              }
            }
          })
          res.on('end', () => {
            logger.info('AI', '流式调用完成', {
              provider, operation, model, firstByteMs, firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
              totalMs: Date.now() - startedAt, resultLength: fullText.length,
            })
            if (!fullText && sawReasoning) {
              const err = new Error(`模型 ${model} 把输出额度全部用于思考，未生成回答内容。请改用非推理模型（如 deepseek-chat）或在设置中更换模型。`)
              err.statusCode = 200
              reject(err)
              return
            }
            resolve(fullText)
          })
        } else {
          let body = ''
          res.on('data', c => body += c)
          res.on('end', () => {
            try {
              const result = JSON.parse(body)
              const message = result.choices?.[0]?.message || {}
              const content = message.content || ''
              const reasoningLen = (message.reasoning_content || '').length
              if (!content && reasoningLen > 0) {
                logger.warn('AI', '模型输出全部用于思考，回答为空', {
                  provider, operation, model, reasoningLen,
                  finish: result.choices?.[0]?.finish_reason,
                })
                const err = new Error(`模型 ${model} 把输出额度全部用于思考，未生成回答内容。请改用非推理模型（如 deepseek-chat）或在设置中更换模型。`)
                err.statusCode = 200
                reject(err)
                return
              }
              logger.info('AI', '非流式调用完成', { provider, operation, model, firstByteMs, totalMs: Date.now() - startedAt, resultLength: content.length })
              resolve(content)
            } catch (e) { reject(e) }
          })
        }
      })

      req.on('error', (err) => {
        logger.error('AI', 'HTTP请求错误', { provider, operation, model, elapsedMs: Date.now() - startedAt, message: err.message, code: err.code })
        reject(err)
      })
      const timeoutMs = isLocal ? 600000 : 90000
      req.setTimeout(timeoutMs, () => {
        logger.error('AI', `请求超时 ${timeoutMs / 1000}s`, { provider, operation, model, elapsedMs: Date.now() - startedAt })
        const timeoutError = new Error(isLocal ? '本地模型响应超时，请检查 Ollama 是否在运行、模型是否已下载。' : '请求超过90秒仍未响应。免费云端模型可能正在排队，请稍后重试。')
        timeoutError.code = 'ETIMEDOUT'
        req.destroy(timeoutError)
        reject(timeoutError)
      })
      req.write(reqData)
      req.end()
    })
  }

  return { callAI, callAIWithRetry, buildMultimodalContent, isVisionCapableModel, resolveModelConfig, AI_PLATFORMS }
}

module.exports = { createAIModule, AI_PLATFORMS, isVisionCapableModel, buildMultimodalContent, resolveModelConfig }
