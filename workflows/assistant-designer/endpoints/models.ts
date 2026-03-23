export const path = '/api/models'
export const description = 'List available models from Anthropic and optionally LM Studio'

export async function get(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals

  const results: Array<{ id: string; name: string; provider: string }> = []

  // Anthropic models (hardcoded since Anthropic doesn't have a list endpoint)
  results.push(
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4', provider: 'anthropic' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', provider: 'anthropic' },
    { id: 'claude-opus-4-20250514', name: 'Opus 4', provider: 'anthropic' },
  )

  // OpenAI models
  try {
    const openai = container.client('openai')
    const modelsPage = await openai.listModels()
    const models = modelsPage?.data || modelsPage || []

    for (const m of models) {
      if (m.id) {
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
      if (m.id) {
        results.push({ id: m.id, name: m.id, provider: 'lm-studio' })
      }
    }
  } catch {
    // LM Studio not running — skip
  }

  return { models: results }
}
