/**
 * Skills Library — WorkflowService hooks
 *
 * Exposes the skillsLibrary feature as REST endpoints for browsing,
 * searching, reading skill content, managing locations, and creating new skills.
 * Recursively exposes the full file tree of each skill (references, scripts, etc).
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

interface FileNode {
  name: string
  path: string         // relative path from skill root (e.g. "references/examples/fs.md")
  absolutePath: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
}

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const skillsLibrary = container.feature('skillsLibrary') as any
  const fs = container.feature('fs') as any
  const yaml = container.feature('yaml') as any

  // Ensure the library is started
  if (!skillsLibrary.isStarted) {
    await skillsLibrary.start()
  }

  // Load additional locations from config.yml if present
  try {
    const configPath = container.paths.resolve('config.yml')
    const configText = await fs.readFile(configPath, 'utf8')
    const config = yaml.parse(configText)
    if (config?.skills?.additionalLocations) {
      for (const loc of config.skills.additionalLocations) {
        const expanded = loc.replace(/^~/, process.env.HOME || '')
        try {
          await skillsLibrary.addLocation(expanded)
        } catch {}
      }
    }
  } catch {}

  /** Recursively walk a directory and return a file tree */
  async function walkDir(dirPath: string, relativeTo: string): Promise<FileNode[]> {
    const nodes: FileNode[] = []
    let entries: string[]
    try {
      entries = await fs.readdir(dirPath)
    } catch {
      return nodes
    }

    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const absPath = container.paths.join(dirPath, entry)
      const relPath = container.paths.relative(relativeTo, absPath)
      try {
        const stat = await fs.stat(absPath)
        if (stat.isDirectory()) {
          const children = await walkDir(absPath, relativeTo)
          nodes.push({
            name: entry,
            path: relPath,
            absolutePath: absPath,
            type: 'directory',
            children,
          })
        } else {
          nodes.push({
            name: entry,
            path: relPath,
            absolutePath: absPath,
            type: 'file',
            size: stat.size,
          })
        }
      } catch {}
    }

    // Directories first, then files, alphabetical within each
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return nodes
  }

  // ── List all skills ──────────────────────────────────────────────────────
  app.get('/api/workflows/skills-library/skills', async (_req: any, res: any) => {
    try {
      if (!skillsLibrary.isStarted) await skillsLibrary.start()
      const skills = skillsLibrary.list()
      res.json({ skills })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Search skills ────────────────────────────────────────────────────────
  app.get('/api/workflows/skills-library/search', async (req: any, res: any) => {
    try {
      const query = req.query.q || ''
      const skills = skillsLibrary.list().filter((s: any) => {
        const haystack = `${s.name} ${s.description || ''}`.toLowerCase()
        return !query || haystack.includes(query.toLowerCase())
      })
      res.json({ skills, query })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Get a skill with full file tree ──────────────────────────────────────
  app.get('/api/workflows/skills-library/skills/:name', async (req: any, res: any) => {
    try {
      const skill = skillsLibrary.find(req.params.name)
      if (!skill) return res.status(404).json({ error: 'Skill not found' })

      const content = await fs.readFile(skill.skillFilePath, 'utf8')

      // Recursively walk the entire skill directory
      const fileTree = await walkDir(skill.path, skill.path)

      res.json({ skill, content, fileTree })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Read any file inside a skill by relative path ────────────────────────
  // Uses a wildcard param so nested paths like references/examples/fs.md work
  app.get('/api/workflows/skills-library/skills/:name/file/*', async (req: any, res: any) => {
    try {
      const skill = skillsLibrary.find(req.params.name)
      if (!skill) return res.status(404).json({ error: 'Skill not found' })

      // req.params[0] captures everything after /file/
      const relPath = req.params[0]
      if (!relPath) return res.status(400).json({ error: 'Missing file path' })

      const absPath = container.paths.join(skill.path, relPath)

      // Ensure we're still within the skill directory (prevent traversal)
      const resolved = container.paths.resolve(absPath)
      const skillRoot = container.paths.resolve(skill.path)
      if (!resolved.startsWith(skillRoot)) {
        return res.status(403).json({ error: 'Path traversal not allowed' })
      }

      const stat = await fs.stat(absPath)

      if (stat.isDirectory()) {
        // Return listing of that subdirectory
        const children = await walkDir(absPath, skill.path)
        return res.json({ type: 'directory', path: relPath, children })
      }

      const content = await fs.readFile(absPath, 'utf8')
      res.json({
        type: 'file',
        path: relPath,
        name: container.paths.basename(absPath),
        content,
        size: stat.size,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── List configured locations ────────────────────────────────────────────
  app.get('/api/workflows/skills-library/locations', async (_req: any, res: any) => {
    try {
      const configPath = skillsLibrary.configPath
      let locations: string[] = []
      try {
        const raw = await fs.readFile(configPath, 'utf8')
        const data = JSON.parse(raw)
        locations = data.locations || []
      } catch {}

      const home = process.env.HOME || ''
      const defaults = [
        `${home}/.claude/skills`,
        container.paths.resolve('.claude/skills'),
      ]

      res.json({ locations, defaults })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Add a new location ───────────────────────────────────────────────────
  app.post('/api/workflows/skills-library/locations', async (req: any, res: any) => {
    try {
      const { path } = req.body || {}
      if (!path) return res.status(400).json({ error: 'Missing path' })

      const expanded = path.replace(/^~/, process.env.HOME || '')
      await skillsLibrary.addLocation(expanded)
      res.json({ ok: true, path: expanded })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Remove a location ────────────────────────────────────────────────────
  app.delete('/api/workflows/skills-library/locations', async (req: any, res: any) => {
    try {
      const { path } = req.body || {}
      if (!path) return res.status(400).json({ error: 'Missing path' })

      await skillsLibrary.removeLocation(path)
      res.json({ ok: true, removed: path })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Create a new skill ───────────────────────────────────────────────────
  app.post('/api/workflows/skills-library/skills', async (req: any, res: any) => {
    try {
      const { name, description, location, content } = req.body || {}
      if (!name) return res.status(400).json({ error: 'Missing skill name' })

      const targetDir = location || container.paths.resolve('.claude/skills')
      const skillDir = container.paths.join(targetDir, name)

      try {
        await fs.stat(skillDir)
        return res.status(409).json({ error: `Skill "${name}" already exists at ${skillDir}` })
      } catch {}

      await fs.mkdir(skillDir, { recursive: true })
      await fs.mkdir(container.paths.join(skillDir, 'references'), { recursive: true })

      const skillContent = content || [
        '---',
        `name: ${name}`,
        `description: ${description || `The ${name} skill`}`,
        '---',
        `# ${name}`,
        '',
        `${description || 'Describe what this skill teaches and when to use it.'}`,
        '',
        '## When to use',
        '',
        '- ...',
        '',
        '## Key concepts',
        '',
        '- ...',
        '',
      ].join('\n')

      await fs.writeFile(container.paths.join(skillDir, 'SKILL.md'), skillContent)

      await skillsLibrary.scanLocation(targetDir)

      const skill = skillsLibrary.find(name)
      res.json({ ok: true, skill })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Rescan all locations ─────────────────────────────────────────────────
  app.post('/api/workflows/skills-library/rescan', async (_req: any, res: any) => {
    try {
      await skillsLibrary.start()
      const skills = skillsLibrary.list()
      res.json({ ok: true, count: skills.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
}
