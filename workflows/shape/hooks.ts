/**
 * Shape Workflow — WorkflowService hooks
 *
 * Registers the per-idea CRUD endpoint for exploring and shaping ideas.
 * GET /api/ideas (filtered) and GET /api/goals are served by the shared API.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, docs, container }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')

  // ── Single idea CRUD ──────────────────────────────────────────────────────

  app.get('/api/idea/:slug', async (req: any, res: any) => {
    try {
      const { slug } = req.params
      const allIdeas = await docs.query(docs.models.Idea).fetchAll()
      const idea = allIdeas.find(
        (i: any) => i.id === `ideas/${slug}` || i.id === slug,
      )
      if (!idea) return res.status(404).json({ error: `Idea "${slug}" not found` })

      const filePath = container.paths.resolve('docs', 'ideas', `${slug}.md`)
      let rawContent = ''
      if (fs.existsSync(filePath)) {
        rawContent = (fs.readFileSync(filePath, 'utf-8') as any).toString('utf-8') as string
      }
      const bodyMatch = rawContent.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
      const body = bodyMatch ? (bodyMatch[1] as string).trim() : rawContent

      res.json({
        slug: idea.id.replace(/^ideas\//, ''),
        title: idea.title,
        status: idea.meta.status,
        goal: idea.meta.goal || null,
        tags: idea.meta.tags || [],
        content: body,
        rawContent,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/idea/:slug', async (req: any, res: any) => {
    try {
      const { slug } = req.params
      const { status, tags, appendSections } = req.body || {}

      const filePath = container.paths.resolve('docs', 'ideas', `${slug}.md`)
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Idea file "${slug}.md" not found` })
      }

      const raw = (fs.readFileSync(filePath, 'utf-8') as any).toString('utf-8') as string
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/)
      if (!fmMatch) return res.status(400).json({ error: 'Could not parse frontmatter' })

      const fmBlock = fmMatch[1] as string
      const bodyAfterFm = raw.slice(fmMatch[0].length)

      const fmLines = fmBlock.split('\n')
      const newFmLines: string[] = []
      for (const line of fmLines) {
        if (status && line.startsWith('status:')) {
          newFmLines.push(`status: ${status}`)
        } else if (tags && line.startsWith('tags:')) {
          const tagList = Array.isArray(tags) ? tags : [tags]
          newFmLines.push(`tags:\n${tagList.map((t: string) => `  - ${t}`).join('\n')}`)
        } else if (tags && line.match(/^\s+-\s/)) {
          continue
        } else {
          newFmLines.push(line)
        }
      }

      let newBody = bodyAfterFm
      if (appendSections && typeof appendSections === 'object') {
        for (const [heading, content] of Object.entries(appendSections)) {
          if (content && typeof content === 'string' && content.trim()) {
            newBody += `\n## ${heading}\n\n${(content as string).trim()}\n`
          }
        }
      }

      fs.writeFile(filePath, `---\n${newFmLines.join('\n')}\n---\n${newBody}`)
      await docs.reload()

      const oldStatusMatch = fmBlock.match(/status:\s*(\w+)/)
      const oldStatus = oldStatusMatch ? (oldStatusMatch[1] as string) : 'unknown'

      res.json({ ok: true, slug, oldStatus, newStatus: status || oldStatus })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  console.log('[shape] hooks loaded — idea CRUD at /api/idea/:slug')
}
