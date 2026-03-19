import type { VoiceHandler } from '../../types'

const handler: VoiceHandler = {
	name: 'monitor',
	description: 'Opens the luca monitor dashboard',
	keywords: ['monitor', 'dashboard', 'status'],

	match(ctx) {
		return ctx.normalizedText.includes('monitor')
	},

	async execute(ctx) {
		const { cmd, container, windowManager } = ctx

		ctx.playPhrase('generic-ack')
		cmd.ack()

		await windowManager.spawnTTY({
			command: 'luca',
			args: ['main'],
			cwd: container.cwd,
			x: 0,
			y: 0,
			height: '100%',
			width: '50%',
		})

		await container.sleep(3000)
		ctx.playPhrase('generic-finish')
		cmd.finish({ result: { action: 'completed', text: cmd.text } })
	},
}

export default handler
