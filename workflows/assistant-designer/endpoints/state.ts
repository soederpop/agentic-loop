export const path = '/api/state'
export const description = 'Get or update the assistant designer state'

export async function get(_params: any, ctx: any) {
  const { designerState, getAssistant } = ctx.request.app.locals
  const assistant = getAssistant()

  return {
    assistantName: designerState.assistantName,
    systemPrompt: designerState.systemPrompt,
    tools: designerState.tools,
    hooksSource: designerState.hooksSource,
    model: designerState.model,
    provider: designerState.provider,
    maxTokens: designerState.maxTokens,
    temperature: designerState.temperature,
    deployed: !!assistant,
    messageCount: assistant?.messages?.length || 0,
  }
}

const VALID_PROVIDERS = ['openai', 'lm-studio']

export async function put(_params: any, ctx: any) {
  const { designerState } = ctx.request.app.locals
  const body = ctx.request.body || {}

  if (body.assistantName !== undefined) {
    const name = String(body.assistantName).trim()
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      ctx.response.status(400)
      return { error: 'assistantName must be alphanumeric with dashes/underscores' }
    }
    designerState.assistantName = name
  }

  if (body.provider !== undefined) {
    if (!VALID_PROVIDERS.includes(body.provider)) {
      ctx.response.status(400)
      return { error: `Invalid provider "${body.provider}". Must be one of: ${VALID_PROVIDERS.join(', ')}` }
    }
    designerState.provider = body.provider
  }

  if (body.model !== undefined) {
    if (typeof body.model !== 'string' || !body.model.trim()) {
      ctx.response.status(400)
      return { error: 'model must be a non-empty string' }
    }
    designerState.model = body.model
  }

  if (body.maxTokens !== undefined) {
    const mt = Number(body.maxTokens)
    if (!Number.isInteger(mt) || mt < 1 || mt > 128000) {
      ctx.response.status(400)
      return { error: 'maxTokens must be an integer between 1 and 128000' }
    }
    designerState.maxTokens = mt
  }

  if (body.temperature !== undefined) {
    const t = Number(body.temperature)
    if (isNaN(t) || t < 0 || t > 2) {
      ctx.response.status(400)
      return { error: 'temperature must be a number between 0 and 2' }
    }
    designerState.temperature = t
  }

  if (body.systemPrompt !== undefined) designerState.systemPrompt = body.systemPrompt
  if (body.hooksSource !== undefined) designerState.hooksSource = body.hooksSource
  if (body.tools !== undefined && Array.isArray(body.tools)) designerState.tools = body.tools

  return { ok: true }
}
