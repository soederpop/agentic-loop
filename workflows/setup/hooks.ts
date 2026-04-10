/**
 * Setup / System Onboarding — WorkflowService hooks
 *
 * Registers system capability checks and environment configuration endpoints.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')
  const proc = container.feature('proc')
  const networking = container.feature('networking')

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function execQuiet(cmd: string): Promise<{ ok: boolean; stdout: string }> {
    try {
      const result: any = await proc.exec(cmd)
      const stdout = typeof result === 'string' ? result.trim() : ((result?.stdout || '') as string).trim()
      return { ok: true, stdout }
    } catch (err: any) {
      const msg = err?.stdout || err?.message || ''
      return { ok: false, stdout: typeof msg === 'string' ? msg.trim() : '' }
    }
  }

  async function whichBin(name: string): Promise<{ found: boolean; path: string }> {
    const result = await execQuiet(`which ${name}`)
    return { found: result.ok && result.stdout.length > 0, path: result.stdout }
  }

  function envKeyPresent(key: string): boolean {
    return !!process.env[key]
  }

  // ── Capability checks ──────────────────────────────────────────────────────

  async function checkBun() {
    const result = await execQuiet('bun --version')
    return {
      capability: 'bun', group: 'required', title: 'Bun Runtime',
      description: 'JavaScript/TypeScript runtime used by the project',
      status: result.ok ? 'ok' : 'missing',
      details: result.ok ? `v${result.stdout}` : 'bun not found in PATH',
      action: result.ok ? undefined : 'Install bun: curl -fsSL https://bun.sh/install | bash',
    }
  }

  async function checkOpenAIKey() {
    const present = envKeyPresent('OPENAI_API_KEY')
    return {
      capability: 'openai_key', group: 'required', title: 'OpenAI API Key',
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
        capability: 'content_model', group: 'required', title: 'Content Model',
        description: 'Structured document model (docs/models.ts + cnotes validate)',
        status: 'missing', details: 'docs/models.ts not found', action: 'Run: cnotes init',
      }
    }
    const validate = await execQuiet('cnotes validate')
    const hasIssues = !validate.ok || validate.stdout.toLowerCase().includes('invalid')
    return {
      capability: 'content_model', group: 'required', title: 'Content Model',
      description: 'Structured document model (docs/models.ts + cnotes validate)',
      status: hasIssues ? 'warning' : 'ok',
      details: hasIssues
        ? `Validation issues:\n${validate.stdout.slice(0, 300) || 'cnotes validate failed'}`
        : 'Content model valid',
      action: hasIssues ? 'Run: cnotes validate --setDefaultMeta' : undefined,
    }
  }

  async function checkSox() {
    const bin = await whichBin('sox')
    return {
      capability: 'sox', group: 'voice', title: 'SoX',
      description: 'Audio recording for speech-to-text',
      status: bin.found ? 'ok' : 'missing',
      details: bin.found ? `Found at ${bin.path}` : 'sox not found in PATH',
      action: bin.found ? undefined : 'Install sox: brew install sox',
    }
  }

  async function checkMlxWhisper() {
    const bin = await whichBin('mlx_whisper')
    return {
      capability: 'mlx_whisper', group: 'voice', title: 'MLX Whisper',
      description: 'Speech-to-text engine (Apple Silicon)',
      status: bin.found ? 'ok' : 'missing',
      details: bin.found ? `Found at ${bin.path}` : 'mlx_whisper not found in PATH',
      action: bin.found ? undefined : 'Install mlx_whisper: pip install mlx-whisper',
    }
  }

  async function checkElevenLabsKey() {
    const present = envKeyPresent('ELEVENLABS_API_KEY')
    return {
      capability: 'elevenlabs_key', group: 'voice', title: 'ElevenLabs API Key',
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
        capability: 'voice_assistants', group: 'voice', title: 'Voice Assistants',
        description: 'Assistants configured with voice.yaml',
        status: 'warning', details: 'No assistants/ directory found',
      }
    }
    const entries = fs.readdirSync(assistantsDir).filter((d: string) => !d.startsWith('.'))
    const withVoice: string[] = []
    for (const d of entries) {
      if (fs.existsSync(container.paths.resolve('assistants', d, 'voice.yaml'))) {
        withVoice.push(d)
      }
    }
    return {
      capability: 'voice_assistants', group: 'voice', title: 'Voice Assistants',
      description: 'Assistants configured with voice.yaml',
      status: withVoice.length > 0 ? 'ok' : 'warning',
      details: withVoice.length > 0
        ? `${withVoice.length} voice-enabled: ${withVoice.join(', ')}`
        : `${entries.length} assistant(s) found, none have voice.yaml`,
    }
  }

  async function checkNativeApp() {
    const appPath = container.paths.resolve(
      'apps', 'presenter-windows', 'dist', 'LucaVoiceLauncher.app',
    )
    const exists = fs.existsSync(appPath)
    return {
      capability: 'native_app', group: 'native', title: 'LucaVoiceLauncher.app',
      description: 'Native macOS presenter app',
      status: exists ? 'ok' : 'missing',
      details: exists ? 'App bundle found' : 'App not built',
      action: exists ? undefined : 'Build the app in apps/presenter-windows/',
    }
  }

  async function checkXcode() {
    const result = await execQuiet('xcode-select -p')
    return {
      capability: 'xcode_cli', group: 'native', title: 'Xcode CLI Tools',
      description: 'Required for building native macOS apps',
      status: result.ok ? 'ok' : 'missing',
      details: result.ok ? `Installed at ${result.stdout}` : 'Xcode CLI tools not installed',
      action: result.ok ? undefined : 'Install: xcode-select --install',
    }
  }

  async function checkAuthority() {
    try {
      const registry = container.feature('instanceRegistry') as any
      const instance = registry.getSelf()
      const port = instance?.ports?.authority
      const running = port ? !(await networking.isPortOpen(port)) : false
      return {
        capability: 'authority', group: 'authority', title: 'Authority Process',
        description: `luca main process${port ? ` (port ${port})` : ''}`,
        status: running ? 'ok' : 'warning',
        details: running ? `Running on port ${port}` : 'Not running',
        action: running ? undefined : 'Start with: luca main',
      }
    } catch {
      return {
        capability: 'authority', group: 'authority', title: 'Authority Process',
        description: 'luca main process',
        status: 'warning', details: 'Could not check authority status',
      }
    }
  }

  async function getAllCapabilities() {
    return Promise.all([
      checkBun(), checkOpenAIKey(), checkContentModel(),
      checkSox(),
      checkMlxWhisper(), checkElevenLabsKey(), checkVoiceAssistants(),
      checkNativeApp(), checkXcode(), checkAuthority(),
    ])
  }

  // ── API routes ─────────────────────────────────────────────────────────────

  app.get('/api/system-status', async (_req: any, res: any) => {
    try {
      const capabilities = await getAllCapabilities()
      const ready = capabilities.filter((c: any) => c.status === 'ok').length
      res.json({ ready, total: capabilities.length, capabilities })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  const ENV_ALLOWLIST = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY']

  app.post('/api/env', async (req: any, res: any) => {
    try {
      const { key, value } = req.body || {}
      if (!key || !value) return res.status(400).json({ error: 'key and value are required' })
      if (!ENV_ALLOWLIST.includes(key)) {
        return res.status(403).json({ error: `Key "${key}" is not in the allowlist` })
      }
      const envPath = container.paths.resolve('.env')
      let envContent = ''
      if (fs.existsSync(envPath)) envContent = (fs.readFileSync(envPath, 'utf-8') as any).toString('utf-8')
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`)
      } else {
        envContent = envContent.trimEnd() + `\n${key}=${value}\n`
      }
      fs.writeFile(envPath, envContent)
      process.env[key] = value
      res.json({ ok: true, key })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/voice-assistants', async (_req: any, res: any) => {
    try {
      const assistantsDir = container.paths.resolve('assistants')
      const assistants: any[] = []
      if (fs.existsSync(assistantsDir)) {
        const yaml = container.feature('yaml')
        const dirs = fs
          .readdirSync(assistantsDir)
          .filter(
            (d: string) =>
              !d.startsWith('.') &&
              fs.existsSync(container.paths.resolve('assistants', d, 'CORE.md')),
          )
        for (const d of dirs) {
          const voicePath = container.paths.resolve('assistants', d, 'voice.yaml')
          const hasVoice = fs.existsSync(voicePath)
          let voiceId: string | undefined
          let aliases: string[] | undefined
          if (hasVoice) {
            try {
              const raw = (fs.readFileSync(voicePath, 'utf-8') as any).toString('utf-8') as string
              const parsed = yaml.parse(raw)
              voiceId = parsed?.voiceId || parsed?.voice_id
              aliases = parsed?.aliases
            } catch {}
          }
          assistants.push({ name: d, hasVoice, voiceId, aliases })
        }
      }
      res.json({ assistants })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

}
