import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'System status and project overview for the agentic loop'

export const positionals = ['target']

export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
})

export default async function getStarted(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  const fs = container.feature('fs')
  const ui = container.feature('ui')
  const colors = ui.colors
  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs')
  })

  // ── ASCII Art Banner ──
  console.log('')
  console.log(colors.cyan(await ui.asciiArt('Agentic Loop')))
  console.log('')

  // ── System Status ──
  const ok = colors.green('✓')
  const no = colors.red('✗')
  const dim = colors.dim

  console.log(colors.bold('  System Status'))
  console.log(dim('  ─────────────────────────────────'))

  // Native app window launcher
  const appPath = container.paths.resolve('apps/presenter-windows/dist/LucaVoiceLauncher.app')
  const appBuilt = fs.existsSync(appPath)
  console.log(`  ${appBuilt ? ok : no} Native App Launcher   ${appBuilt ? dim('built') : dim('not built — run apps/presenter-windows/scripts/build-app.sh')}`)

  // Voice capabilities
  let handlerCount = 0
  try {
    const fileManager = container.feature('fileManager') as any
    await fileManager.start()
    handlerCount = fileManager.match('commands/voice/handlers/**/*.ts').length
  } catch {}

  const assistants = (() => {
    try {
      const manager = container.feature('assistantsManager') as any
      manager.discover()
      return manager.list().filter((a: any) => a.hasVoice)
    } catch { return [] }
  })()

  console.log(`  ${handlerCount > 0 ? ok : no} Voice Handlers         ${dim(`${handlerCount} handler(s) discovered`)}`)
  console.log(`  ${assistants.length > 0 ? ok : no} Voice Assistants       ${dim(`${assistants.length} assistant(s) with voice config`)}`)

  // API keys
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  console.log(`  ${hasElevenLabs ? ok : no} ElevenLabs API Key     ${hasElevenLabs ? dim('set') : dim('missing — add ELEVENLABS_API_KEY to .env')}`)
  console.log(`  ${hasOpenAI ? ok : no} OpenAI API Key         ${hasOpenAI ? dim('set') : dim('missing — add OPENAI_API_KEY to .env')}`)

  console.log(dim('  ─────────────────────────────────'))
  console.log('')

  // ── Vision & Content Status ──
  const visionHash = container.utils.hashObject({
    vision: fs.readFile(`docs/VISION.md`)
  })
  const hasVision = visionHash !== '6pvu54'

  await docs.load()
  const numberOfGoals = await docs.queries.goals.count()
  const numberOfIdeas = await docs.queries.ideas.count()

  console.log(`  ${hasVision ? ok : no} Vision                 ${hasVision ? dim('customized') : dim('default')}`)
  console.log(`  ${numberOfGoals > 0 ? ok : no} Goals                  ${dim(`${numberOfGoals} defined`)}`)
  console.log(`  ${numberOfIdeas > 0 ? ok : no} Ideas                  ${dim(`${numberOfIdeas} captured`)}`)
  console.log('')

  // ── Next Steps ──
  if (!hasVision) {
    console.log(colors.yellow('  Next up: Define your vision!'))
    console.log(dim('  Open docs/VISION.md in your editor, or run:'))
    console.log(colors.cyan('    luca chat chiefOfStaff'))
    console.log(dim('  and ask him to help you define your vision.'))
    console.log('')
  } else if (numberOfGoals === 0) {
    console.log(colors.yellow('  Next up: Set some goals for your vision!'))
    console.log(dim('  Create one directly:'))
    console.log(colors.cyan('    cnotes create goal --title "whatever"'))
    console.log(dim('  Or run:'))
    console.log(colors.cyan('    luca chat chiefOfStaff'))
    console.log(dim('  and ask him to help you define some goals.'))
    console.log('')
  } else {
    console.log(colors.green('  You have a vision and goals — nice.'))
    console.log(dim('  Chat with the assistant to brainstorm ideas for your goals:'))
    console.log(colors.cyan('    luca chat chiefOfStaff'))
    console.log(dim('  Ask him to help you record some ideas.'))
    console.log('')
  }
}