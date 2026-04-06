/**
 * Wake Word Setup — WorkflowService hooks
 *
 * Endpoints for recording samples, building rustpotter models,
 * testing sensitivity, and assigning wake words to assistants.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'
import type { ChildProcess } from 'child_process'

export async function onSetup({ app, container, wss }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')
  const proc = container.feature('proc')
  const yaml = container.feature('yaml')
  const samplesDir = container.paths.resolve('voice', 'wakeword', 'samples')
  const modelsDir = container.paths.resolve('voice', 'wakeword', 'models')

  fs.ensureFolder(samplesDir)
  fs.ensureFolder(modelsDir)

  /** Slugify a phrase: "hey friday" → "hey_friday" */
  function slugify(phrase: string): string {
    return phrase.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  }

  // ── Dependency check ────────────────────────────────────────────────────────

  app.get('/api/wakeword/dependencies', async (_req: any, res: any) => {
    const deps: Record<string, { installed: boolean; path?: string }> = {}

    for (const bin of ['rustpotter', 'sox', 'mlx_whisper']) {
      try {
        const result = proc.exec(`which ${bin}`).trim()
        deps[bin] = { installed: !!result, path: result || undefined }
      } catch {
        deps[bin] = { installed: false }
      }
    }

    res.json({ deps, allInstalled: Object.values(deps).every(d => d.installed) })
  })

  // ── Samples management ──────────────────────────────────────────────────────

  app.get('/api/wakeword/samples', async (_req: any, res: any) => {
    try {
      const entries = await fs.readdir(samplesDir)
      const wavFiles = entries.filter((e: string) => e.endsWith('.wav')).sort()
      const samples = wavFiles.map((name: string) => ({
        name,
        path: `${samplesDir}/${name}`,
      }))
      res.json({ samples })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/wakeword/samples', async (_req: any, res: any) => {
    try {
      const entries = await fs.readdir(samplesDir)
      for (const name of entries) {
        if (name.endsWith('.wav')) {
          fs.rm(`${samplesDir}/${name}`)
        }
      }
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Serve sample audio files for playback
  app.get('/api/wakeword/samples/:filename/audio', async (req: any, res: any) => {
    try {
      const filePath = `${samplesDir}/${req.params.filename}`
      if (!fs.exists(filePath)) return res.status(404).json({ error: 'Sample not found' })
      const data = fs.readFile(filePath, { encoding: null })
      res.setHeader('Content-Type', 'audio/wav')
      res.send(Buffer.from(data))
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Recording ───────────────────────────────────────────────────────────────

  app.post('/api/wakeword/record', async (req: any, res: any) => {
    try {
      const { phrase, sampleIndex } = req.body || {}
      if (!phrase) return res.status(400).json({ error: 'phrase is required' })

      const slug = slugify(phrase)
      const idx = sampleIndex || 1
      const filename = `${slug}_${idx}.wav`
      const outputPath = `${samplesDir}/${filename}`

      // Record 2 seconds of audio
      const cmd = `rustpotter record --ms 2000 "${outputPath}"`
      proc.exec(cmd)

      // Verify file was created
      if (!fs.exists(outputPath)) {
        return res.status(500).json({ error: 'Recording failed — no file created' })
      }

      res.json({ ok: true, filename, path: outputPath })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Model building ──────────────────────────────────────────────────────────

  app.get('/api/wakeword/models', async (_req: any, res: any) => {
    try {
      const entries = await fs.readdir(modelsDir)
      const models = entries
        .filter((e: string) => e.endsWith('.rpw'))
        .map((name: string) => ({
          name: name.replace('.rpw', '').replace(/_/g, ' '),
          filename: name,
          path: `${modelsDir}/${name}`,
        }))
      res.json({ models })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/wakeword/build', async (req: any, res: any) => {
    try {
      const { phrase } = req.body || {}
      if (!phrase) return res.status(400).json({ error: 'phrase is required' })

      const slug = slugify(phrase)
      const modelPath = `${modelsDir}/${slug}.rpw`

      // Find all sample WAVs for this phrase
      const entries = await fs.readdir(samplesDir)
      const sampleFiles = entries
        .filter((e: string) => e.startsWith(`${slug}_`) && e.endsWith('.wav'))
        .sort()
        .map((e: string) => `${samplesDir}/${e}`)

      if (sampleFiles.length === 0) {
        return res.status(400).json({ error: `No samples found for "${phrase}"` })
      }

      const cmd = `rustpotter build --name "${phrase}" --path "${modelPath}" ${sampleFiles.map((f: string) => `"${f}"`).join(' ')}`
      const output = proc.exec(cmd)

      if (!fs.exists(modelPath)) {
        return res.status(500).json({ error: 'Model build failed', output })
      }

      res.json({ ok: true, modelPath, sampleCount: sampleFiles.length, output })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/wakeword/models/:filename', async (req: any, res: any) => {
    try {
      const filePath = `${modelsDir}/${req.params.filename}`
      if (fs.exists(filePath)) fs.rm(filePath)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Test model against a sample file ────────────────────────────────────────

  app.post('/api/wakeword/test-sample', async (req: any, res: any) => {
    try {
      const { modelFilename, sampleFilename } = req.body || {}
      if (!modelFilename || !sampleFilename) {
        return res.status(400).json({ error: 'modelFilename and sampleFilename are required' })
      }

      const modelPath = `${modelsDir}/${modelFilename}`
      const samplePath = `${samplesDir}/${sampleFilename}`

      if (!fs.exists(modelPath)) return res.status(404).json({ error: 'Model not found' })
      if (!fs.exists(samplePath)) return res.status(404).json({ error: 'Sample not found' })

      const cmd = `rustpotter test -t 0.35 -e -m 5 -g --band-pass "${modelPath}" "${samplePath}" 2>&1`
      const output = proc.exec(cmd)

      // Parse detection results
      const lines = output.split('\n')
      const detections = lines
        .filter((l: string) => l.includes('detection'))
        .map((l: string) => {
          const nameMatch = l.match(/name:\s*"([^"]+)"/)
          const scoreMatch = l.match(/(?<![a-z_])score:\s*([\d.]+)/)
          return {
            line: l.trim(),
            name: nameMatch?.[1] || null,
            score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
          }
        })

      const detected = detections.some(d => d.score && d.score >= 0.35)

      res.json({ detected, detections, output })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Live spot detection (WebSocket) ─────────────────────────────────────────

  let activeSpotProcess: ChildProcess | null = null

  app.post('/api/wakeword/spot/start', async (req: any, res: any) => {
    try {
      const { modelFilename, threshold } = req.body || {}
      if (!modelFilename) return res.status(400).json({ error: 'modelFilename is required' })

      const modelPath = `${modelsDir}/${modelFilename}`
      if (!fs.exists(modelPath)) return res.status(404).json({ error: 'Model not found' })

      // Kill any existing spot process
      if (activeSpotProcess) {
        try { activeSpotProcess.kill() } catch {}
        activeSpotProcess = null
      }

      const t = threshold || 0.35
      const args = ['spot', '-t', String(t), '-m', '5', '-e', '-d', '-g', '--band-pass', modelPath]

      proc.spawnAndCapture('rustpotter', args, {
        onOutput: (line: string) => {
          // Broadcast detection events to all WebSocket clients
          const msg = JSON.stringify({ type: 'spot', data: line.trim() })
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1) client.send(msg)
          })

          // Parse and send structured detection data
          if (line.includes('detection')) {
            const nameMatch = line.match(/name:\s*"([^"]+)"/)
            const scoreMatch = line.match(/(?<![a-z_])score:\s*([\d.]+)/)
            if (nameMatch && scoreMatch) {
              const det = JSON.stringify({
                type: 'detection',
                name: nameMatch[1],
                score: parseFloat(scoreMatch[1]),
                raw: line.trim(),
              })
              wss.clients.forEach((client: any) => {
                if (client.readyState === 1) client.send(det)
              })
            }
          }
        },
        onError: (line: string) => {
          const msg = JSON.stringify({ type: 'spot-error', data: line.trim() })
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1) client.send(msg)
          })
        },
        onStart: (child: any) => {
          activeSpotProcess = child
        },
        onExit: () => {
          activeSpotProcess = null
          const msg = JSON.stringify({ type: 'spot-stopped' })
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1) client.send(msg)
          })
        },
      })

      res.json({ ok: true, threshold: t })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/wakeword/spot/stop', async (_req: any, res: any) => {
    if (activeSpotProcess) {
      try { activeSpotProcess.kill() } catch {}
      activeSpotProcess = null
    }
    res.json({ ok: true })
  })

  // ── Assistant assignment ────────────────────────────────────────────────────

  app.get('/api/wakeword/assistants', async (_req: any, res: any) => {
    try {
      const manager = container.feature('assistantsManager') as any
      const results: any[] = []

      for (const entry of (manager.list?.() || [])) {
        if (!entry.hasVoice) continue
        try {
          const inst = container.feature('assistant', { folder: entry.folder } as any) as any
          const voiceConfig = inst.voiceConfig || {}
          results.push({
            name: entry.name,
            folder: entry.folder,
            aliases: voiceConfig.aliases || [],
            provider: voiceConfig.provider || 'elevenlabs',
            wakeWordThreshold: voiceConfig.wakeWordThreshold || 0.35,
            wakeWordModel: voiceConfig.wakeWordModel || null,
            hasVoice: true,
          })
        } catch {}
      }

      res.json({ assistants: results })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/wakeword/assistants/:name/assign', async (req: any, res: any) => {
    try {
      const { name } = req.params
      const { wakePhrase, threshold } = req.body || {}
      if (!wakePhrase) return res.status(400).json({ error: 'wakePhrase is required' })

      const manager = container.feature('assistantsManager') as any
      const entry = manager.list().find((a: any) => a.name === name)
      if (!entry) return res.status(404).json({ error: `Assistant "${name}" not found` })

      const inst = container.feature('assistant', { folder: entry.folder } as any) as any
      const voicePath = inst.paths.join('voice.yaml')

      if (!fs.exists(voicePath)) {
        return res.status(400).json({ error: `No voice.yaml found for "${name}"` })
      }

      const config = yaml.parse(fs.readFile(voicePath))
      const aliases: string[] = config.aliases || []

      // Add the wake phrase to aliases if not already present
      const normalized = wakePhrase.toLowerCase().trim()
      // Also add stripped version without common prefixes
      const stripped = normalized.replace(/^(hey|ok|hi|yo)\s+/, '')

      const toAdd = [normalized]
      if (stripped !== normalized) toAdd.push(stripped)

      for (const alias of toAdd) {
        if (!aliases.includes(alias)) aliases.push(alias)
      }

      config.aliases = aliases
      if (threshold != null) config.wakeWordThreshold = threshold

      // Store the wake word model filename so voice-listener knows which model maps to this assistant
      const slug = slugify(wakePhrase)
      config.wakeWordModel = `${slug}.rpw`

      await fs.writeFileAsync(voicePath, yaml.stringify(config))

      res.json({
        ok: true,
        aliases: config.aliases,
        wakeWordThreshold: config.wakeWordThreshold,
        wakeWordModel: config.wakeWordModel,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── End-to-end test (voice chat) ────────────────────────────────────────────

  app.post('/api/wakeword/test-chat', async (req: any, res: any) => {
    try {
      const { assistantName, text } = req.body || {}
      if (!assistantName || !text) {
        return res.status(400).json({ error: 'assistantName and text are required' })
      }

      const chat = container.feature('voiceChat', {
        assistant: assistantName,
        historyMode: 'lifecycle',
      }) as any

      if (!chat.isStarted) {
        await chat.start()
      }

      // Broadcast chat events over WebSocket
      const sendWs = (type: string, data: any) => {
        const msg = JSON.stringify({ type, ...data })
        wss.clients.forEach((client: any) => {
          if (client.readyState === 1) client.send(msg)
        })
      }

      chat.assistant.on('chunk', (chunk: string) => {
        sendWs('chat-chunk', { chunk })
      })

      const response = await chat.say(text)
      sendWs('chat-done', { response })

      res.json({ ok: true, response })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  console.log('[wakeword-setup] hooks loaded — recording, model building, and testing endpoints ready')
}
