import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Run, list, or create workflows'

export const positionals = ['action', 'target']

export const argsSchema = z.object({
  action: z.string().describe('run,list,create').optional().default('run'),
  target: z.string().optional().describe('The workflow you want to run'),
  'open-browser': z.boolean().default(false).describe('Open in browser instead of window manager'),
  json: z.boolean().default(false).describe('Output as JSON'),
})

export default async function workflow(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  let { action, target } = options
  const ui = container.feature('ui')

  await container.helpers.discoverAll()

  const wm = container.feature('windowManager') as WindowManager

  let actualPort: number | undefined

  const library = container.feature('workflowLibrary')

  if (!library.isLoaded) await library.discover()

  if(library.get(action)) {
	  target = action
	  action = 'run'
  }

  const info = target ? library.get(target) : undefined

  if (action === 'run' && !info) {
	  ui.print.red(`Invalid workflow! ${library.workflows.map(w => w.name).join(",")}`)
	  return
  }

  switch (action) {
    case 'run': {
      if (!target) {
        ui.print.red('Usage: luca workflow run <name>')
        ui.print.yellow(`Available: ${library.workflows.map((w) => w.name).join(', ')}`)
        return
      }

      if (!info) {
        ui.print.red(`Workflow not found: ${target}`)
        ui.print.yellow(`Available: ${library.workflows.map((w) => w.name).join(', ')}`)
        return
      }

      ui.print.cyan(`Starting workflow: ${info.title}`)
      if (info.description) ui.print.dim(info.description)

      // Check if our own luca main is running with a workflow service
      const { readCurrentInstance } = await import('../features/instance-registry')
      const currentInstance = readCurrentInstance()
      let serviceRunning = false

      if (currentInstance?.ports?.workflow) {
        try {
          const check = await fetch(`http://localhost:${currentInstance.ports.workflow}/api/workflows`)
          serviceRunning = check.ok
        } catch {}
      }

      if (serviceRunning) {
        actualPort = currentInstance!.ports.workflow
      } else {
        // No local luca main — start in-process with a non-colliding port
        console.log('[workflow] service not detected — starting in-process (tip: run `luca main` for persistent service)')
        await container.helpers.discover('features')
        const registry = container.feature('instanceRegistry')
        registry.pruneStale()
        const ports = await registry.allocatePorts()
        const service = container.feature('workflowService', { port: ports.workflow })
        await service.start()
        actualPort = service.port!
        console.log(`[workflow] service listening on http://localhost:${actualPort}`)
      }
      const pageUrl = `http://localhost:${actualPort}/workflows/${target}/`
      const openInBrowser = () => container.feature('opener').open(pageUrl)

      if (options['open-browser']) {
        await openInBrowser()
      } else {
        try {
          const launchedWindow = await Promise.race([
            wm.spawn({ url: pageUrl }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
          ])

          const launchedWindowId = String(launchedWindow?.result?.windowId || launchedWindow?.windowId || '').toLowerCase()

          if (launchedWindowId) {
            
            const windowCount = await wm.wmListWindows().then((r: any) => r.count as number)
            
            if (windowCount === 1) {

            } else if (windowCount < 4) {
              // await wm.wmArrangeWindows({ pattern: 'row', gap: 10 })
            } else if (windowCount >= 4) {
              await wm.wmArrangeWindows({ pattern: 'grid', gap: 10 })
            }

            wm.on('windowClosed', (msg: any) => {
              const closedId = String(msg?.windowId || '').toLowerCase()
              if (closedId === launchedWindowId) {
                process.exit(0)
              }
            })
          }
        } catch(e) {
          console.error(e)
          console.log('[workflow] window manager failed or timed out, falling back to browser')
          await openInBrowser()
        }
      }

      process.on('SIGINT', () => process.exit(0))
      process.on('SIGTERM', () => process.exit(0))

      await new Promise(() => {})

      break
    }
    case 'list': {
      const workflows = library.workflows

      if (options.json) {
        console.log(JSON.stringify(workflows, null, 2))
        return
      }

      if (workflows.length === 0) {
        ui.print.yellow('No workflows found in workflows/')
        return
      }

      ui.print.cyan(`\n  Workflows (${workflows.length})\n`)
      for (const w of workflows) {
	      console.log(`${w.name}\n  run with \`luca workflow ${w.name}\``)
      }
      console.log()
      break
    }
    case 'create':
      ui.print.yellow('Create workflow — not yet implemented')
      break
    default:
      ui.print.red('Unknown action: run, list, create')
  }
}
