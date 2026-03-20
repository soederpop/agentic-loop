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
	.addContext('docs', await container.docs.load())


}
