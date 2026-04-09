/**
 * luca.cli.ts — Project-level CLI customization
 *
 * This file is automatically loaded by the `luca` CLI before any command runs.
 * Use it to:
 *
 * - Discover project-level helpers (features, commands, endpoints)
 * - Register custom context variables accessible in `luca eval`
 * - Set up project-specific container configuration
 *
 * Exports:
 *   main(container)    — called at CLI startup, before command execution
 *   onStart(container) — called when the container's 'started' event fires
 *
 * Example:
 *   export async function main(container: any) {
 *     await container.helpers.discoverAll()
 *     container.addContext('myFeature', container.feature('myFeature'))
 *   }
 */

export async function main(container: any) {
  // Discover project-level helpers (commands/, features/, endpoints/)
  await container.helpers.discoverAll()

  const assistantsManager = container.feature('assistantsManager')

  await assistantsManager.discover()

  const chief = await assistantsManager.create('chiefOfStaff')

  container
  	.addContext('luca', container)
	.addContext('chief', chief)
	.addContext('voiceMode', container.feature('voiceMode'))
	.addContext('docs', await container.docs.load())
	.addContext('wm', container.feature('windowManager', { autoListen: true }))

   await container.docs.load()

   container.onMissingCommand(async ({ phrase }) => {
	// This actually gives us a pretty good opportunity to hook into an assistant to help correct the problem
	// and do the right thing, right now we'll just display help like the luca cli usually would
	container.command('help').dispatch()
   })
}
