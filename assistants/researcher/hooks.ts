export function started() {
	assistant.intercept('beforeAsk', async function runOnceBeforeChat(ctx, next) {
		assistant.interceptors.beforeAsk.remove(runOnceBeforeChat)

		await next()
	})
}
