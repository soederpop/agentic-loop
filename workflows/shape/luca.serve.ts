/**
 * Shape / Idea Interview Workflow — setup hook for luca serve
 *
 * Two-panel interview UI that helps flesh out ideas from spark/exploring -> ready.
 * Left panel shows the idea document, right panel shows interview questions.
 *
 * Usage:
 *   luca serve --setup workflows/shape/luca.serve.ts --staticDir workflows/shape/public --endpoints-dir workflows/shape/endpoints --any-port --no-open
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  const fs = container.feature('fs')

  app.locals.docs = docs
  app.locals.fs = fs

  console.log('[shape] idea interview workflow API ready')
}
