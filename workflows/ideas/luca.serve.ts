/**
 * Ideas Browser Workflow — setup hook for luca serve
 *
 * Browse, filter, and read all ideas with full content.
 * Includes chat with any assistant and status dashboard.
 *
 * Usage:
 *   luca serve --setup workflows/ideas/luca.serve.ts --staticDir workflows/ideas/public --endpoints-dir workflows/ideas/endpoints --any-port --no-open
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  // Discover all available assistants
  await container.helpers.discover('features')
  const assistantsManager = container.feature('assistantsManager') as any
  await assistantsManager.discover()

  const proc = container.feature('proc')

  // Track active assistant instances per session
  const assistantInstances: Record<string, any> = {}

  app.locals.docs = docs
  app.locals.proc = proc
  app.locals.assistantsManager = assistantsManager
  app.locals.assistantInstances = assistantInstances
  app.locals.container = container

  console.log('[ideas] ideas browser API ready')
  console.log(`[ideas] ${assistantsManager.available.length} assistants available: ${assistantsManager.available.join(', ')}`)
}
