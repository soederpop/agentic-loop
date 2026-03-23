/**
 * Blank Slate Onboarding Workflow — setup hook for luca serve
 *
 * First-run wizard that walks new users through:
 * 1. Writing their vision
 * 2. Creating goals
 * 3. Capturing first ideas
 * 4. Celebrating completion
 *
 * Usage:
 *   luca serve --setup workflows/blank-slate/luca.serve.ts --staticDir workflows/blank-slate/public --endpoints-dir workflows/blank-slate/endpoints --port 9301 --no-open
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
  app.locals.getVisionPath = () => container.paths.resolve('docs', 'VISION.md')

  console.log('[blank-slate] onboarding workflow API ready')
}
