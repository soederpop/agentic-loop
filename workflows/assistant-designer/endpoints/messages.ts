export const path = '/api/messages'
export const description = 'Get or clear the conversation history from the deployed assistant'

export async function get(_params: any, ctx: any) {
  const { getAssistant } = ctx.request.app.locals
  const assistant = getAssistant()
  if (!assistant) return { messages: [] }
  return { messages: assistant.messages || [] }
}

const del = async (_params: any, ctx: any) => {
  const { getAssistant, setAssistant, container, designerState } = ctx.request.app.locals
  const assistant = getAssistant()

  if (assistant) {
    // Recreate to get a fresh conversation
    try {
      assistant.removeAllListeners()
      const folder = container.paths.resolve('assistants', designerState.assistantName)
      const fresh = container.feature('assistant', {
        folder,
        model: designerState.model,
        maxTokens: designerState.maxTokens,
        local: designerState.provider === 'lm-studio',
      })
      await fresh.start()
      setAssistant(fresh)
    } catch {}
  }

  return { ok: true }
}

export { del as delete }
