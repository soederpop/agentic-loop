/**
 * Ideas Browser Workflow — setup hook for luca serve
 *
 * Browse, filter, and read all ideas with full content.
 *
 * Usage:
 *   luca serve --setup workflows/ideas/luca.serve.ts --staticDir workflows/ideas/public --endpoints-dir workflows/ideas/endpoints --port 9306 --no-open
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  app.locals.docs = docs

  console.log('[ideas] ideas browser API ready')
}
