/**
 * about — Display project information and discovered helpers.
 * Run with: luca about
 *
 * Positional words after the command name are available as options._
 * For example: `luca about commands` → options._[1] === 'commands'
 */
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Display project information and discovered helpers'

export const argsSchema = z.object({})

export default async function about(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  // Discover all project-level helpers (commands, features, endpoints, etc.)
  const discovered = await container.helpers.discoverAll()

  const projectName = container.paths.resolve('.').split('/').pop() || 'project'

  ui.print.cyan(`\n  ${projectName}\n`)
  ui.print('  Powered by luca — Lightweight Universal Conversational Architecture\n')

  const types = ['features', 'clients', 'servers', 'commands', 'endpoints']

  for (const type of types) {
    const names = discovered[type] || []
    if (names.length > 0) {
      ui.print.green(`  ${type} (${names.length})`)
      for (const name of names) {
        ui.print(`    • ${name}`)
      }
    }
  }

  const totalBuiltIn = types.reduce((sum: number, t: string) => sum + (container[t]?.available?.length || 0), 0)
  ui.print.dim(`\n  ${totalBuiltIn} built-in helpers available. Run \`luca describe\` for details.\n`)
}
