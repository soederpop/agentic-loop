export function started() {
	assistant.use(
		container.feature('browserUse', { headed: true })
	)

	assistant.state.set('sources', [])
}
