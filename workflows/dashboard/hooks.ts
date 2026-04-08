import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, chatService, container, wss }: WorkflowHooksSetupContext) {
  // ── Voice dictation WebSocket (separate port to avoid upgrade conflict) ──
  const voicePort = await (container as any).networking.findOpenPort(7710)

  app.get('/api/workflows/dashboard/config', (_req: any, res: any) => {
    res.json({ voiceWsPort: voicePort })
  })

  const voiceWss = container.server('websocket', { json: true }) as any
  await voiceWss.start({ port: voicePort })

  voiceWss.on('message', async (msg: any, voiceWs: any) => {
    if (msg?.type !== 'start_voice') return

    let listener: any
    try {
      listener = container.feature('voiceListener')
    } catch {
      voiceWss.send(voiceWs, { type: 'voice_error', message: 'voiceListener not available' })
      return
    }

    const send = (data: object) => {
      try { voiceWss.send(voiceWs, data) } catch {}
    }

    const onVu = (level: number) => send({ type: 'voice_vu', level })
    const onStart = () => send({ type: 'voice_recording' })
    const onStop = () => send({ type: 'voice_transcribing' })
    const onPreview = (text: string) => send({ type: 'voice_preview', text })

    listener.on('vu', onVu)
    listener.on('recording:start', onStart)
    listener.on('recording:stop', onStop)
    listener.on('preview', onPreview)

    send({ type: 'voice_listening' })

    try {
      const transcript = await listener.listen({ silenceTimeout: msg.silenceTimeout ?? 3 })
      send({ type: 'voice_complete', text: transcript })
    } catch (err: any) {
      send({ type: 'voice_error', message: String(err?.message ?? err) })
    } finally {
      listener.off('vu', onVu)
      listener.off('recording:start', onStart)
      listener.off('recording:stop', onStop)
      listener.off('preview', onPreview)
    }
  })
}
