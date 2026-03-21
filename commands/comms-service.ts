import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import type { Communications } from '../features/communications'

export const description = 'A command that does something useful'

export const argsSchema = z.object({
  _: z.array(z.union([z.string(), z.number()])),
  imsg: z.boolean().default(false).describe('Whether to listen on the imessage channel for new messages'),
  telegram: z.boolean().default(false).describe('Whether to listen on the telegram channel for new messages'),
  gmail: z.boolean().default(false).describe('Whether to listen on the gmail channel for new messages'),
})

export default async function commsService(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')
  const comms = container.feature('communications')
  
  await start(comms, options)
}

async function start(service: Communications, options: z.infer<typeof argsSchema>) {
  service.on('message', ({ channel, payload }) => {
    console.log('received message on channel', channel, payload)
  })
  
  if (options.imsg) {
    service.activateChannel('imsg', {})
  }

  if (options.telegram) {
    service.activateChannel('telegram', {})
  }
  
  service.start()
  
  await service.waitFor('stopped')
}