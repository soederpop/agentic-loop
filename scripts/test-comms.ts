/**
 * test-comms.ts — Test the Communications service at the feature level
 *
 * Validates that config.yml is read correctly, channels are detected
 * and can be activated, the communications hub wires up event handlers,
 * and individual channels (imsg, telegram) respond to basic probes.
 *
 * Usage:
 *   luca run scripts/test-comms.ts
 */
import container from '@soederpop/luca/agi'

const ui = container.feature('ui')
const { colors } = ui
const yaml = container.feature('yaml')
const fs = container.feature('fs')

let passed = 0
let failed = 0
let skipped = 0

async function test(label: string, fn: () => Promise<boolean | string>) {
  try {
    const result = await fn()
    if (result === true) {
      passed++
      console.log(colors.green(`  PASS  ${label}`))
    } else {
      failed++
      const detail = typeof result === 'string' ? result : ''
      console.log(colors.red(`  FAIL  ${label}`) + (detail ? colors.dim(` — ${detail}`) : ''))
    }
  } catch (err: any) {
    failed++
    console.log(colors.red(`  FAIL  ${label}`) + colors.dim(` — ${err.message}`))
  }
}

function skip(label: string, reason: string) {
  skipped++
  console.log(colors.yellow(`  SKIP  ${label}`) + colors.dim(` — ${reason}`))
}

console.log()
ui.print.cyan('Communications Service — Feature Tests')
console.log()

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Config Loading
// ═══════════════════════════════════════════════════════════════════════════════
ui.print.dim('── Config (config.yml) ──')

const configPath = container.paths.resolve('config.yml')
let config: Record<string, any> = {}

await test('config.yml exists', async () => {
  return fs.existsSync(configPath)
})

await test('config.yml is valid YAML', async () => {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8').toString('utf-8')
    config = yaml.parse(raw) || {}
    return typeof config === 'object'
  } catch (e: any) {
    return e.message
  }
})

await test('config has communications section', async () => {
  return 'communications' in config || 'Missing communications key in config.yml'
})

const commsConfig = config.communications || {}

await test('communications.imsg section present', async () => {
  return 'imsg' in commsConfig || 'Missing communications.imsg'
})

await test('communications.telegram section present', async () => {
  return 'telegram' in commsConfig || 'Missing communications.telegram'
})

await test('imsg.trustedSenders is an array', async () => {
  return Array.isArray(commsConfig.imsg?.trustedSenders) || 'trustedSenders missing or not an array'
})

