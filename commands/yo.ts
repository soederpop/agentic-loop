import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'simulate a wakeword driven voice command flow by typing instead'

export const positionals = ['cmd', 'target']

export const argsSchema = z.object({
  _: z.array(z.union([z.string(),z.number()])).describe('the words that come after'),
  target: z.string()
    .optional()
    .describe('Which assistant to route to'),
  dry: z.boolean().default(false).describe('Dry run — show routing info without executing'),
})

/**
 * Examples:
 * ```shell
 * luca yo friday open up the console
 * luca yo chief what is the weather in tokyo
 * cat some-file.md | luca yo chief
 * echo "open the console" | luca yo friday
 * ```
 */
export default async function yo(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  await container.helpers.discoverAll()

  const target = (options._[1] || options.target).toLowerCase()

  // positional args after target
  const argsText = options._.slice(2).join(' ').trim()

  // Read from stdin if no args text provided (supports piping)
  let text = argsText
  if (!text) {
    const chunks: Buffer[] = []
    const stdin = process.stdin
    if (!stdin.isTTY) {
      for await (const chunk of stdin) {
        chunks.push(chunk)
      }
      text = Buffer.concat(chunks).toString('utf-8').trim()
    }
  }

  if (!text) {
    console.log(`${ui.colors.red('No command text provided.')}`)
    console.log(`Usage: luca yo <target> <command words...>`)
    console.log(`       cat file.md | luca yo chief`)
    process.exit(1)
  }

  const isChief = target === 'chief' || target === 'chiefofstaff'

  // Check if luca main authority is running — if so, relay through it
  const instanceRegistry = container.feature('instanceRegistry')
  const networking = container.feature('networking')
  const instance = instanceRegistry.getSelf()
  const mainPort = instance?.ports.authority ?? 4410
  const authorityRunning = instance ? !(await networking.isPortOpen(mainPort)) : false

  if (authorityRunning && !options.dry) {
    console.log(ui.colors.dim('(relaying through luca main)'))
    await relayThroughAuthority(container, mainPort, target, text, ui)
    return
  }

  const assistantsManager = await container.feature('assistantsManager').discover()

  if (assistantsManager.available.indexOf(target) > -1 ) {
	const mgr = await assistantsManager.create(target) 
	await mgr.ask(text).then(r => ui.print(ui.markdown(r)))
	return 
  }


  // Standalone mode — boot voice service locally
  const voiceService = container.feature('voiceService' as any) as any
  const router = voiceService.router

  // Start the router (loads handlers, dictionary, phrases)
  await router.start()

  // Dry run mode — just show what would match
  if (options.dry) {
    const inspection = await router.inspect(text)
    console.log()
    console.log(ui.colors.dim('── dry run ──'))
    console.log(`Target:     ${target}`)
    console.log(`Text:       ${inspection.text}`)
    console.log(`Normalized: ${inspection.normalizedText}`)
    if (inspection.parsed) {
      console.log(`Intent:     ${inspection.parsed.intent || '(none)'}`)
      console.log(`Subject:    ${inspection.parsed.subject || '(none)'}`)
      console.log(`Target:     ${inspection.parsed.target || '(none)'}`)
    }
    if (inspection.dictionary?.textMatches?.length) {
      console.log(`Dictionary: ${inspection.dictionary.textMatches.map((m: any) => `${m.key} (${m.section})`).join(', ')}`)
    }
    console.log()
    for (const m of inspection.matches) {
      const icon = m.matched ? ui.colors.green('✓') : ui.colors.dim('·')
      console.log(`  ${icon} ${m.name}${m.matched ? ui.colors.green(' ← would execute') : ''}`)
    }
    if (!inspection.firstMatched) {
      console.log(`  ${ui.colors.yellow('→')} No handler match — would fall through to ${isChief ? 'chief chat' : 'voice assistant'}`)
    }
    return
  }

  if (isChief) {
    // Chief path: boot the chief chat and ask directly
    const chiefChat = voiceService.chiefChat
    const caps = await chiefChat.checkCapabilities()

    if (!caps.available) {
      console.log(ui.colors.yellow(`Chief chat unavailable: ${caps.missing.join(', ')}`))
      console.log(ui.colors.dim('Routing through voice router instead...'))
      await routeThroughRouter(router, text, voiceService, ui)
      return
    }

    await chiefChat.start()
    console.log(ui.colors.dim('Asking chief of staff...'))
    const response = await chiefChat.ask(text)
    console.log()
    console.log(`${ui.colors.blue('Chief')} ${ui.colors.dim('>')} ${response}`)
  } else if (assistant) {
    // Friday / default path: route through voice router
    await routeThroughRouter(router, text, voiceService, ui)
  }

  // Stop the file watcher so the process can exit
  router.stopWatchingHandlers()

  // Wait for any afplay processes to finish before exiting
  while (container.proc.isProcessRunning('afplay')) {
    await container.sleep(50)
  }
}

