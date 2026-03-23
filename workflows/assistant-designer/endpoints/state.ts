export const path = '/api/state'
export const description = 'Get or update the assistant designer state'

export async function get(_params: any, ctx: any) {
  const { designerState } = ctx.request.app.locals
  return {
    systemPrompt: designerState.systemPrompt,
    tools: designerState.tools,
    model: designerState.model,
    provider: designerState.provider,
    maxTokens: designerState.maxTokens,
    temperature: designerState.temperature,
    messageCount: designerState.messages.length,
  }
}

export async function put(_params: any, ctx: any) {
  const { designerState } = ctx.request.app.locals
  const body = ctx.request.body || {}

  if (body.systemPrompt !== undefined) designerState.systemPrompt = body.systemPrompt
  if (body.model !== undefined) designerState.model = body.model
  if (body.provider !== undefined) designerState.provider = body.provider
  if (body.maxTokens !== undefined) designerState.maxTokens = body.maxTokens
  if (body.temperature !== undefined) designerState.temperature = body.temperature
  if (body.tools !== undefined) designerState.tools = body.tools

  return { ok: true }
}
