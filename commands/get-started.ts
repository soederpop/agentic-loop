import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'A command that does something useful'

// Map positional args to named options: luca get-started myTarget => options.target === 'myTarget'
export const positionals = ['target']

export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
})

export default async function getStarted(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  
  const fs = container.feature('fs')
  const ui = container.feature('ui')

  
  const visionHash = container.utils.hashObject({
    vision: fs.readFile(`docs/VISION.md`)
  })
  
  if (visionHash === '6pvu54') {
    ui.print.red(`You lack vision?`)
  }
  
  console.log(visionHash)
}