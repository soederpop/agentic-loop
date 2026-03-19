import type { VoiceHandler } from '../../types'

const handler: VoiceHandler = {
	name: 'console',
	description: 'Opens up a luca console',
	keywords: ['repl', 'console'],

	match(ctx) {
		return (
			ctx.normalizedText.includes('console') || ctx.normalizedText.includes('repl')
		)
	},

	async execute(ctx) {
		const { cmd, container, windowManager } = ctx

		ctx.playPhrase('generic-ack')
		cmd.ack()

		await windowManager.spawnTTY({
			command: 'luca',
			args: ['console'],
			cwd: container.cwd
		})

		await container.sleep(3000)
		ctx.playPhrase('generic-finish')
		cmd.finish({ result: { action: 'completed', text: cmd.text } })
	},
}

export default handler
