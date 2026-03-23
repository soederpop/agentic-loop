export const path = '/api/assistants'
export const description = 'List voice-enabled assistants'
export const tags = ['voice-designer']

export async function get(_params: any, ctx: any) {
  const { discoverAssistants } = ctx.request.app.locals
  const assistants = discoverAssistants()
  return {
    assistants: assistants.map((a: any) => ({
      name: a.name,
      folder: a.folder,
      voiceConfig: a.voiceConfig,
    })),
  }
}
