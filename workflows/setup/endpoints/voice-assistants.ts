export const path = '/api/voice-assistants'
export const description = 'List assistants with voice.yaml status'
export const tags = ['setup']

export async function get(_params: any, ctx: any) {
  const { fs } = ctx.request.app.locals
  const container = ctx.container

  const assistantsDir = container.paths.resolve('assistants')
  const assistants: any[] = []
  if (fs.existsSync(assistantsDir)) {
    const dirs = fs.readdirSync(assistantsDir).filter((d: string) =>
      !d.startsWith('.') && fs.existsSync(container.paths.resolve('assistants', d, 'CORE.md'))
    )
    const yaml = container.feature('yaml')
    for (const d of dirs) {
      const voicePath = container.paths.resolve('assistants', d, 'voice.yaml')
      const hasVoice = fs.existsSync(voicePath)
      let voiceId: string | undefined
      let aliases: string[] | undefined
      if (hasVoice) {
        try {
          const raw = fs.readFileSync(voicePath, 'utf-8')
          const parsed = yaml.parse(raw)
          voiceId = parsed?.voiceId || parsed?.voice_id
          aliases = parsed?.aliases || parsed?.wakeWords
        } catch { /* skip parse errors */ }
      }
      assistants.push({ name: d, hasVoice, voiceId, aliases })
    }
  }
  return { assistants }
}
