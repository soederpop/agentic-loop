import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')

  // Serve enriched assistant data with ABOUT.md content and voice config
  app.get('/api/workflows/assistant-gallery/assistants', async (_req: any, res: any) => {
    try {
      const assistantsManager = container.feature('assistantsManager') as any
      const list = assistantsManager.list?.() || []

      const assistants = await Promise.all(
        list.map(async (e: any) => {
          const shortName = (e.name || '').replace(/^assistants\//, '')
          const folder = e.folder || ''
          const entry: any = { id: shortName, name: shortName, hasVoice: !!e.hasVoice, folder }

          // Read ABOUT.md
          try {
            const aboutPath = container.paths.join(folder, 'ABOUT.md')
            entry.about = await fs.readFile(aboutPath)
          } catch {
            entry.about = ''
          }

          // Read voice config
          if (e.hasVoice) {
            try {
              const inst = container.feature('assistant', { folder } as any) as any
              if (inst.voiceConfig) entry.voiceConfig = inst.voiceConfig
            } catch {}
          }

          return entry
        })
      )

      res.json({ assistants })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Spawn a web-chat window for a given assistant
  app.post('/api/workflows/assistant-gallery/launch-chat', async (req: any, res: any) => {
    try {
      const { assistant } = req.body || {}
      if (!assistant) return res.status(400).json({ error: 'assistant name required' })

      const assistantsManager = container.feature('assistantsManager') as any
      const available = assistantsManager.available || []

      if (!available.includes(assistant)) {
        return res.status(404).json({ error: `Assistant "${assistant}" not found`, available })
      }

      let pid = 'unknown'
      container.proc.spawnAndCapture('luca', ['web-chat', '--assistant', assistant], {
        onStart(c: any) {
          if (c?.pid) pid = `${c.pid}`
        },
      })
      await container.sleep(3000)

      res.json({ ok: true, assistant, pid })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
}
