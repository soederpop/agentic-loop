import type { VoiceHandler } from '../../types'

const handler: VoiceHandler = {
	name: 'terminal',
	description: 'Opens up a terminal window',
	keywords: ['repl', 'console'],

	match(ctx) {
		return (
			ctx.normalizedText.includes('terminal')
		)
	},

	async execute(ctx) {
		const { cmd, container, windowManager } = ctx

		ctx.playPhrase('terminal')
		cmd.ack()

		await windowManager.spawnTTY({
			command: 'zsh',
			args: [],
			cwd: container.cwd
		})

		await container.sleep(3000)
		ctx.playPhrase('generic-finish')
		cmd.finish({ result: { action: 'completed', text: cmd.text } })
	},
}

export default handler
