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

  const wm = container.feature('windowManager')
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

      if (!info.hasServeHook) {
        ui.print.red(`Workflow "${target}" has no luca.serve.ts — cannot run it as a server`)
        return
      }

      const setupPath = container.paths.resolve(info.folderPath, 'luca.serve.ts')
      const endpointsDir = container.paths.resolve(info.folderPath, 'endpoints')
      const serveArgs = ['serve', '--setup', setupPath, '--no-open', '--endpoints-dir', endpointsDir, '--any-port']

      if (info.hasPublicDir) {
        serveArgs.push('--staticDir', container.paths.resolve(info.folderPath, 'public'))
      }

      ui.print.cyan(`Starting workflow: ${info.title}`)
      if (info.description) ui.print.dim(info.description)

      // Parse the actual port from the server's "listening on" message
      const onOutputListeners: Array<(output: string) => void> = []
      const portReady = new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(0), 15000)
        onOutputListeners.push((output: string) => {
          const match = String(output).match(/listening on http:\/\/localhost:(\d+)/)
          if (match) {
            clearTimeout(timeout)
            resolve(Number(match[1]))
          }
        })
      })

      // Start the server in the background
      console.log(`[workflow] spawning luca ${serveArgs.join(' ')}`)
      const serverProcess = container.proc.spawnAndCapture('luca', serveArgs, {
	      onOutput(output: string) {
          const line = String(output).trim()
          console.log(`[workflow:stdout] ${line}`)
          for (const listener of onOutputListeners) listener(line)
        },
	      onError(output: string) {
          console.log(`[workflow:stderr] ${String(output).trim()}`)
        },
      })

      // Wait for the server to report its actual port
      actualPort = await portReady
      if (!actualPort) {
        ui.print.red('Server failed to start within 15 seconds')
        return
      }

      console.log(`[workflow] server ready on port ${actualPort}`)
      ui.print.dim(`http://localhost:${actualPort}`)

      const pageUrl = `http://localhost:${actualPort}`
      const openInBrowser = () => container.feature('opener').open(pageUrl)

      if (options['open-browser']) {
        await openInBrowser()
      } else {
        try {
          const launchedWindow = await Promise.race([
            wm.spawn({ url: pageUrl }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6500)),
          ])

          const launchedWindowId = String(launchedWindow?.result?.windowId || launchedWindow?.windowId || '').toLowerCase()

          if (launchedWindowId) {
            console.log(`[workflow] tracking window ${launchedWindowId} for auto-cleanup`)
            wm.on('windowClosed', (msg: any) => {
              const closedId = String(msg?.windowId || '').toLowerCase()
              if (closedId === launchedWindowId) {
                console.log(`[workflow] window closed, shutting down server`)
                process.exit(0)
              }
            })
          }
        } catch {
          console.log('[workflow] window manager failed or timed out, falling back to browser')
          await openInBrowser()
        }
      }

      process.on('SIGINT', () => process.exit(0))
      process.on('SIGTERM', () => process.exit(0))

      await serverProcess

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
