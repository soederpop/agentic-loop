import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, features } from '@soederpop/luca'
import type { ExpressServer } from '@soederpop/luca'
import type { AGIContainer } from '@soederpop/luca/agi'
import { createHash } from 'crypto'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    workflowService: typeof WorkflowService
  }
}

// ── Schemas ──────────────────────────────────────────────────────────────────

export const WorkflowServiceOptionsSchema = FeatureOptionsSchema.extend({
  port: z.number().default(7700).describe('Port to listen on'),
  host: z.string().default('0.0.0.0').describe('Host to bind to'),
})

export const WorkflowServiceStateSchema = FeatureStateSchema.extend({
  port: z.number().nullable().default(null),
  listening: z.boolean().default(false),
  workflowCount: z.number().default(0),
})

export type WorkflowServiceOptions = z.infer<typeof WorkflowServiceOptionsSchema>
export type WorkflowServiceState = z.infer<typeof WorkflowServiceStateSchema>

// ── Hooks interface ───────────────────────────────────────────────────────────

export interface WorkflowHooksSetupContext {
  app: any
  chatService: any
  docs: any
  container: AGIContainer
  /** Send a JSON event to all connected WebSocket clients. */
  broadcast: (event: string, data: any) => void
  /** The raw WebSocketServer instance (for custom message routing). */
  wss: any
}

export type WorkflowHooksTeardown = () => Promise<void> | void

