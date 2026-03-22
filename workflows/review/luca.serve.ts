/**
 * Review / Status Briefing Workflow — setup hook for luca serve
 *
 * Read-only dashboard showing goals, ideas, projects, plans, and recent activity.
 *
 * Usage:
 *   luca serve --setup workflows/review/luca.serve.ts --staticDir workflows/review/public --port 9302 --no-open
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  // Load contentDb
  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  const proc = container.feature('proc')

  // ── GET /api/status — aggregated briefing data ──
  app.get('/api/status', async (_req: any, res: any) => {
    try {
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
          // Fall back to filtering plans by project slug
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

      res.json({
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
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/ideas — all ideas with full meta ──
  app.get('/api/ideas', async (_req: any, res: any) => {
    try {
      const ideas = await docs.query(docs.models.Idea).fetchAll()
      res.json({
        ideas: ideas.map((i: any) => ({
          id: i.id,
          title: i.title,
          status: i.meta.status,
          goal: i.meta.goal || null,
          tags: i.meta.tags || [],
          updatedAt: i.updatedAt || null,
        })),
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/projects — projects with their plans ──
  app.get('/api/projects', async (_req: any, res: any) => {
    try {
      const projects = await docs.query(docs.models.Project).fetchAll()
      const plans = await docs.query(docs.models.Plan).fetchAll()

      const result = await Promise.all(projects.map(async (p: any) => {
        let projectPlans: any[] = []
        try {
          projectPlans = await p.relationships.plans.fetchAll()
        } catch {
          const projectSlug = p.id.replace(/^projects\//, '')
          projectPlans = plans.filter((pl: any) => pl.meta.project === projectSlug)
        }

        return {
          id: p.id,
          title: p.title,
          status: p.meta.status,
          goal: p.meta.goal || null,
          plans: projectPlans.map((pl: any) => ({
            id: pl.id,
            title: pl.title,
            status: pl.meta.status,
            costUsd: pl.meta.costUsd || null,
            completedAt: pl.meta.completedAt || null,
          })),
        }
      }))

      res.json({ projects: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  console.log('[review] status briefing API ready')
}