/**
 * Relay voice command through the running luca main authority via WebSocket.
 */
async function relayThroughAuthority(container: any, port: number, target: string, text: string, ui: any) {
  const ws = container.client('websocket', {
    baseURL: `ws://localhost:${port}`,
    json: true,
  })

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.disconnect()
      console.log(ui.colors.yellow('Relay timed out — authority may be busy'))
      reject(new Error('Relay timed out'))
    }, 30_000)

    ws.on('open', () => {
      ws.send({
        type: 'command',
        payload: { action: 'voice-route', text, target },
      })
    })

    ws.on('message', (msg: any) => {
      // Ignore non-response messages (initial state snapshot, broadcast logs/events)
      if (msg.type && msg.type !== 'response') return

      clearTimeout(timeout)
      ws.disconnect()

      if (msg.error) {
        console.log(ui.colors.red(`Error: ${msg.error}`))
        resolve()
        return
      }

      const data = msg.data || msg

      if (data.response) {
        const label = data.source === 'chief' ? 'Chief' : 'Friday'
        console.log()
        console.log(`${ui.colors.blue(label)} ${ui.colors.dim('>')} ${data.response}`)
      } else if (data.matched) {
        // Handler executed — result is in data.result
        if (data.result?.error) {
          console.log(ui.colors.red(`Handler error: ${data.result.error}`))
        }
        // Otherwise handler ran successfully (side effects like TTS already happened in authority)
      } else if (data.error) {
        console.log(ui.colors.yellow(data.error))
      }

      resolve()
    })

    ws.on('error', (err: any) => {
      clearTimeout(timeout)
      console.log(ui.colors.yellow(`Could not reach luca main: ${err?.message || err}`))
      console.log(ui.colors.dim('Falling back to standalone mode...'))
      // Don't reject — we could fall back, but for simplicity just report
      resolve()
    })

    ws.connect()
  })
}

async function routeThroughRouter(router: any, text: string, voiceService: any, ui: any) {
  const result = await router.route({
    id: `yo-${Date.now()}`,
    source: 'yo',
    text,
    payload: { text, source: 'yo' },
    isFinished: false,
    ack: () => true,
    progress: () => true,
    finish: (data: any) => {
      if (data?.result?.action === 'unknown') {
        console.log(ui.colors.yellow('Handler reported unknown action'))
      }
      return true
    },
    fail: (data: any) => {
      console.log(ui.colors.red(`Command failed: ${data?.error}`))
      return true
    },
  })

  if (!result.matched) {
    console.log(ui.colors.dim('No handler matched — asking voice assistant...'))

    const voiceAssistantChat = voiceService.voiceAssistantChat
    const caps = await voiceAssistantChat.checkCapabilities()

    if (!caps.available) {
      console.log(ui.colors.yellow(`Voice assistant unavailable: ${caps.missing.join(', ')}`))
      return
    }

    await voiceAssistantChat.start()
    const response = await voiceAssistantChat.ask(text)
    console.log()
    console.log(`${ui.colors.blue('Friday')} ${ui.colors.dim('>')} ${response}`)
  }
}
