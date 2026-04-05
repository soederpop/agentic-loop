/**
 * Communications Hub — WorkflowService hooks
 *
 * Registers endpoints for channel status, configuration, installation,
 * connectivity testing, and reaction rule management.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')
  const proc = container.feature('proc')
  const yaml = container.feature('yaml')

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function execQuiet(cmd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    try {
      const result: any = await proc.exec(cmd)
      const stdout = typeof result === 'string' ? result.trim() : ((result?.stdout || '') as string).trim()
      return { ok: true, stdout, stderr: '' }
    } catch (err: any) {
      const msg = err?.stdout || err?.message || ''
      return { ok: false, stdout: typeof msg === 'string' ? msg.trim() : '', stderr: (err?.stderr || '').toString().trim() }
    }
  }

  async function whichBin(name: string): Promise<{ found: boolean; path: string }> {
    const result = await execQuiet(`which ${name}`)
    return { found: result.ok && result.stdout.length > 0, path: result.stdout }
  }

  function envKeyPresent(key: string): boolean {
    return !!process.env[key]
  }

  function configPath(): string {
    return container.paths.resolve('config.yml')
  }

  function readConfig(): Record<string, any> {
    const p = configPath()
    if (!fs.existsSync(p)) return {}
    try {
      const raw = (fs.readFileSync(p, 'utf-8') as any).toString('utf-8')
      return yaml.parse(raw) || {}
    } catch {
      return {}
    }
  }

  function writeConfig(data: Record<string, any>): void {
    fs.writeFile(configPath(), yaml.stringify(data))
  }

  function getCommsConfig(): Record<string, any> {
    const cfg = readConfig()
    return cfg.communications || {}
  }

  function getReactionRules(): any[] {
    const cfg = readConfig()
    return cfg.reactionRules || []
  }

  // ── Channel Status ─────────────────────────────────────────────────────────

  app.get('/api/channels/status', async (_req: any, res: any) => {
    try {
      const commsConfig = getCommsConfig()

      // iMessage
      const imsgBin = await whichBin('imsg')
      const imsgConfig = commsConfig.imsg || {}
      let imsgRunning = false
      try {
        const comms = container.feature('communications')
        imsgRunning = (comms.activeChannels || []).includes('imsg')
      } catch {}

      // Telegram
      const telegramTokenSet = envKeyPresent('TELEGRAM_BOT_TOKEN')
      const telegramConfig = commsConfig.telegram || {}
      let telegramState: any = {}
      try {
        const tg = container.feature('telegram')
        telegramState = {
          isRunning: tg.state.get('isRunning') || false,
          mode: tg.state.get('mode') || 'idle',
          botInfo: tg.state.get('botInfo') || null,
          lastError: tg.state.get('lastError') || null,
        }
      } catch {}

      // GWS
      const gwsBin = await whichBin('gws')
      const gwsConfig = commsConfig.gws || {}
      let gwsProfiles: string[] = []
      let gwsActiveProfile: string | null = null
      let gwsAvailable = false
      try {
        const gws = container.feature('gws')
        gwsProfiles = gws.profiles()
        gwsActiveProfile = gws.state.get('activeProfile') || null
        gwsAvailable = gws.state.get('available') || false
      } catch {}
      // Check if gmail channel is active in the communications feature
      let gwsRunning = false
      try {
        const comms = container.feature('communications')
        gwsRunning = (comms.activeChannels || []).includes('gmail')
      } catch {}

      res.json({
        channels: {
          imsg: {
            installed: imsgBin.found,
            configured: imsgConfig.enabled === true,
            running: imsgRunning,
            binaryPath: imsgBin.path || null,
            config: {
              enabled: imsgConfig.enabled || false,
              trustedSenders: imsgConfig.trustedSenders || [],
            },
          },
          telegram: {
            installed: true, // always available in luca core
            configured: telegramTokenSet && telegramConfig.enabled === true,
            running: telegramState.isRunning || false,
            tokenSet: telegramTokenSet,
            mode: telegramState.mode || 'idle',
            botInfo: telegramState.botInfo || null,
            lastError: telegramState.lastError || null,
            config: {
              enabled: telegramConfig.enabled || false,
              trustedSenders: telegramConfig.trustedSenders || [],
              mode: telegramConfig.mode || 'polling',
              pollingTimeout: telegramConfig.pollingTimeout ?? 1,
              pollingLimit: telegramConfig.pollingLimit ?? 100,
              dropPendingUpdates: telegramConfig.dropPendingUpdates || false,
              autoStart: telegramConfig.autoStart || false,
              allowedUpdates: telegramConfig.allowedUpdates || [],
              webhookUrl: telegramConfig.webhookUrl || '',
              webhookPath: telegramConfig.webhookPath || '/telegram/webhook',
              webhookPort: telegramConfig.webhookPort || 8443,
            },
          },
          gws: {
            installed: gwsBin.found,
            configured: gwsAvailable || gwsProfiles.length > 0,
            running: gwsRunning,
            binaryPath: gwsBin.path || null,
            profiles: gwsProfiles,
            activeProfile: gwsActiveProfile,
            config: {
              enabled: gwsConfig.enabled || false,
              configDir: gwsConfig.configDir || '~/.config/gws',
            },
          },
        },
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Install ────────────────────────────────────────────────────────────────

  app.post('/api/channels/:channel/install', async (req: any, res: any) => {
    try {
      const { channel } = req.params

      if (channel === 'imsg') {
        const hasBrew = await whichBin('brew')
        if (!hasBrew.found) {
          return res.json({ ok: false, error: 'Homebrew not found. Install imsg manually: see https://github.com/nicktomlin/imsg' })
        }
        const result = await execQuiet('brew install imsg')
        return res.json({ ok: result.ok, stdout: result.stdout, stderr: result.stderr })
      }

      if (channel === 'gws') {
        const hasNpm = await whichBin('npm')
        if (!hasNpm.found) {
          return res.json({ ok: false, error: 'npm not found. Install Node.js first.' })
        }
        const result = await execQuiet('npm install -g @googleworkspace/cli')
        return res.json({ ok: result.ok, stdout: result.stdout, stderr: result.stderr })
      }

      if (channel === 'telegram') {
        return res.json({ ok: true, message: 'Telegram is built into luca core — no installation needed. Set your TELEGRAM_BOT_TOKEN to get started.' })
      }

      res.status(400).json({ error: `Unknown channel: ${channel}` })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Configuration CRUD ─────────────────────────────────────────────────────

  app.get('/api/config', async (_req: any, res: any) => {
    try {
      const commsConfig = getCommsConfig()
      const rules = getReactionRules()
      res.json({ communications: commsConfig, reactionRules: rules })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/config/channel/:channel', async (req: any, res: any) => {
    try {
      const { channel } = req.params
      const validChannels = ['imsg', 'telegram', 'gws']
      if (!validChannels.includes(channel)) {
        return res.status(400).json({ error: `Invalid channel: ${channel}` })
      }

      const cfg = readConfig()
      if (!cfg.communications) cfg.communications = {}
      cfg.communications[channel] = { ...cfg.communications[channel], ...req.body }
      writeConfig(cfg)

      res.json({ ok: true, config: cfg.communications[channel] })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  const ENV_ALLOWLIST = ['TELEGRAM_BOT_TOKEN']

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

  // ── GWS Active Profile ─────────────────────────────────────────────────────

  app.put('/api/channels/gws/profile', async (req: any, res: any) => {
    try {
      const { profile } = req.body || {}
      const gws = container.feature('gws')
      if (!profile) {
        gws.clearProfile()
      } else {
        gws.useProfile(profile)
      }
      res.json({ ok: true, activeProfile: gws.currentProfile })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Test Connectivity ──────────────────────────────────────────────────────

  app.post('/api/channels/:channel/test', async (req: any, res: any) => {
    try {
      const { channel } = req.params

      if (channel === 'imsg') {
        const imsg = container.feature('imsg')
        const chats = await imsg.chats({ limit: 3 })
        return res.json({ ok: true, details: `Connected — found ${chats.length} recent chat(s)`, chats })
      }

      if (channel === 'telegram') {
        if (!envKeyPresent('TELEGRAM_BOT_TOKEN')) {
          return res.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not set' })
        }
        try {
          const tg = container.feature('telegram', { token: process.env.TELEGRAM_BOT_TOKEN })
          const botInfo = await tg.getMe()
          return res.json({ ok: true, details: `Connected — bot: @${botInfo?.username || 'unknown'}`, botInfo })
        } catch (err: any) {
          return res.json({ ok: false, error: err.message || 'Failed to connect to Telegram' })
        }
      }

      if (channel === 'gws') {
        try {
          const gws = container.feature('gws')
          const result = await gws.gwsCheckAuth({ profile: req.body?.profile })
          return res.json({ ok: true, details: 'Authenticated', result })
        } catch (err: any) {
          return res.json({ ok: false, error: err.message || 'GWS auth check failed' })
        }
      }

      res.status(400).json({ error: `Unknown channel: ${channel}` })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/channels/:channel/test-send', async (req: any, res: any) => {
    try {
      const { channel } = req.params

      if (channel === 'imsg') {
        const { to, text } = req.body || {}
        if (!to || !text) return res.status(400).json({ error: 'to and text are required' })
        const imsg = container.feature('imsg')
        const result = await imsg.send(to, text)
        return res.json(result)
      }

      if (channel === 'telegram') {
        const { chatId, text } = req.body || {}
        if (!chatId || !text) return res.status(400).json({ error: 'chatId and text are required' })
        try {
          const tg = container.feature('telegram', { token: process.env.TELEGRAM_BOT_TOKEN })
          if (!tg.state.get('isRunning')) await tg.start()
          await tg.bot.api.sendMessage(chatId, text)
          return res.json({ success: true })
        } catch (err: any) {
          return res.json({ success: false, error: err.message })
        }
      }

      if (channel === 'gws') {
        const { to, subject, body, profile } = req.body || {}
        if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body are required' })
        try {
          const gws = container.feature('gws')
          const result = await gws.gwsSendEmail({ to, subject, body, profile })
          return res.json({ success: true, result })
        } catch (err: any) {
          return res.json({ success: false, error: err.message })
        }
      }

      res.status(400).json({ error: `Unknown channel: ${channel}` })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Reaction Rules CRUD ────────────────────────────────────────────────────

  app.get('/api/reaction-rules', async (_req: any, res: any) => {
    try {
      res.json({ rules: getReactionRules() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/reaction-rules', async (req: any, res: any) => {
    try {
      const rule = req.body
      if (!rule || !rule.name || !rule.channel || !rule.assistant) {
        return res.status(400).json({ error: 'name, channel, and assistant are required' })
      }
      rule.id = container.utils.uuid()
      const cfg = readConfig()
      if (!cfg.reactionRules) cfg.reactionRules = []
      cfg.reactionRules.push(rule)
      writeConfig(cfg)
      res.json({ ok: true, rule })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/reaction-rules/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const cfg = readConfig()
      const rules = cfg.reactionRules || []
      const idx = rules.findIndex((r: any) => r.id === id)
      if (idx === -1) return res.status(404).json({ error: 'Rule not found' })
      rules[idx] = { ...rules[idx], ...req.body, id }
      cfg.reactionRules = rules
      writeConfig(cfg)
      res.json({ ok: true, rule: rules[idx] })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/reaction-rules/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const cfg = readConfig()
      const rules = cfg.reactionRules || []
      const idx = rules.findIndex((r: any) => r.id === id)
      if (idx === -1) return res.status(404).json({ error: 'Rule not found' })
      rules.splice(idx, 1)
      cfg.reactionRules = rules
      writeConfig(cfg)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Assistants List ────────────────────────────────────────────────────────

  app.get('/api/assistants', async (_req: any, res: any) => {
    try {
      const assistantsDir = container.paths.resolve('assistants')
      const assistants: any[] = []
      if (fs.existsSync(assistantsDir)) {
        const dirs = fs
          .readdirSync(assistantsDir)
          .filter(
            (d: string) =>
              !d.startsWith('.') &&
              fs.existsSync(container.paths.resolve('assistants', d, 'CORE.md')),
          )
        for (const d of dirs) {
          assistants.push({ name: d })
        }
      }
      res.json({ assistants })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  console.log('[comms] hooks loaded — channel management endpoints ready')
}
