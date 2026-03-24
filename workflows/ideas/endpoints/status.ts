export const path = '/api/status'
export const description = 'Aggregated status data for the dashboard'
export const tags = ['status']

export async function get(_params: any, ctx: any) {
  const { docs, proc } = ctx.request.app.locals

  const [goals, ideas, projects, plans] = await Promise.all([
    docs.query(docs.models.Goal).fetchAll(),
    docs.query(docs.models.Idea).fetchAll(),
    docs.query(docs.models.Project).fetchAll(),
    docs.query(docs.models.Plan).fetchAll(),
  ])

  // Group ideas by status
  const ideaStatuses = ['spark', 'exploring', 'ready', 'parked', 'promoted']
  const ideasByStatus: Record<string, number> = {}
  for (const status of ideaStatuses) ideasByStatus[status] = 0
  for (const idea of ideas) {
    const status = idea.meta.status || 'spark'
    ideasByStatus[status] = (ideasByStatus[status] || 0) + 1
  }

  // Project summary
  const projectSummary = projects.map((p: any) => ({
    id: p.id,
    title: p.title,
    status: p.meta.status,
  }))

  // Recent git commits
  let recentCommits: any[] = []
  try {
    const result = await proc.exec('git log --oneline --format="%h|%s|%ar" -5')
    const output = (result.stdout || result || '').toString().trim()
    if (output) {
      recentCommits = output.split('\n').map((line: string) => {
        const [hash, message, timeAgo] = line.split('|')
        return { hash, message, timeAgo }
      })
    }
  } catch {}

  return {
    counts: {
      goals: goals.length,
      ideas: ideas.length,
      projects: projects.length,
      plans: plans.length,
    },
    ideasByStatus,
    projects: projectSummary,
    recentCommits,
    goals: goals.map((g: any) => ({
      id: g.id,
      title: g.title,
      horizon: g.meta.horizon,
    })),
  }
}
