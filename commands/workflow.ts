import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Run, list, or create workflows'

export const positionals = ['action', 'target']

export const argsSchema = z.object({
  action: z.string().describe('run,list,create').optional().default('run'),
  target: z.string().optional().describe('The workflow you want to run'),
  port: z.number().default(7700).describe('Port to serve the workflow on'),
  json: z.boolean().default(false).describe('Output as JSON'),
})

export default async function workflow(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  let { action, target, port } = options
  const ui = container.feature('ui')

  await container.helpers.discoverAll()

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

      const actualPort = port || info.port || 7700
      const setupPath = container.paths.resolve(info.folderPath, 'luca.serve.ts')
      const endpointsDir = container.paths.resolve(info.folderPath, 'endpoints')
      const serveArgs = ['serve', '--setup', setupPath, '--port', String(actualPort), '--no-open', '--endpoints-dir', endpointsDir, '--force']

      if (info.hasPublicDir) {
        serveArgs.push('--staticDir', container.paths.resolve(info.folderPath, 'public'))
      }

      ui.print.cyan(`Starting workflow: ${info.title}`)
      if (info.description) ui.print.dim(info.description)
      ui.print.dim(`http://localhost:${actualPort}`)

      const windowManager = container.feature('windowManager')
      await windowManager.listen()

      const networking = container.feature('networking')
      const pageUrl = `http://localhost:${actualPort}`

      // Start the server in the background
      console.log(`[workflow] spawning luca ${serveArgs.join(' ')}`)
      const serverProcess = container.proc.spawnAndCapture('luca', serveArgs, {
	      onOutput(output) {
          console.log(`[workflow:stdout] ${String(output).trim()}`)
        },
	      onError(output: string) {
          console.log(`[workflow:stderr] ${String(output).trim()}`)
        },
      })

      // Poll until the port is accepting connections
      console.log(`[workflow] polling port ${actualPort}...`)
      const maxWait = 15000
      const start = Date.now()
      let portReady = false
      while (Date.now() - start < maxWait) {
        const open = await networking.isPortOpen(actualPort)
        if (!open) {
          portReady = true
          break
        }
        await new Promise((r) => setTimeout(r, 250))
      }
      console.log(`[workflow] port ${actualPort} ready=${portReady} (waited ${Date.now() - start}ms)`)

      await container.feature('opener').open(`http://localhost:${actualPort}`)

      // Wait for the server process to finish
      const result = await serverProcess

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
