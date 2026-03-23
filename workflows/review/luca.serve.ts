/**
 * Review / Status Briefing Workflow — setup hook for luca serve
 *
 * Read-only dashboard showing goals, ideas, projects, plans, and recent activity.
 *
 * Usage:
 *   luca serve --setup workflows/review/luca.serve.ts --staticDir workflows/review/public --endpoints-dir workflows/review/endpoints --port 9302 --no-open
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  const proc = container.feature('proc')

  app.locals.docs = docs
  app.locals.proc = proc

  console.log('[review] status briefing API ready')
}
