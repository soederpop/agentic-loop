/**
 * Capture Workflow — setup hook for luca serve
 *
 * Taps into the express server to:
 * - Serve goals and idea metadata so the playground can populate pickers
 * - Accept new idea submissions and write them to contentDb
 * - Wire up containerLink so the presenter can communicate with the playground
 *
 * Usage:
 *   luca serve --setup workflows/capture/luca.serve.ts --staticDir workflows/capture/public --endpoints-dir workflows/capture/endpoints --port 9300
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  app.locals.docs = docs

  console.log('[capture] workflow API ready')
}
