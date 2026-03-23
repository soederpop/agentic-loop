export const path = '/api/voices'
export const description = 'List available ElevenLabs voices'
export const tags = ['voice-designer']

export async function get(_params: any, ctx: any) {
  const el = ctx.container.client('elevenlabs')
  if (!el.state.get('connected')) await el.connect()
  const voices = await el.listVoices()
  return { voices }
}
