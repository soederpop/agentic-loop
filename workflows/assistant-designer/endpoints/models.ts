export const path = '/api/models'
export const description = 'List available models from OpenAI and LM Studio'

// Heuristic filter: only show models likely to support chat completions.
// This is prefix-based and may need updating as new model families ship.
// LM Studio models bypass this filter since all loaded models are chat-capable.
const OPENAI_CHAT_PREFIXES = ['gpt-3.5-turbo', 'gpt-4', 'gpt-5', 'o1', 'o3', 'o4']
function isChatModel(id: string): boolean {
  if (/^(dall-e|tts-|whisper|text-embedding|omni-moderation|sora|chatgpt-image|gpt-image|ft:)/.test(id)) return false
  if (/(transcribe|tts|realtime|audio|search|deep-research|codex|computer-use)/.test(id)) return false
  return OPENAI_CHAT_PREFIXES.some(p => id.startsWith(p))
}

export async function get(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals

  const results: Array<{ id: string; name: string; provider: string }> = []

  // OpenAI models (filtered to chat-capable only)
  try {
    const openai = container.client('openai')
    const modelsPage = await openai.listModels()
    const models = modelsPage?.data || modelsPage || []

    for (const m of models) {
      if (m.id && isChatModel(m.id)) {
        results.push({ id: m.id, name: m.id, provider: 'openai' })
      }
    }
  } catch {
    // No OpenAI key or unreachable — skip
  }

  // LM Studio at localhost:1234
  try {
    const lmStudio = container.client('openai', {
      baseURL: 'http://localhost:1234/v1',
      apiKey: 'lm-studio',
    })
    const modelsPage = await lmStudio.listModels()
    const models = modelsPage?.data || modelsPage || []

    for (const m of models) {
      if (m.id && !m.id.startsWith('text-embedding')) {
        results.push({ id: m.id, name: m.id, provider: 'lm-studio' })
      }
    }
  } catch {
    // LM Studio not running — skip
  }

  return { models: results }
}
