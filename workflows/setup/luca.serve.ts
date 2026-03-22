/**
 * Setup / System Onboarding Workflow — setup hook for luca serve
 *
 * Diagnostic dashboard that checks system capabilities:
 * - Required: bun, OPENAI_API_KEY, content model
 * - Optional (Voice): rustpotter, wake word models, sox, mlx_whisper, ELEVENLABS_API_KEY, voice assistants
 * - Optional (Native App): LucaVoiceLauncher.app, Xcode CLI tools
 * - Authority: luca main process on port 4410
 *
 * Usage:
 *   luca serve --setup workflows/setup/luca.serve.ts --staticDir workflows/setup/public --port 9304 --no-open
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app
  const fs = container.feature('fs')
  const proc = container.feature('proc')

  const ENV_ALLOWLIST = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY']

  // ── Helpers ──

  async function execQuiet(cmd: string): Promise<{ ok: boolean; stdout: string }> {
    try {
      const result = await proc.exec(cmd)
      // proc.exec returns stdout as a string directly
      const stdout = typeof result === 'string' ? result.trim() : (result?.stdout || '').trim()
      return { ok: true, stdout }
    } catch (err: any) {
      // Some commands write to stdout before failing — capture what we can
      const msg = err?.stdout || err?.message || ''
      return { ok: false, stdout: typeof msg === 'string' ? msg.trim() : '' }
    }
  }

  async function whichBin(name: string): Promise<{ found: boolean; path: string }> {
    const result = await execQuiet(`which ${name}`)
    return { found: result.ok && result.stdout.length > 0, path: result.stdout }
  }

  async function portListening(port: number): Promise<boolean> {
    try {
      const resp = await fetch(`http://localhost:${port}/`)
      return resp.ok || resp.status < 500
    } catch {
      return false
    }
  }

  function envKeyPresent(key: string): boolean {
    return !!process.env[key]
  }

  // ── Capability Checks ──

  async function checkBun() {
    const result = await execQuiet('bun --version')
    return {
      capability: 'bun',
      group: 'required',
      title: 'Bun Runtime',
      description: 'JavaScript/TypeScript runtime used by the project',
      status: result.ok ? 'ok' : 'missing',
      details: result.ok ? `v${result.stdout}` : 'bun not found in PATH',
      action: result.ok ? undefined : 'Install bun: curl -fsSL https://bun.sh/install | bash',
    }
  }

  async function checkOpenAIKey() {
    const present = envKeyPresent('OPENAI_API_KEY')
    return {
      capability: 'openai_key',
      group: 'required',
      title: 'OpenAI API Key',
      description: 'Required for LLM-powered features',
      status: present ? 'ok' : 'missing',
      details: present ? 'OPENAI_API_KEY is set' : 'OPENAI_API_KEY not found in environment',
      action: present ? undefined : 'Set OPENAI_API_KEY in .env',
      envKey: 'OPENAI_API_KEY',
    }
  }

  async function checkContentModel() {
    const modelsPath = container.paths.resolve('docs', 'models.ts')
    const modelsExist = fs.existsSync(modelsPath)
    if (!modelsExist) {
      return {
        capability: 'content_model',
        group: 'required',
        title: 'Content Model',
        description: 'Structured document model (docs/models.ts + cnotes validate)',
        status: 'missing',
        details: 'docs/models.ts not found',
        action: 'Run: cnotes init',
      }
    }
    const validate = await execQuiet('cnotes validate')
    const hasIssues = !validate.ok || validate.stdout.toLowerCase().includes('invalid')
    return {
      capability: 'content_model',
      group: 'required',
      title: 'Content Model',
      description: 'Structured document model (docs/models.ts + cnotes validate)',
      status: hasIssues ? 'warning' : 'ok',
      details: hasIssues
        ? `Validation issues:\n${validate.stdout.slice(0, 300) || 'cnotes validate failed'}`
        : 'Content model valid',
      action: hasIssues ? 'Run: cnotes validate --setDefaultMeta' : undefined,
    }
  }

  async function checkRustpotter() {
    const bin = await whichBin('rustpotter')
    return {
      capability: 'rustpotter',
      group: 'voice',
      title: 'Rustpotter',
      description: 'Wake word detection engine',
      status: bin.found ? 'ok' : 'missing',
      details: bin.found ? `Found at ${bin.path}` : 'rustpotter not found in PATH',
      action: bin.found ? undefined : 'Install rustpotter: see https://github.com/GiviMAD/rustpotter',
    }
  }

  async function checkWakeWordModels() {
    const modelsDir = container.paths.resolve('voice', 'wakeword', 'models')
    const dirExists = fs.existsSync(modelsDir)
    if (!dirExists) {
      return {
        capability: 'wakeword_models',
        group: 'voice',
        title: 'Wake Word Models',
        description: '.rpw model files for wake word detection',
        status: 'missing',
        details: 'voice/wakeword/models/ directory not found',
        action: 'Create voice/wakeword/models/ and add .rpw files',
      }
    }
    const files = fs.readdirSync(modelsDir).filter((f: string) => f.endsWith('.rpw'))
    return {
      capability: 'wakeword_models',
      group: 'voice',
      title: 'Wake Word Models',
      description: '.rpw model files for wake word detection',
      status: files.length > 0 ? 'ok' : 'missing',
      details: files.length > 0 ? `${files.length} model(s): ${files.join(', ')}` : 'No .rpw files found',
      action: files.length > 0 ? undefined : 'Add .rpw wake word model files to voice/wakeword/models/',
    }
  }

  async function checkSox() {
    const bin = await whichBin('sox')
    return {
      capability: 'sox',
      group: 'voice',
      title: 'SoX',
      description: 'Audio recording for speech-to-text',
      status: bin.found ? 'ok' : 'missing',
      details: bin.found ? `Found at ${bin.path}` : 'sox not found in PATH',
      action: bin.found ? undefined : 'Install sox: brew install sox',
    }
  }

  async function checkMlxWhisper() {
    const bin = await whichBin('mlx_whisper')
    return {
      capability: 'mlx_whisper',
      group: 'voice',
      title: 'MLX Whisper',
      description: 'Speech-to-text engine (Apple Silicon)',
      status: bin.found ? 'ok' : 'missing',
      details: bin.found ? `Found at ${bin.path}` : 'mlx_whisper not found in PATH',
      action: bin.found ? undefined : 'Install mlx_whisper: pip install mlx-whisper',
    }
  }

  async function checkElevenLabsKey() {
    const present = envKeyPresent('ELEVENLABS_API_KEY')
    return {
      capability: 'elevenlabs_key',
      group: 'voice',
      title: 'ElevenLabs API Key',
      description: 'Text-to-speech synthesis',
      status: present ? 'ok' : 'missing',
      details: present ? 'ELEVENLABS_API_KEY is set' : 'ELEVENLABS_API_KEY not found in environment',
      action: present ? undefined : 'Set ELEVENLABS_API_KEY in .env',
      envKey: 'ELEVENLABS_API_KEY',
    }
  }

  async function checkVoiceAssistants() {
    const assistantsDir = container.paths.resolve('assistants')
    if (!fs.existsSync(assistantsDir)) {
      return {
        capability: 'voice_assistants',
        group: 'voice',
        title: 'Voice Assistants',
        description: 'Assistants configured with voice.yaml',
        status: 'warning',
        details: 'No assistants/ directory found',
      }
    }
    const entries = fs.readdirSync(assistantsDir).filter((d: string) => !d.startsWith('.'))
    const withVoice: string[] = []
    const withoutVoice: string[] = []
    for (const d of entries) {
      const voicePath = container.paths.resolve('assistants', d, 'voice.yaml')
      if (fs.existsSync(voicePath)) {
        withVoice.push(d)
      } else if (fs.existsSync(container.paths.resolve('assistants', d, 'CORE.md'))) {
        // Only count dirs that look like assistants (have CORE.md)
        withoutVoice.push(d)
      }
    }
    return {
      capability: 'voice_assistants',
      group: 'voice',
      title: 'Voice Assistants',
      description: 'Assistants configured with voice.yaml',
      status: withVoice.length > 0 ? 'ok' : 'warning',
      details: withVoice.length > 0
        ? `${withVoice.length} voice-enabled: ${withVoice.join(', ')}`
        : `${dirs.length} assistant(s) found, none have voice.yaml`,
    }
  }

  async function checkNativeApp() {
    const appPath = container.paths.resolve('apps', 'presenter-windows', 'dist', 'LucaVoiceLauncher.app')
    const exists = fs.existsSync(appPath)
    return {
      capability: 'native_app',
      group: 'native',
      title: 'LucaVoiceLauncher.app',
      description: 'Native macOS presenter app',
      status: exists ? 'ok' : 'missing',
      details: exists ? 'App bundle found' : 'App not built',
      action: exists ? undefined : 'Build the app in apps/presenter-windows/',
    }
  }

  async function checkXcode() {
    const result = await execQuiet('xcode-select -p')
    return {
      capability: 'xcode_cli',
      group: 'native',
      title: 'Xcode CLI Tools',
      description: 'Required for building native macOS apps',
      status: result.ok ? 'ok' : 'missing',
      details: result.ok ? `Installed at ${result.stdout}` : 'Xcode CLI tools not installed',
      action: result.ok ? undefined : 'Install: xcode-select --install',
    }
  }

  async function checkAuthority() {
    const running = await portListening(4410)
    return {
      capability: 'authority',
      group: 'authority',
      title: 'Authority Process',
      description: 'luca main process (port 4410)',
      status: running ? 'ok' : 'warning',
      details: running ? 'Running on port 4410' : 'Not running',
      action: running ? undefined : 'Start with: luca main',
    }
  }

  async function getAllCapabilities() {
    const checks = await Promise.all([
      checkBun(),
      checkOpenAIKey(),
      checkContentModel(),
      checkRustpotter(),
      checkWakeWordModels(),
      checkSox(),
      checkMlxWhisper(),
      checkElevenLabsKey(),
      checkVoiceAssistants(),
      checkNativeApp(),
      checkXcode(),
      checkAuthority(),
    ])
    return checks
  }

  // ── GET /api/system-status ──
  app.get('/api/system-status', async (_req: any, res: any) => {
    try {
      const capabilities = await getAllCapabilities()
      const ready = capabilities.filter((c: any) => c.status === 'ok').length
      const total = capabilities.length
      res.json({ ready, total, capabilities })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/wake-words ──
  app.get('/api/wake-words', async (_req: any, res: any) => {
    try {
      const rustpotter = await whichBin('rustpotter')
      const modelsDir = container.paths.resolve('voice', 'wakeword', 'models')
      let models: { file: string; name: string }[] = []
      if (fs.existsSync(modelsDir)) {
        models = fs.readdirSync(modelsDir)
          .filter((f: string) => f.endsWith('.rpw'))
          .map((f: string) => ({ file: f, name: f.replace('.rpw', '').replace(/_/g, ' ') }))
      }
      res.json({ models, rustpotterAvailable: rustpotter.found })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/voice-assistants ──
  app.get('/api/voice-assistants', async (_req: any, res: any) => {
    try {
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
      res.json({ assistants })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── POST /api/env — save an env key to .env ──
  app.post('/api/env', async (req: any, res: any) => {
    try {
      const { key, value } = req.body
      if (!key || !value) {
        return res.status(400).json({ error: 'key and value are required' })
      }
      if (!ENV_ALLOWLIST.includes(key)) {
        return res.status(403).json({ error: `Key "${key}" is not in the allowlist` })
      }

      const envPath = container.paths.resolve('.env')
      let envContent = ''
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8')
      }

      // Replace existing key or append
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`)
      } else {
        envContent = envContent.trimEnd() + `\n${key}=${value}\n`
      }

      fs.writeFile(envPath, envContent)

      // Also set in current process so recheck picks it up
      process.env[key] = value

      res.json({ ok: true, key })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  console.log('[setup] system onboarding workflow ready on port 9304')
}
