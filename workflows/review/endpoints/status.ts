export const path = '/api/status'
export const description = 'Aggregated briefing data for the status dashboard'
export const tags = ['review']

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
  const ideasByStatus: Record<string, any[]> = {}
  for (const status of ideaStatuses) {
    ideasByStatus[status] = []
  }
  for (const idea of ideas) {
    const status = idea.meta.status || 'spark'
    if (!ideasByStatus[status]) ideasByStatus[status] = []
    ideasByStatus[status].push({
      id: idea.id,
      title: idea.title,
      status,
      goal: idea.meta.goal || null,
      tags: idea.meta.tags || [],
      updatedAt: idea.updatedAt || null,
    })
  }

  // Build goal cards with aligned idea counts
  const goalCards = goals.map((g: any) => {
    const alignedIdeas = ideas.filter((i: any) => i.meta.goal === g.id.replace(/^goals\//, ''))
    return {
      id: g.id,
      title: g.title,
      horizon: g.meta.horizon,
      ideaCount: alignedIdeas.length,
    }
  })

  // Build project cards with plan info
  const projectCards = await Promise.all(projects.map(async (p: any) => {
    let projectPlans: any[] = []
    try {
      projectPlans = await p.relationships.plans.fetchAll()
    } catch {
      const projectSlug = p.id.replace(/^projects\//, '')
      projectPlans = plans.filter((pl: any) => pl.meta.project === projectSlug)
    }

    const completedPlans = projectPlans.filter((pl: any) => pl.meta.status === 'completed')

    return {
      id: p.id,
      title: p.title,
      status: p.meta.status,
      goal: p.meta.goal || null,
      totalPlans: projectPlans.length,
      completedPlans: completedPlans.length,
      plans: projectPlans.map((pl: any) => ({
        id: pl.id,
        title: pl.title,
        status: pl.meta.status,
        costUsd: pl.meta.costUsd || null,
        completedAt: pl.meta.completedAt || null,
      })),
    }
  }))

  // Recent git commits
  let recentCommits: any[] = []
  try {
    const result = await proc.exec('git log --oneline --format="%h|%s|%ar" -10')
    const output = (result.stdout || result || '').toString().trim()
    if (output) {
      recentCommits = output.split('\n').map((line: string) => {
        const [hash, message, timeAgo] = line.split('|')
        return { hash, message, timeAgo }
      })
    }
  } catch {}

  // Recently modified docs by mtime
  let recentDocs: any[] = []
  try {
    const allDocs = [...goals, ...ideas, ...projects, ...plans]
    recentDocs = allDocs
      .filter((d: any) => d.updatedAt)
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .map((d: any) => ({
        id: d.id,
        title: d.title,
        updatedAt: d.updatedAt,
      }))
  } catch {}

  // If recentDocs is empty, try using file stats
  if (recentDocs.length === 0) {
    try {
      const container = ctx.container
      const fs = container.feature('fs')
      const allDocs = [...goals, ...ideas, ...projects, ...plans]
      const docsWithStats = allDocs.map((d: any) => {
        try {
          const filePath = container.paths.resolve('docs', `${d.id}.md`)
          const stat = fs.statSync(filePath)
          return { id: d.id, title: d.title, updatedAt: stat.mtime }
        } catch {
          return null
        }
      }).filter(Boolean)

      recentDocs = docsWithStats
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10)
    } catch {}
  }

  return {
    goals: goalCards,
    ideasByStatus,
    projects: projectCards,
    recentCommits,
    recentDocs,
    counts: {
      goals: goals.length,
      ideas: ideas.length,
      projects: projects.length,
      plans: plans.length,
      total: goals.length + ideas.length + projects.length + plans.length,
    },
  }
}