export interface WorkflowHooks {
  onSetup(ctx: WorkflowHooksSetupContext): Promise<void> | void
  onTeardown?: WorkflowHooksTeardown
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_VISION_HASH = 'e2a8b87fc08f0e4b5abb2ef82e98c3002c2a62aa97ff860fb3df122dbab5a055'

function extractMarkdownSection(content: string, heading: string): string {
  const pattern = new RegExp(`^## ${heading}\\s*\\n`, 'mi')
  const match = content.match(pattern)
  if (!match || match.index === undefined) return ''
  const start = match.index + match[0].length
  const rest = content.slice(start)
  const nextHeading = rest.match(/^## /m)
  return (nextHeading && nextHeading.index !== undefined
    ? rest.slice(0, nextHeading.index)
    : rest
  ).trim()
}

function serializePlan(p: any) {
  return {
    id: p.id,
    slug: p.id.split('/').pop(),
    title: p.title,
    status: p.meta.status,
    project: p.meta.project,
    costUsd: p.meta.costUsd,
    turns: p.meta.turns,
    toolCalls: p.meta.toolCalls,
    completedAt: p.meta.completedAt,
    content: p.document?.content || '',
  }
}

function serializeProject(project: any, plans: any[]) {
  const rawContent = project.document?.content || ''
  return {
    id: project.id,
    slug: project.id.replace(/^projects\//, ''),
    title: project.title,
    status: project.meta.status,
    goal: project.meta.goal,
    content: rawContent,
    sections: {
      overview: extractMarkdownSection(rawContent, 'Overview'),
      execution: project.sections?.execution || '',
    },
    plans: plans.map(serializePlan),
  }
}

// ── Feature ───────────────────────────────────────────────────────────────────

/**
 * WorkflowService — one Express + WebSocket server that:
 *  - Discovers all workflows and serves their public/ dirs at /workflows/:name/
 *  - Loads ContentDB once and shares it across all workflows
 *  - Mounts shared API endpoints (goals, ideas, projects, status, etc.)
 *  - Attaches ChatService WebSocket at /ws
 *  - Loads hooks.ts from each workflow for custom per-workflow routes and logic
 */
export class WorkflowService extends Feature<WorkflowServiceState, WorkflowServiceOptions> {
  static override shortcut = 'features.workflowService' as const
  static override stateSchema = WorkflowServiceStateSchema
  static override optionsSchema = WorkflowServiceOptionsSchema

  static {
    Feature.register(this as any, 'workflowService')
  }

  private _chatService: any = null
  private _hooksTeardowns: Array<WorkflowHooksTeardown> = []

  override get container(): AGIContainer {
    return super.container as unknown as AGIContainer
  }

  get expressServer(): ExpressServer {
    return this.container.server('express', {
      port: this.options.port,
      host: this.options.host,
      cors: true,
    })
  }

  get port(): number | null {
    return this.state.get('port') as number | null
  }

  get isListening(): boolean {
    return this.state.get('listening') as boolean
  }

  async start(): Promise<this> {
    const container = this.container
    const library = container.feature('workflowLibrary')
    if (!library.isLoaded) await library.discover()

    const realWorkflows = library.workflows.filter((w) => w.name !== 'shared')
    const servedWorkflows = realWorkflows.filter((w) => w.hasPublicDir)

    const server = this.expressServer
    const app = server.app
    const express = server.express

    // ── ContentDB ──────────────────────────────────────────────────────────────

    const { docs } = container
    await docs.load()

    const proc = container.feature('proc')
    const fs = container.feature('fs')
    const getVisionPath = () => container.paths.resolve('docs', 'VISION.md')

    app.locals.docs = docs
    app.locals.container = container
    app.locals.proc = proc
    app.locals.serializePlan = serializePlan
    app.locals.serializeProject = serializeProject

    // ── Shared CSS ─────────────────────────────────────────────────────────────

    const sharedCssPath = container.paths.resolve('workflows/shared/base.css')
    app.get('/shared/base.css', (_req: any, res: any) => {
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
      res.sendFile(sharedCssPath)
    })

    // ── Static mounting per workflow ───────────────────────────────────────────

    for (const workflow of servedWorkflows) {
      const publicDir = container.paths.resolve(workflow.folderPath, 'public')
      app.use(`/workflows/${workflow.name}`, express.static(publicDir))
    }

    // ── Shared API: goals ──────────────────────────────────────────────────────

    app.get('/api/goals', async (_req: any, res: any) => {
      try {
        const goals = await docs.query(docs.models.Goal!).fetchAll()
        res.json({
          goals: goals.map((g: any) => ({
            id: g.id.replace(/^goals\//, ''),
            title: g.title,
            horizon: g.meta.horizon,
          })),
        })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.post('/api/goals', async (req: any, res: any) => {
      try {
        const { title, horizon, successCriteria, motivation } = req.body || {}
        if (!title || typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ error: 'Title is required' })
        }
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        const h = horizon || 'medium'
        const motivationText = motivation?.trim() || 'Why this goal is worth pursuing.'
        const criteriaText = successCriteria?.trim() || '- Criteria that define when this goal is achieved'
        const content = [
          '---',
          `horizon: ${h}`,
          '---',
          '',
          `# ${title.trim()}`,
          '',
          'What this goal is about and why it matters.',
          '',
          '## Motivation',
          '',
          motivationText,
          '',
          '## Success Criteria',
          '',
          criteriaText,
          '',
        ].join('\n')
        const filePath = container.paths.resolve('docs', 'goals', `${slug}.md`)
        if (fs.existsSync(filePath)) {
          return res.status(409).json({ error: `A goal with slug "${slug}" already exists` })
        }
        fs.writeFile(filePath, content)
        await docs.reload()
        res.json({ ok: true, id: slug, title: title.trim(), slug, horizon: h })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    // ── Shared API: ideas ──────────────────────────────────────────────────────

    app.get('/api/ideas', async (req: any, res: any) => {
      try {
        const { status: statusFilter, goal: goalFilter } = req.query || {}
        let ideas = await docs.query(docs.models.Idea!).fetchAll()
        const goals = await docs.query(docs.models.Goal!).fetchAll()

        if (statusFilter) {
          const statuses = String(statusFilter).split(',')
          ideas = ideas.filter((i: any) => statuses.includes(i.meta.status || 'spark'))
        }
        if (goalFilter) {
          ideas = ideas.filter((i: any) => i.meta.goal === goalFilter)
        }

        const goalMap: Record<string, string> = {}
        for (const g of goals) {
          goalMap[g.id.replace(/^goals\//, '')] = g.title
        }

        const ideasWithBody = await Promise.all(
          ideas.map(async (i: any) => {
            let body = ''
            try { body = i.document?.content || '' } catch {}
            return {
              id: i.id,
              title: i.title,
              status: i.meta.status || 'spark',
              goal: i.meta.goal || null,
              goalTitle: i.meta.goal ? (goalMap[i.meta.goal] || i.meta.goal) : null,
              tags: i.meta.tags || [],
              body,
              updatedAt: i.updatedAt || null,
            }
          }),
        )

        res.json({
          ideas: ideasWithBody,
          goals: goals.map((g: any) => ({
            id: g.id.replace(/^goals\//, ''),
            title: g.title,
            horizon: g.meta.horizon,
          })),
        })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.post('/api/ideas', async (req: any, res: any) => {
      try {
        const { title, goal, tags, description } = req.body || {}
        if (!title || typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ error: 'Title is required' })
        }
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        const tagList = Array.isArray(tags)
          ? tags
          : (tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
        const frontmatter = [
          '---',
          goal ? `goal: ${goal}` : 'goal:',
          `tags: [${tagList.map((t: string) => `"${t}"`).join(', ')}]`,
          'status: exploring',
          '---',
        ].join('\n')
        const body = description?.trim() || 'Description of the idea and what it could become.'
        const content = `${frontmatter}\n\n# ${title.trim()}\n\n${body}\n`
        const filePath = container.paths.resolve('docs', 'ideas', `${slug}.md`)
        if (fs.existsSync(filePath)) {
          return res.status(409).json({ error: `An idea with slug "${slug}" already exists` })
        }
        fs.writeFile(filePath, content)
        await docs.reload()
        res.json({ ok: true, id: `ideas/${slug}`, title: title.trim(), slug, path: filePath })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    // ── Shared API: vision (blank-slate) ───────────────────────────────────────

    app.get('/api/vision', async (_req: any, res: any) => {
      try {
        const visionPath = getVisionPath()
        let text = ''
        let isDefault = true
        if (fs.existsSync(visionPath)) {
          text = (fs.readFileSync(visionPath, 'utf-8') as any).toString('utf-8')
          isDefault = createHash('sha256').update(text).digest('hex') === DEFAULT_VISION_HASH
        }
        res.json({ text, isDefault })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.post('/api/vision', async (req: any, res: any) => {
      try {
        const { text } = req.body || {}
        if (!text || typeof text !== 'string' || !text.trim()) {
          return res.status(400).json({ error: 'Vision text is required' })
        }
        const content = `# Vision Statement\n\n${text.trim()}\n`
        fs.writeFile(getVisionPath(), content)
        res.json({ ok: true, hash: createHash('sha256').update(content).digest('hex') })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    // ── Shared API: projects & plans ───────────────────────────────────────────

    app.get('/api/projects', async (_req: any, res: any) => {
      try {
        const projects = await docs.query(docs.models.Project!).fetchAll()
        const result = []
        for (const project of projects) {
          const plans = await project.relationships?.plans?.fetchAll() ?? []
          result.push(serializeProject(project, plans))
        }
        res.json({ projects: result })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.post('/api/projects', async (req: any, res: any) => {
      try {
        const { title, goal, status } = req.body || {}
        if (!title || typeof title !== 'string') {
          return res.status(400).json({ error: 'Title is required' })
        }
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const docPath = container.paths.resolve('docs', 'projects', `${slug}.md`)
        if (await fs.exists(docPath)) {
          return res.status(409).json({ error: `Project "${slug}" already exists` })
        }
        const yaml = container.feature('yaml')
        const meta = { status: status || 'draft', goal: goal || '' }
        const frontmatter = yaml.stringify(meta).trim()
        const body = `# ${title}\n\n## Overview\n\n\n\n## Execution\n\n- `
        await fs.writeFile(docPath, `---\n${frontmatter}\n---\n\n${body}`)
        await docs.load()
        const project = (await docs.query(docs.models.Project!).fetchAll())
          .find((p: any) => p.id === `projects/${slug}`)
        if (!project) return res.json({ ok: true, slug })
        const plans = await project.relationships?.plans?.fetchAll() ?? []
        res.json({ ok: true, project: serializeProject(project, plans) })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.get('/api/project/:slug', async (req: any, res: any) => {
      try {
        const { slug } = req.params
        const projects = await docs.query(docs.models.Project!).fetchAll()
        const project = projects.find(
          (p: any) => p.id === `projects/${slug}` || p.id === slug,
        )
        if (!project) return res.status(404).json({ error: 'Project not found' })
        const plans = await project.relationships?.plans?.fetchAll() ?? []
        res.json(serializeProject(project, plans))
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.put('/api/project/:slug', async (req: any, res: any) => {
      try {
        const { slug } = req.params
        const { content, meta } = req.body || {}
        const projects = await docs.query(docs.models.Project!).fetchAll()
        const project = projects.find(
          (p: any) => p.id === `projects/${slug}` || p.id === slug,
        )
        if (!project) return res.status(404).json({ error: 'Project not found' })
        const doc = project.document
        if (meta) {
          if (meta.status !== undefined) doc.meta.status = meta.status
          if (meta.goal !== undefined) doc.meta.goal = meta.goal
        }
        if (content !== undefined) {
          const yaml = container.feature('yaml')
          const frontmatter = yaml.stringify(doc.meta).trim()
          await fs.writeFile(doc.path, `---\n${frontmatter}\n---\n\n${content}`)
          await docs.load()
        } else {
          await doc.save({ normalize: false })
          await docs.load()
        }
        const updated = (await docs.query(docs.models.Project!).fetchAll())
          .find((p: any) => p.id === `projects/${slug}` || p.id === slug)
        if (!updated) return res.json({ ok: true })
        const plans = await updated.relationships?.plans?.fetchAll() ?? []
        res.json({ ok: true, project: serializeProject(updated, plans) })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.post('/api/plans', async (req: any, res: any) => {
      try {
        const { title, project: projectSlug, status } = req.body || {}
        if (!title || typeof title !== 'string') {
          return res.status(400).json({ error: 'Title is required' })
        }
        if (projectSlug && !/^[a-z0-9-]+$/.test(projectSlug)) {
          return res.status(400).json({ error: 'Invalid project slug' })
        }
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        let dirPath: string
        let planId: string
        if (projectSlug) {
          dirPath = container.paths.resolve('docs', 'plans', projectSlug)
          planId = `plans/${projectSlug}/${slug}`
        } else {
          dirPath = container.paths.resolve('docs', 'plans')
          planId = `plans/${slug}`
        }
        if (!(await fs.exists(dirPath))) await fs.mkdirp(dirPath)
        const filePath = container.paths.resolve(dirPath, `${slug}.md`)
        if (await fs.exists(filePath)) {
          return res.status(409).json({ error: `Plan "${slug}" already exists` })
        }
        const yaml = container.feature('yaml')
        const planMeta: Record<string, any> = { status: status || 'pending' }
        if (projectSlug) planMeta.project = projectSlug
        const frontmatter = yaml.stringify(planMeta).trim()
        const body = `# ${title}\n\n## References\n\n- \n\n## Test plan\n\n- `
        await fs.writeFile(filePath, `---\n${frontmatter}\n---\n\n${body}`)
        await docs.load()
        const plan = (await docs.query(docs.models.Plan!).fetchAll())
          .find((p: any) => p.id === planId)
        res.json({ ok: true, plan: plan ? serializePlan(plan) : null, planId })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.get('/api/plan/:planId', async (req: any, res: any) => {
      try {
        const planId = req.params.planId.replace(/~/g, '/')
        const plans = await docs.query(docs.models.Plan!).fetchAll()
        const plan = plans.find((p: any) => p.id === planId)
        if (!plan) return res.status(404).json({ error: 'Plan not found' })
        res.json(serializePlan(plan))
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    app.put('/api/plan/:planId', async (req: any, res: any) => {
      try {
        const planId = req.params.planId.replace(/~/g, '/')
        const { content, meta } = req.body || {}
        const plans = await docs.query(docs.models.Plan!).fetchAll()
        const plan = plans.find((p: any) => p.id === planId)
        if (!plan) return res.status(404).json({ error: 'Plan not found' })
        const doc = plan.document
        if (meta) {
          if (meta.status !== undefined) doc.meta.status = meta.status
          if (meta.project !== undefined) doc.meta.project = meta.project
        }
        if (content !== undefined) {
          const yaml = container.feature('yaml')
          const frontmatter = yaml.stringify(doc.meta).trim()
          await fs.writeFile(doc.path, `---\n${frontmatter}\n---\n\n${content}`)
          await docs.load()
        } else {
          await doc.save({ normalize: false })
          await docs.load()
        }
        const updated = (await docs.query(docs.models.Plan!).fetchAll())
          .find((p: any) => p.id === planId)
        res.json({ ok: true, plan: updated ? serializePlan(updated) : null })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    // ── Shared API: status (union of review + blank-slate) ─────────────────────

    app.get('/api/status', async (_req: any, res: any) => {
      try {
        const [goals, ideas, projects, plans] = await Promise.all([
          docs.query(docs.models.Goal!).fetchAll(),
          docs.query(docs.models.Idea!).fetchAll(),
          docs.query(docs.models.Project!).fetchAll(),
          docs.query(docs.models.Plan!).fetchAll(),
        ])

        // Vision status (for blank-slate onboarding)
        const visionPath = getVisionPath()
        let hasVision = false
        let visionHash = ''
        if (fs.existsSync(visionPath)) {
          const visionContent = (fs.readFileSync(visionPath, 'utf-8') as any).toString('utf-8')
          visionHash = createHash('sha256').update(visionContent).digest('hex')
          hasVision = visionHash !== DEFAULT_VISION_HASH
        }

        // Ideas by status
        const ideaStatuses = ['spark', 'exploring', 'ready', 'parked', 'promoted']
        const ideasByStatus: Record<string, any[]> = {}
        for (const s of ideaStatuses) ideasByStatus[s] = []
        for (const idea of ideas as any[]) {
          const s = idea.meta.status || 'spark'
          if (!ideasByStatus[s]) ideasByStatus[s] = []
          ideasByStatus[s].push({
            id: idea.id,
            title: idea.title,
            status: s,
            goal: idea.meta.goal || null,
            tags: idea.meta.tags || [],
            updatedAt: idea.updatedAt || null,
          })
        }

        // Goals with idea counts
        const goalCards = goals.map((g: any) => {
          const slug = g.id.replace(/^goals\//, '')
          return {
            id: g.id,
            title: g.title,
            horizon: g.meta.horizon,
            ideaCount: ideas.filter((i: any) => i.meta.goal === slug).length,
          }
        })

        // Projects with plan info
        const projectCards = await Promise.all(
          projects.map(async (p: any) => {
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
          }),
        )

        // Recent git commits
        let recentCommits: any[] = []
        try {
          const result: any = await proc.exec('git log --oneline --format="%h|%s|%ar" -10')
          const output = ((result?.stdout ?? result) || '').toString().trim()
          if (output) {
            recentCommits = output.split('\n').map((line: string) => {
              const [hash, message, timeAgo] = line.split('|')
              return { hash, message, timeAgo }
            })
          }
        } catch {}

        // Recently modified docs
        let recentDocs: any[] = []
        try {
          const allDocs = [...goals, ...ideas, ...projects, ...plans]
          recentDocs = allDocs
            .filter((d: any) => d.updatedAt)
            .sort(
              (a: any, b: any) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )
            .slice(0, 10)
            .map((d: any) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt }))
        } catch {}

        if (recentDocs.length === 0) {
          try {
            const allDocs = [...goals, ...ideas, ...projects, ...plans]
            const withStats = await Promise.all(
              allDocs.map(async (d: any) => {
                try {
                  const filePath = container.paths.resolve('docs', `${d.id}.md`)
                  const stat = await fs.statAsync(filePath)
                  return { id: d.id, title: d.title, updatedAt: (stat as any).mtime }
                } catch {
                  return null
                }
              }),
            )
            recentDocs = withStats
              .filter(Boolean)
              .sort(
                (a: any, b: any) =>
                  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
              )
              .slice(0, 10)
          } catch {}
        }

        res.json({
          // blank-slate onboarding fields
          hasVision,
          visionHash,
          goalCount: goals.length,
          ideaCount: ideas.length,
          // review / dashboard fields
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

    // ── Shared API: assistants ─────────────────────────────────────────────────

    app.get('/api/assistants', (_req: any, res: any) => {
      try {
        const assistantsManager = container.feature('assistantsManager') as any
        const list = assistantsManager.list?.() || []
        const assistants = list.map((e: any) => {
          const shortName = (e.name || '').replace(/^assistants\//, '')
          return { id: shortName, name: shortName }
        })
        res.json({ assistants, default: 'chiefOfStaff' })
      } catch {
        res.json({ assistants: [], default: 'chiefOfStaff' })
      }
    })

    // ── Shared API: generic doc create ─────────────────────────────────────────

    app.post('/api/docs/create', async (req: any, res: any) => {
      try {
        const { model, title, meta: metaFields, body } = req.body || {}
        if (!model || !title) {
          return res.status(400).json({ error: 'model and title are required' })
        }
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        const modelLower = model.toLowerCase()
        const filePath = container.paths.resolve('docs', `${modelLower}s`, `${slug}.md`)
        if (fs.existsSync(filePath)) {
          return res.status(409).json({ error: `Document "${slug}" already exists` })
        }
        const yaml = container.feature('yaml')
        const frontmatter = yaml.stringify(metaFields || {}).trim()
        const content = `---\n${frontmatter}\n---\n\n# ${title}\n\n${body || ''}\n`
        fs.writeFile(filePath, content)
        await docs.reload()
        res.json({ ok: true, id: `${modelLower}s/${slug}`, slug })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    })

    // ── Shared API: config (for dashboard WS URL) ──────────────────────────────

    app.get('/api/config', (_req: any, res: any) => {
      const wsProto = 'ws'
      const wsUrl = `${wsProto}://localhost:${this.options.port}`
      res.json({ wsUrl, port: this.options.port })
    })

    // ── Workflow index ─────────────────────────────────────────────────────────

    app.get('/api/workflows', (_req: any, res: any) => {
      res.json({
        workflows: realWorkflows.map((w) => ({
          name: w.name,
          title: w.title,
          description: w.description,
          tags: w.tags,
          url: `/workflows/${w.name}/`,
          hasPublicDir: w.hasPublicDir,
        })),
      })
    })

    // ── Landing page ───────────────────────────────────────────────────────────

    app.get('/', (_req: any, res: any) => {
      const cards = servedWorkflows
        .map(
          (w) =>
            `<a class="card" href="/workflows/${w.name}/"><h2>${w.title}</h2><p>${w.description || ''}</p></a>`,
        )
        .join('\n')
      res.setHeader('Content-Type', 'text/html')
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Workflow Hub</title>
<link rel="stylesheet" href="/shared/base.css">
<style>
body { max-width: 900px; margin: 0 auto; padding: 2rem; font-family: var(--font-mono, monospace); }
h1 { color: var(--accent, #7aa2f7); margin-bottom: 2rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.card { display: block; padding: 1.25rem; background: var(--surface, #1a1b26); border: 1px solid var(--border, #3b4261);
  border-radius: 6px; color: var(--text, #c0caf5); text-decoration: none; transition: border-color .15s; }
.card:hover { border-color: var(--accent, #7aa2f7); }
.card h2 { margin: 0 0 .5rem; font-size: 1rem; }
.card p { margin: 0; font-size: .8rem; opacity: .6; }
</style>
</head>
<body>
<h1>Workflow Hub</h1>
<div class="grid">${cards}</div>
</body>
</html>`)
    })

    // ── Start HTTP server ──────────────────────────────────────────────────────

    await server.start()

    // ── ChatService WebSocket ──────────────────────────────────────────────────

    let chatService: any = null
    let wss: any = null

    try {
      // Ensure assistants are discovered
      const assistantsManager = container.feature('assistantsManager') as any
      if (assistantsManager?.discover && !assistantsManager.isLoaded) {
        await assistantsManager.discover()
      }

      chatService = container.feature('chatService', {
        defaultAssistant: 'chiefOfStaff',
        threadPrefix: 'shared',
        historyMode: 'session',
      })

      const httpServer = (server as any)._listener
      if (httpServer) {
        wss = chatService.attach(httpServer)
        console.log('[workflow-service] ChatService WebSocket attached')
      } else {
        console.warn('[workflow-service] HTTP _listener unavailable — WebSocket skipped')
      }
    } catch (err: any) {
      console.warn('[workflow-service] ChatService setup failed:', err.message)
    }

    this._chatService = chatService

    // ── Load workflow hooks ────────────────────────────────────────────────────

    const broadcast = (event: string, data: any) => {
      if (!wss) return
      const payload = JSON.stringify({ type: 'build_event', event, ...data })
      for (const client of wss.clients) {
        if ((client as any).readyState === 1) {
          try { client.send(payload) } catch {}
        }
      }
    }

    const hookWorkflows = realWorkflows.filter((w) => w.hasHooks)
    for (const workflow of hookWorkflows) {
      const hooksPath = container.paths.resolve(workflow.folderPath, 'hooks.ts')
      try {
        const hooks: WorkflowHooks = await import(hooksPath)
        if (hooks.onSetup) {
          await hooks.onSetup({ app, chatService, docs, container, broadcast, wss })
          console.log(`[workflow-service] hooks loaded: ${workflow.name}`)
        }
        if (hooks.onTeardown) this._hooksTeardowns.push(hooks.onTeardown)
      } catch (err: any) {
        console.error(`[workflow-service] hooks failed for ${workflow.name}:`, err.message)
      }
    }

    // ── Update state ───────────────────────────────────────────────────────────

    this.state.set('port', server.port)
    this.state.set('listening', true)
    this.state.set('workflowCount', servedWorkflows.length)

    this.emit('started', { port: server.port, workflowCount: servedWorkflows.length })

    return this
  }

  /** Stop the server, shut down ChatService, and run teardown hooks. */
  async stop() {
    for (const teardown of this._hooksTeardowns) {
      try { await teardown() } catch {}
    }
    this._hooksTeardowns = []

    if (this._chatService) {
      try { await this._chatService.shutdown() } catch {}
      this._chatService = null
    }

    const server = this.container.server('express', {
      port: this.options.port,
      host: this.options.host,
      cors: true,
    })
    try { await server.stop() } catch {}

    this.state.set('listening', false)
    this.state.set('port', null)
    this.emit('stopped')
  }
}

export default features.register('workflowService', WorkflowService)
