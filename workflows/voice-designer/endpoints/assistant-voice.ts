export const path = '/api/assistants/:name/voice'
export const description = 'Update an assistant voice.yaml config'
export const tags = ['voice-designer']

export async function put(_params: any, ctx: any) {
  const { discoverAssistants, yaml, fs } = ctx.request.app.locals
  const { name } = ctx.params

  const assistants = discoverAssistants()
  const assistant = assistants.find((a: any) => a.name === name)
  if (!assistant) {
    ctx.response.status(404)
    return { error: `Assistant "${name}" not found` }
  }

  const voicePath = assistant.assistant.paths.join('voice.yaml')
  const newConfig = ctx.body

  const content = yaml.stringify(newConfig)
  await fs.writeFileAsync(voicePath, content)

  return { ok: true, config: newConfig }
}
