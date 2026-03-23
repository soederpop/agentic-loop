export const path = '/api/export'
export const description = 'Export the current assistant config as JSON'

export async function get(_params: any, ctx: any) {
  const { designerState } = ctx.request.app.locals

  return {
    model: designerState.model,
    system: designerState.systemPrompt,
    max_tokens: designerState.maxTokens,
    temperature: designerState.temperature,
    tools: designerState.tools.map((t: any) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    })),
  }
}
