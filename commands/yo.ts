import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Talk to an assistant by name — voice mode if it has a voice config, text otherwise'

export const positionals = ['cmd', 'target']

const envBool = (key: string) => process.env[key] === '1' || process.env[key] === 'true'
const envStr = (key: string) => process.env[key] || undefined

export const argsSchema = z.object({
  _: z.array(z.union([z.string(),z.number()])).describe('the words that come after'),
  target: z.string()
    .optional()
    .default(envStr('YO_TARGET') ?? '')
    .describe('Which assistant to route to (env: YO_TARGET)'),
  mode: z.enum(['voice','text'])
    .default((envStr('YO_MODE') as 'voice' | 'text') ?? 'voice')
    .describe('How you want the assistant to respond (env: YO_MODE)'),
  summarize: z.boolean()
    .default(envBool('YO_SUMMARIZE'))
    .describe('Summarize long responses into audio-friendly chunks before speaking (env: YO_SUMMARIZE)'),
  dry: z.boolean()
    .default(envBool('YO_DRY'))
    .describe('Dry run — show routing info without executing (env: YO_DRY)'),
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

  const useVoice = hasVoiceConfig && options.mode == 'voice'

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
    // Voice mode — use voiceMode feature attached to the assistant
    console.log(ui.colors.dim(`(voice mode → ${matchedAssistant})`))

    const assistant = assistantsManager.create(matchedAssistant, {
      maxTokens: 250,
      temperature: 0.3,
    })

    // Read voice.yaml to configure voiceMode
    const yaml = container.feature('yaml')
    const voiceConfigPath = assistant.paths.join('voice.yaml')
    const voiceCfg = yaml.parse(container.fs.readFile(voiceConfigPath))
    const provider = voiceCfg.provider || 'elevenlabs'

    const voiceModeOpts: Record<string, any> = {
      provider,
      conversationModePrefix: voiceCfg.conversationModePrefix,
      maxChunkLength: voiceCfg.maxChunkLength || 200,
      summarize: options.summarize,
    }

    if (provider === 'voicebox') {
      voiceModeOpts.voicebox = {
        profileId: voiceCfg.voicebox?.profileId,
        engine: voiceCfg.voicebox?.engine || 'qwen',
        modelSize: voiceCfg.voicebox?.modelSize || '1.7B',
        language: voiceCfg.voicebox?.language || 'en',
        instruct: voiceCfg.voicebox?.instruct,
      }
    } else {
      voiceModeOpts.voiceId = voiceCfg.voiceId
      voiceModeOpts.modelId = voiceCfg.modelId || 'eleven_v3'
      voiceModeOpts.voiceSettings = voiceCfg.voiceSettings
    }

    const voiceMode = container.feature('voiceMode', voiceModeOpts)
    assistant.use(voiceMode)
    await assistant.start()

    // Stream text to terminal as it arrives
    console.log()
    process.stdout.write(`${ui.colors.blue(matchedAssistant)} ${ui.colors.dim('>')} `)
    assistant.on('chunk', (chunk: string) => {
      process.stdout.write(chunk)
    })
    assistant.on('response', () => {
      process.stdout.write('\n')
    })

    await assistant.ask(message)

    // Wait for speech to finish playing
    await voiceMode.waitForSpeechDone()

    // Safety net for any straggler afplay
    while (container.proc.isProcessRunning('afplay')) {
      await container.sleep(50)
    }

    process.exit(0)
  } else {
    // Text mode — ask the assistant and pretty-print markdown
    console.log(ui.colors.dim(`(text mode → ${matchedAssistant})`))

    const mgr = assistantsManager.create(matchedAssistant)
    const response = await mgr.ask(message)

    console.log()
    ui.print(ui.markdown(response))
  }
}
