import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Talk to an assistant by name — voice mode if it has a voice config, text otherwise'

export const positionals = ['cmd', 'target']

export const argsSchema = z.object({
  _: z.array(z.union([z.string(),z.number()])).describe('the words that come after'),
  target: z.string()
    .optional()
    .describe('Which assistant to route to'),
  text: z.boolean().default(false).describe('Force text mode — pretty-printed markdown output'),
  dry: z.boolean().default(false).describe('Dry run — show routing info without executing'),
})

/**
 * Examples:
 * ```shell
 * luca yo friday open up the console
 * luca yo chief what is the weather in tokyo
 * cat some-file.md | luca yo chief
 * echo "tell me a joke" | luca yo friday
 * luca yo friday --text what are you working on
 * ```
 */
export default async function yo(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  await container.helpers.discoverAll()

  const target = String(options._[1] || options.target || '').toLowerCase()

  if (!target) {
    console.log(`${ui.colors.red('No target assistant provided.')}`)
    console.log(`Usage: luca yo <assistant> <message...>`)
    process.exit(1)
  }

  // positional args after target
  const argsText = options._.slice(2).join(' ').trim()

  // Read from stdin if no args text provided (supports piping)
  let message = argsText
  if (!message) {
    const chunks: Buffer[] = []
    const stdin = process.stdin
    if (!stdin.isTTY) {
      for await (const chunk of stdin) {
        chunks.push(chunk)
      }
      message = Buffer.concat(chunks).toString('utf-8').trim()
    }
  }

  if (!message) {
    console.log(`${ui.colors.red('No message text provided.')}`)
    console.log(`Usage: luca yo <assistant> <message words...>`)
    console.log(`       cat file.md | luca yo chief`)
    process.exit(1)
  }

  // Resolve assistant
  const assistantsManager = await container.feature('assistantsManager').discover()
  const matchedAssistant = assistantsManager.available.find(
    (name: string) => name.toLowerCase() === target
  )

  if (!matchedAssistant) {
    console.log(`${ui.colors.red(`Unknown assistant: ${target}`)}`)
    console.log(`Available: ${assistantsManager.available.join(', ')}`)
    process.exit(1)
  }

  // Check if assistant has a voice config
  const entry = assistantsManager.get(matchedAssistant)
  const hasVoiceConfig = !!entry?.hasVoice

  const useVoice = hasVoiceConfig && !options.text

  // Dry run mode — show what we know
  if (options.dry) {
    console.log()
    console.log(ui.colors.dim('── dry run ──'))
    console.log(`Target:      ${matchedAssistant}`)
    console.log(`Message:     ${message}`)
    console.log(`Voice config: ${hasVoiceConfig ? ui.colors.green('yes') : ui.colors.yellow('no')}`)
    console.log(`Mode:        ${useVoice ? ui.colors.cyan('voice') : ui.colors.blue('text')}`)
    if (options.text && hasVoiceConfig) {
      console.log(`             ${ui.colors.dim('(--text flag overrides voice mode)')}`)
    }
    return
  }

  if (useVoice) {
    // Voice mode — use voiceChat for spoken interaction
    console.log(ui.colors.dim(`(voice mode → ${matchedAssistant})`))

    const voiceChat = container.feature('voiceChat', {
      assistant: matchedAssistant,
    }) as any

    await voiceChat.start()
    const response = await voiceChat.say(message)

    console.log()
    console.log(`${ui.colors.blue(matchedAssistant)} ${ui.colors.dim('>')} ${response}`)

    // Wait for any afplay processes to finish before exiting
    while (container.proc.isProcessRunning('afplay')) {
      await container.sleep(50)
    }
  } else {
    // Text mode — ask the assistant and pretty-print markdown
    console.log(ui.colors.dim(`(text mode → ${matchedAssistant})`))

    const mgr = assistantsManager.create(matchedAssistant)
    const response = await mgr.ask(message)

    console.log()
    ui.print(ui.markdown(response))
  }
}
