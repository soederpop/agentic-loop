export const path = '/api/synthesize'
export const description = 'Generate a test phrase via ElevenLabs TTS'
export const tags = ['voice-designer']

export async function post(_params: any, ctx: any) {
  const container = ctx.container
  const { text, voiceId, voiceSettings, conversationModePrefix, modelId } = ctx.body

  if (!text || !voiceId) {
    ctx.response.status(400)
    return { error: 'text and voiceId are required' }
  }

  const el = container.client('elevenlabs')
  if (!el.state.get('connected')) await el.connect()

  const audio = await el.synthesize(
    conversationModePrefix ? `${conversationModePrefix} ${text}` : text,
    {
      voiceId,
      modelId: modelId || 'eleven_v3',
      voiceSettings: voiceSettings || {},
    },
  )

  ctx.response.set('Content-Type', 'audio/mpeg')
  ctx.response.send(Buffer.from(audio))
}
