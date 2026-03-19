import type { VoiceHandler } from '../../types'

const handler: VoiceHandler = {
	name: 'draw',
	description: 'Open Excalidraw for drawing and diagrams',
	keywords: ['lets draw', 'draw a diagram', 'excalidraw'],

	match(ctx) {
		return (
			ctx.normalizedText.includes('draw') ||
			ctx.normalizedText.includes('diagram') ||
			ctx.normalizedText.includes('excalidraw')
		)
	},

	async execute(ctx) {
		const { cmd, container, windowManager } = ctx

		ctx.playPhrase('editor')
		cmd.ack()

		await windowManager.spawn({
			url: 'https://excalidraw.com',
			width: 1000,
			height: 1000,
		})

		await container.sleep(3000)
		ctx.playPhrase('generic-finish')
		cmd.finish({ result: { action: 'completed', text: cmd.text } })
	},
}

export default handler
