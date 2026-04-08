/**
 * Voice Designer — WorkflowService hooks
 *
 * Registers ElevenLabs TTS and assistant voice config endpoints.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const yaml = container.feature('yaml')
  const fs = container.feature('fs')

  function discoverVoiceAssistants() {
    const manager = container.feature('assistantsManager') as any
    const results: any[] = []
    for (const entry of (manager.list?.() || [])) {
      if (!entry.hasVoice) continue
      try {
        const inst = container.feature('assistant', { folder: entry.folder } as any)
        if (inst.voiceConfig) {
          results.push({
            name: entry.name,
            folder: entry.folder,
            voiceConfig: inst.voiceConfig,
            assistant: inst,
          })
        }
      } catch {}
    }
    return results
  }

  // ── Endpoints ──────────────────────────────────────────────────────────────

  app.get('/api/voices', async (_req: any, res: any) => {
    try {
      const el = container.client('elevenlabs') as any
      if (!el.state.get('connected')) await el.connect()
      const voices = await el.listVoices()
      res.json({ voices })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/synthesize', async (req: any, res: any) => {
    try {
      const { text, voiceId, voiceSettings, conversationModePrefix, modelId } = req.body || {}
      if (!text || !voiceId) {
        return res.status(400).json({ error: 'text and voiceId are required' })
      }
      const el = container.client('elevenlabs') as any
      if (!el.state.get('connected')) await el.connect()
      const audio = await el.synthesize(
        conversationModePrefix ? `${conversationModePrefix} ${text}` : text,
        { voiceId, modelId: modelId || 'eleven_v3', voiceSettings: voiceSettings || {} },
      )
      res.setHeader('Content-Type', 'audio/mpeg')
      res.send(Buffer.from(audio))
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/assistants/:name/voice', async (req: any, res: any) => {
    try {
      const { name } = req.params
      const assistants = discoverVoiceAssistants()
      const assistant = assistants.find((a: any) => a.name === name)
      if (!assistant) return res.status(404).json({ error: `Assistant "${name}" not found` })
      const voicePath = assistant.assistant.paths.join('voice.yaml')
      const content = yaml.stringify(req.body)
      await fs.writeFileAsync(voicePath, content)
      res.json({ ok: true, config: req.body })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── VoiceBox proxy endpoints ────────────────────────────────────────────────

  const VOICEBOX_URL = process.env.VOICEBOX_URL || 'http://127.0.0.1:17493'

  app.get('/api/voicebox/health', async (_req: any, res: any) => {
    try {
      const vb = container.client('voicebox') as any
      if (!vb.state.get('connected')) await vb.connect()
      res.json({ ok: true })
    } catch {
      res.json({ ok: false })
    }
  })

  app.get('/api/voicebox/profiles', async (_req: any, res: any) => {
    try {
      const vb = container.client('voicebox') as any
      if (!vb.state.get('connected')) await vb.connect()
      const profiles = await vb.listProfiles()
      res.json({ profiles })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/voicebox/effects', async (_req: any, res: any) => {
    try {
      const vb = container.client('voicebox') as any
      if (!vb.state.get('connected')) await vb.connect()
      const result = await vb.listEffects()
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/voicebox/synthesize', async (req: any, res: any) => {
    try {
      const { text, profileId, engine, modelSize, language, instruct } = req.body || {}
      if (!text || !profileId) {
        return res.status(400).json({ error: 'text and profileId are required' })
      }
      const vb = container.client('voicebox') as any
      if (!vb.state.get('connected')) await vb.connect()
      const audio = await vb.synthesize(text, { profileId, engine, modelSize, language, instruct })
      res.setHeader('Content-Type', 'audio/wav')
      res.send(Buffer.from(audio))
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
}
