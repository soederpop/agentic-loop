import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({
  verbose: z.boolean().default(false).describe('Show detailed output from sox and whisper'),
})

async function dictate(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	const assistantId = options._[1] || 'chiefOfStaff'

	await container.helpers.discover('features')

	const listener = await container.feature('voiceListener')
	const chat = await container.feature('voiceChat', { assistant: assistantId, playPhrases: true })

	await chat.start()

	const text = await listener.listen()

	await chat.ask(text)
}

async function yo() {
	await container.helpers.discover('features')

	const listener = container.feature('voiceListener')

	if (options.verbose) {
		listener.on('output', (str:string) => console.log(str))
	} else {
		listener.once('recording:start', () => container.ui.print.red('MIC IS HOT'))
	}

	const transcript = await listener.listen()

	console.log(transcript)
}

export default {
	description: 'Record speech and transcribe it with mlx-whisper',
	argsSchema,
	handler: dictate,
}
