import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'simulate a wakeword driven voice command flow by typing instead'

export const positionals = ['target']

export const argsSchema = z.object({
  _: z.array(z.string()).describe('the words that come after'),
  target: z.string()
    .optional()
    .describe('Which assistant to route to (friday, chief)'),
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

  const target = (options.target || 'friday').toLowerCase()
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

  console.log(`${ui.colors.dim(isChief ? '🎖  chief' : '📡 friday')} ${ui.colors.green('>')} ${text}`)

  // Boot the voice service subsystems (router + chats, no wake word listener)
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
  } else {
    // Friday / default path: route through voice router
    await routeThroughRouter(router, text, voiceService, ui)
  }
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
