export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  // Build schedule mapping from task-scheduler's logic
  const scheduleMap: Record<string, number> = {
    'every-five-minutes': 5 * 60 * 1000,
    'every-ten-minutes': 10 * 60 * 1000,
    'every-half-hour': 30 * 60 * 1000,
    'hourly': 60 * 60 * 1000,
    'daily': 24 * 60 * 60 * 1000,
    'beginning-of-day': 24 * 60 * 60 * 1000,
    'end-of-day': 24 * 60 * 60 * 1000,
    'weekly': 7 * 24 * 60 * 60 * 1000,
  }

  app.locals.container = container
  app.locals.docs = docs
  app.locals.scheduleMap = scheduleMap

  console.log('[playbook-designer] workflow API ready')
}
