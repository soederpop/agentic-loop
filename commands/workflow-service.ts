import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Start the unified workflow service — serves all workflows from one process'

export const argsSchema = z.object({
  port: z.number().default(7700).describe('Port to listen on (default 7700)'),
  'no-open': z.boolean().default(false).describe('Skip opening the browser after start'),
})

export default async function workflowService(
  options: z.infer<typeof argsSchema>,
  context: ContainerContext,
) {
  const { container } = context
  const ui = container.feature('ui')

  await container.helpers.discoverAll()

  const service = container.feature('workflowService')

  ui.print.cyan('\n  Starting workflow service…\n')

  const port = options.port

  await service.start({ port })

  // Print discovered workflow URLs
  const library = container.feature('workflowLibrary')
  const workflows = library.workflows.filter((w: any) => w.hasPublicDir)

  ui.print.cyan(`  Listening on http://localhost:${port}\n`)
  ui.print.dim(`  LAN: http://0.0.0.0:${port}\n`)
  console.log()

  for (const w of workflows) {
    const url = `http://localhost:${port}/workflows/${w.name}/`
    ui.print.dim(`  ${w.name.padEnd(20)}`)
    process.stdout.write(`\x1b[36m${url}\x1b[0m\n`)
  }

  console.log()
  ui.print.dim(`  API: http://localhost:${port}/api/workflows`)
  console.log()

  if (!options['no-open']) {
    try {
      await container.feature('opener').open(`http://localhost:${port}`)
    } catch {
      // opener optional — non-fatal
    }
  }

  process.on('SIGINT', async () => {
    ui.print.dim('\n  Shutting down workflow service…')
    await service.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await service.stop()
    process.exit(0)
  })

  await new Promise(() => {})
}