await test('telegram.mode is polling or webhook', async () => {
  const mode = commsConfig.telegram?.mode
  return ['polling', 'webhook'].includes(mode) || `Got mode: ${mode}`
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Preferences Feature reads config
// ═══════════════════════════════════════════════════════════════════════════════
ui.print.dim('── Preferences Feature ──')

await test('preferences feature loads config.yml', async () => {
  const prefs = container.feature('preferences')
  const data = prefs.loopConfigFileData
  return typeof data === 'object' && data !== null
})

await test('preferences sees communications config', async () => {
  const prefs = container.feature('preferences')
  const data = prefs.loopConfigFileData
  return !!data?.communications || 'communications not in loopConfigFileData'
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. iMessage Feature
// ═══════════════════════════════════════════════════════════════════════════════
ui.print.dim('── iMessage Feature ──')

const proc = container.feature('proc')
let imsgInstalled = false

await test('imsg binary is on PATH', async () => {
  try {
    const result: any = await proc.exec('which imsg')
    const path = typeof result === 'string' ? result.trim() : (result?.stdout || '').toString().trim()
    imsgInstalled = path.length > 0
    return imsgInstalled || 'imsg not found'
  } catch {
    return 'imsg not found on PATH'
  }
})

if (imsgInstalled) {
  await test('imsg feature instantiates', async () => {
    const imsg = container.feature('imsg')
    return !!imsg
  })

  await test('imsg.chats() returns an array', async () => {
    const imsg = container.feature('imsg')
    const chats = await imsg.chats({ limit: 3 })
    return Array.isArray(chats) || `Got: ${typeof chats}`
  })

  await test('imsg chat objects have expected shape', async () => {
    const imsg = container.feature('imsg')
    const chats = await imsg.chats({ limit: 1 })
    if (!chats.length) return 'No chats found (empty inbox?)'
    const chat = chats[0]
    return ('id' in chat && 'identifier' in chat) || 'Missing id or identifier fields'
  })

  if (commsConfig.imsg?.enabled) {
    await test('imsg.watch() returns a stop handle', async () => {
      const imsg = container.feature('imsg')
      const watcher = imsg.watch()
      const hasStop = typeof watcher?.stop === 'function'
      if (hasStop) watcher.stop()
      return hasStop || 'watch() did not return { stop }'
    })
  } else {
    skip('imsg.watch()', 'imsg not enabled in config')
  }
} else {
  skip('imsg feature tests', 'imsg binary not installed')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Telegram Feature
// ═══════════════════════════════════════════════════════════════════════════════
ui.print.dim('── Telegram Feature ──')

const telegramToken = process.env.TELEGRAM_BOT_TOKEN

await test('TELEGRAM_BOT_TOKEN env var is set', async () => {
  return !!telegramToken || 'TELEGRAM_BOT_TOKEN is not set'
})

if (telegramToken) {
  await test('telegram feature instantiates with token', async () => {
    const tg = container.feature('telegram', { token: telegramToken })
    return !!tg
  })

  await test('telegram.getMe() returns bot info', async () => {
    const tg = container.feature('telegram', { token: telegramToken })
    const info = await tg.getMe()
    return (!!info?.username) || `Unexpected response: ${JSON.stringify(info)}`
  })

  await test('telegram bot username is a string', async () => {
    const tg = container.feature('telegram', { token: telegramToken })
    const info = await tg.getMe()
    return typeof info?.username === 'string' || `Got: ${typeof info?.username}`
  })

  await test('telegram config matches config.yml', async () => {
    const tgConfig = commsConfig.telegram || {}
    const mode = tgConfig.mode
    return mode === 'polling' || mode === 'webhook' || `Unexpected mode: ${mode}`
  })

  if (commsConfig.telegram?.trustedSenders?.length) {
    await test('telegram trustedSenders are populated', async () => {
      const senders = commsConfig.telegram.trustedSenders
      return senders.length > 0 && senders.every((s: any) => typeof s === 'string' || typeof s === 'number')
    })
  }
} else {
  skip('telegram feature tests', 'no TELEGRAM_BOT_TOKEN')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Communications Hub Feature
// ═══════════════════════════════════════════════════════════════════════════════
ui.print.dim('── Communications Hub ──')

await test('communications feature instantiates', async () => {
  const comms = container.feature('communications')
  return !!comms
})

await test('communications starts with no active channels', async () => {
  const comms = container.feature('communications')
  return comms.activeChannels.length === 0 || `Active channels: ${comms.activeChannels}`
})

await test('activateChannel("imsg") registers the channel', async () => {
  const comms = container.feature('communications')
  comms.activateChannel('imsg', {})
  return comms.activeChannels.includes('imsg')
})

if (telegramToken) {
  await test('activateChannel("telegram") registers the channel', async () => {
    const comms = container.feature('communications')
    comms.activateChannel('telegram', {})
    return comms.activeChannels.includes('telegram')
  })
}

await test('activateChannel rejects duplicates', async () => {
  const comms = container.feature('communications')
  const before = comms.activeChannels.length
  comms.activateChannel('imsg', {})
  return comms.activeChannels.length === before || 'Duplicate channel was added'
})

await test('communications emits "started" on start()', async () => {
  // Create a fresh communications instance to test start lifecycle
  // We'll test the event wiring without actually polling channels
  const comms = container.feature('communications')
  let startedEmitted = false
  comms.on('started', () => { startedEmitted = true })

  // Only start if we have channels that won't block (imsg watch is non-blocking)
  if (imsgInstalled && commsConfig.imsg?.enabled) {
    await comms.start()
    return startedEmitted || 'started event was not emitted'
  }
  return 'skipping start — would need enabled channels'
})

await test('communications "message" event is wired', async () => {
  const comms = container.feature('communications')
  // Verify the message:received -> message relay is set up
  let messageReceived = false
  comms.on('message', () => { messageReceived = true })
  // Simulate a channel message
  comms.emit('message:received', 'imsg', { text: 'test', sender: 'test@test.com' })
  return messageReceived || 'message event listener not wired'
})

await test('pause() and unpause() toggle state', async () => {
  const comms = container.feature('communications')
  comms.pause()
  if (!comms.isPaused) return 'pause() did not set paused state'
  comms.unpause()
  if (comms.isPaused) return 'unpause() did not clear paused state'
  return true
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. GWS Feature (basic probe)
// ═══════════════════════════════════════════════════════════════════════════════
ui.print.dim('── Google Workspace ──')

let gwsInstalled = false
await test('gws binary is on PATH', async () => {
  try {
    const result: any = await proc.exec('which gws')
    const path = typeof result === 'string' ? result.trim() : (result?.stdout || '').toString().trim()
    gwsInstalled = path.length > 0
    return gwsInstalled || 'gws not found'
  } catch {
    return 'gws not found on PATH'
  }
})

if (gwsInstalled) {
  await test('gws feature instantiates', async () => {
    const gws = container.feature('gws')
    return !!gws
  })

  await test('gws.profiles() returns an array', async () => {
    const gws = container.feature('gws')
    const profiles = gws.profiles()
    return Array.isArray(profiles) || `Got: ${typeof profiles}`
  })
} else {
  skip('gws feature tests', 'gws binary not installed')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Reaction Rules in Config
// ═══════════════════════════════════════════════════════════════════════════════
ui.print.dim('── Reaction Rules ──')

const rules = config.reactionRules || []

await test('reactionRules is an array (or absent)', async () => {
  return Array.isArray(rules)
})

if (rules.length) {
  await test('each rule has id, name, channel, assistant', async () => {
    for (const rule of rules) {
      if (!rule.id || !rule.name || !rule.channel || !rule.assistant) {
        return `Rule missing required fields: ${JSON.stringify(rule)}`
      }
    }
    return true
  })

  await test('each rule has action.type', async () => {
    for (const rule of rules) {
      const t = rule.action?.type
      if (!['auto-reply', 'notify', 'log'].includes(t)) {
        return `Invalid action type "${t}" in rule "${rule.name}"`
      }
    }
    return true
  })
} else {
  skip('reaction rule structure tests', 'no rules configured yet')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════
console.log()
console.log(colors.dim('─'.repeat(50)))
const total = passed + failed + skipped
const parts = [
  colors.green(`${passed} passed`),
  failed ? colors.red(`${failed} failed`) : null,
  skipped ? colors.yellow(`${skipped} skipped`) : null,
].filter(Boolean).join(colors.dim(' / '))

console.log(`  ${parts}  ${colors.dim(`(${total} total)`)}`)
console.log()

if (failed > 0) process.exit(1)
