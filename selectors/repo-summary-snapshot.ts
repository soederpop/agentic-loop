import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Get a fast snapshot of what changed lately and what is in flight. Returns recent git activity, idea/project status counts, stale items, plan coverage, and recent docs activity.'

export const argsSchema = z.object({
  commitCount: z.number().optional().default(5).describe('Number of recent commits to fetch per repo'),
  staleDays: z.number().optional().default(14).describe('Number of days before an item is considered stale'),
  includeChangedFiles: z.boolean().optional().default(true).describe('Include list of changed files per commit'),
  format: z.enum(['json', 'markdown']).optional().default('json').describe('Output format: json returns structured data, markdown returns a formatted string'),
})

// --- Types ---

interface CommitInfo {
  hash: string
  date: string
  authorName: string
  authorEmail: string
  subject: string
  body: string
  changedFiles?: string[]
}

interface RepoCommits {
  repo: string
  path: string
  commits: CommitInfo[]
  error?: string
}

interface StatusCounts {
  [status: string]: number
}

interface StaleItem {
  id: string
  title: string
  lastModified: string
  daysSinceModified: number
}

interface PlanCoverage {
  project: string
  status: string
  planCount: number
  plans: string[]
}

interface OverallStatusSummary {
  generatedAt: string
  visionEdited: boolean
  totals: {
    ideas: number
    goals: number
    projects: number
    plans: number
  }
  gitActivity: RepoCommits[]
  ideaStatusCounts: StatusCounts
  goalStatusCounts: StatusCounts
  projectStatusCounts: StatusCounts
  staleIdeas: StaleItem[]
  staleProjects: StaleItem[]
  plansCoverage: PlanCoverage[]
  recentDocsCommits: CommitInfo[]
}

const COMMIT_DELIMITER = '==COMMIT_END=='

export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const {
    commitCount = 5,
    staleDays = 14,
    includeChangedFiles = true,
    format = 'json',
  } = args || {}

  const proc = container.feature('proc')
  const cdb = container.feature('contentDb', {
	  rootPath: container.paths.resolve('docs')
  }) as any
  const collection = cdb.collection
  const fs = container.feature('fs')
  const cwd = (container as any).cwd

  // Ensure collection is loaded
  if (!collection.isLoaded) await collection.load()

  // 0. Vision hash check
  const visionHash = container.utils.hashObject({
    vision: fs.readFile('docs/VISION.md')
  })
  const visionEdited = visionHash !== '6pvu54'

  // 1. Git activity across repos (parallel)
  const repos = [{ name: 'agentic-loop', path: cwd }]
  const gitActivity = await Promise.all(
    repos.map(r => fetchRepoCommits(proc, r.name, r.path, commitCount, includeChangedFiles))
  )

  // 2. Ideas status counts
  const ideaDocs = collection.available
    .filter((id: string) => id.startsWith('ideas/'))
    .map((id: string) => collection.document(id))

  const ideaStatusCounts: StatusCounts = {}
  for (const doc of ideaDocs) {
    const status = inferStatus(doc, 'ideas')
    ideaStatusCounts[status] = (ideaStatusCounts[status] || 0) + 1
  }

  // 3. Goals status counts
  const goalDocs = collection.available
    .filter((id: string) => id.startsWith('goals/'))
    .map((id: string) => collection.document(id))

  const goalStatusCounts: StatusCounts = {}
  for (const doc of goalDocs) {
    const status = inferStatus(doc, 'goals')
    goalStatusCounts[status] = (goalStatusCounts[status] || 0) + 1
  }

  // 4. Projects status counts
  const projectDocs = collection.available
    .filter((id: string) => id.startsWith('projects/'))
    .map((id: string) => collection.document(id))

  const projectStatusCounts: StatusCounts = {}
  for (const doc of projectDocs) {
    const status = inferStatus(doc, 'projects')
    projectStatusCounts[status] = (projectStatusCounts[status] || 0) + 1
  }

  // 5. Stale items
  const now = Date.now()

  async function findStaleItems(docs: any[]): Promise<StaleItem[]> {
    const stale: StaleItem[] = []
    for (const doc of docs) {
      const filePath = `docs/${doc.id}.md`
      let lastMod: string | null = null
      try {
        const result = await proc.exec(`git -C "${cwd}" log -1 --format="%aI" -- "${filePath}"`)
        lastMod = result.trim() || null
      } catch { /* skip */ }
      if (!lastMod) continue

      const modDate = new Date(lastMod)
      const daysSince = Math.floor((now - modDate.getTime()) / (24 * 60 * 60 * 1000))

      if (daysSince >= staleDays) {
        stale.push({
          id: doc.id,
          title: doc.title || doc.id,
          lastModified: lastMod,
          daysSinceModified: daysSince,
        })
      }
    }
    return stale.sort((a, b) => b.daysSinceModified - a.daysSinceModified)
  }

  const [staleIdeas, staleProjects] = await Promise.all([
    findStaleItems(ideaDocs),
    findStaleItems(projectDocs),
  ])

  // 6. Plans coverage per project
  const planDocs = collection.available.filter((id: string) => id.startsWith('plans/'))

  const plansCoverage: PlanCoverage[] = projectDocs.map((doc: any) => {
    const slug = doc.id.replace('projects/', '')
    const matchingPlans = planDocs.filter((pid: string) => pid.startsWith(`plans/${slug}/`))
    return {
      project: slug,
      status: inferStatus(doc, 'projects'),
      planCount: matchingPlans.length,
      plans: matchingPlans,
    }
  })

  // 7. Recent docs activity (last N commits touching docs/)
  let recentDocsCommits: CommitInfo[] = []
  try {
    const raw = await proc.exec(
      `git -C "${cwd}" log -n ${commitCount} --pretty=format:"%h%n%an%n%ae%n%ad%n%s%n%b%n${COMMIT_DELIMITER}" --date=iso -- docs/`
    )
    recentDocsCommits = parseGitLog(raw, false)
  } catch { /* non-critical */ }

  const summary: OverallStatusSummary = {
    generatedAt: new Date().toISOString(),
    visionEdited,
    totals: {
      ideas: ideaDocs.length,
      goals: goalDocs.length,
      projects: projectDocs.length,
      plans: planDocs.length,
    },
    gitActivity,
    ideaStatusCounts,
    goalStatusCounts,
    projectStatusCounts,
    staleIdeas,
    staleProjects,
    plansCoverage,
    recentDocsCommits,
  }

  const result: { json: OverallStatusSummary; markdown?: string } = { json: summary }

  if (format === 'markdown') {
    result.markdown = formatSummaryAsMarkdown(summary)
  }

  return result
}

// --- Helpers ---

function parseGitLog(raw: string, includeChangedFiles: boolean): CommitInfo[] {
  const commits: CommitInfo[] = []
  const blocks = raw.split(COMMIT_DELIMITER).filter(b => b.trim())

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 5) continue

    const hash = lines[0] || ''
    const authorName = lines[1] || ''
    const authorEmail = lines[2] || ''
    const date = lines[3] || ''
    const subject = lines[4] || ''

    let body = ''
    let changedFiles: string[] | undefined
    const bodyLines: string[] = []
    let inFiles = false

    for (let i = 5; i < lines.length; i++) {
      if (lines[i]! === '==FILES==') {
        inFiles = true
        continue
      }
      if (inFiles) {
        const line = lines[i]!.trim()
        if (line) { changedFiles = changedFiles || []; changedFiles.push(line) }
      } else {
        bodyLines.push(lines[i]!)
      }
    }

    body = bodyLines.join('\n').trim()
    if (body.length > 500) body = body.slice(0, 500) + '…'
    if (changedFiles && changedFiles.length > 25) {
      changedFiles = changedFiles.slice(0, 25)
      changedFiles.push(`… and more`)
    }

    commits.push({
      hash,
      date,
      authorName,
      authorEmail,
      subject,
      body,
      ...(includeChangedFiles && changedFiles ? { changedFiles } : {}),
    })
  }

  return commits
}

async function fetchRepoCommits(
  proc: any,
  repoName: string,
  repoPath: string,
  commitCount: number,
  includeChangedFiles: boolean,
): Promise<RepoCommits> {
  try {
    let raw: string
    if (includeChangedFiles) {
      const logResult = await proc.exec(
        `git -C "${repoPath}" log -n ${commitCount} --pretty=format:"%h%n%an%n%ae%n%ad%n%s%n%b%n==FILES==" --date=iso`
      )

      const hashResult = await proc.exec(
        `git -C "${repoPath}" log -n ${commitCount} --pretty=format:"%h"`
      )
      const hashes = hashResult.trim().split('\n').filter(Boolean)

      const blocks = logResult.split('==FILES==').filter(b => b.trim())
      const parts: string[] = []

      for (let i = 0; i < blocks.length; i++) {
        let fileList = ''
        if (hashes[i]) {
          try {
            fileList = await proc.exec(
              `git -C "${repoPath}" diff-tree --no-commit-id --name-only -r ${hashes[i]}`
            )
          } catch { fileList = '' }
        }
        parts.push(blocks[i] + '\n==FILES==\n' + fileList + '\n' + COMMIT_DELIMITER)
      }
      raw = parts.join('\n')
    } else {
      raw = await proc.exec(
        `git -C "${repoPath}" log -n ${commitCount} --pretty=format:"%h%n%an%n%ae%n%ad%n%s%n%b%n${COMMIT_DELIMITER}" --date=iso`
      )
    }

    return {
      repo: repoName,
      path: repoPath,
      commits: parseGitLog(raw, includeChangedFiles),
    }
  } catch (err: any) {
    return {
      repo: repoName,
      path: repoPath,
      commits: [],
      error: err?.message || String(err),
    }
  }
}

function inferStatus(doc: any, modelPrefix: string): string {
  if (doc.meta?.status) return doc.meta.status

  if (modelPrefix === 'ideas') {
    const id: string = doc.id || doc.path || ''
    if (id.includes('workstreams/')) return 'workstream'
    return 'spark'
  }

  if (modelPrefix === 'projects') return 'draft'

  return 'unknown'
}

function formatSummaryAsMarkdown(s: OverallStatusSummary): string {
  const lines: string[] = []

  lines.push(`# Overall Status Summary`)
  lines.push(`_Generated: ${s.generatedAt}_\n`)

  if (!s.visionEdited) {
    lines.push(`> ⚠️ **userHasNotEditedVisionDocument** — The vision file has not been customized yet.\n`)
  }

  lines.push(`## Document Totals\n`)
  lines.push(`- **Ideas**: ${s.totals.ideas}`)
  lines.push(`- **Goals**: ${s.totals.goals}`)
  lines.push(`- **Projects**: ${s.totals.projects}`)
  lines.push(`- **Plans**: ${s.totals.plans}`)
  lines.push('')

  lines.push(`## Recent Git Activity\n`)
  for (const repo of s.gitActivity) {
    lines.push(`### ${repo.repo}`)
    if (repo.error) {
      lines.push(`> Error: ${repo.error}\n`)
      continue
    }
    if (repo.commits.length === 0) {
      lines.push(`_No commits found_\n`)
      continue
    }
    for (const c of repo.commits) {
      lines.push(`- **\`${c.hash}\`** ${c.subject} — _${c.authorName}, ${c.date}_`)
      if (c.body) lines.push(`  > ${c.body.split('\n')[0]}`)
      if (c.changedFiles?.length) {
        lines.push(`  Files: ${c.changedFiles.slice(0, 5).join(', ')}${c.changedFiles.length > 5 ? ` (+${c.changedFiles.length - 5} more)` : ''}`)
      }
    }
    lines.push('')
  }

  lines.push(`## Ideas by Status\n`)
  const ideaTotal = Object.values(s.ideaStatusCounts).reduce((a: number, b: number) => a + b, 0)
  lines.push(`Total: ${ideaTotal}\n`)
  for (const [status, count] of Object.entries(s.ideaStatusCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${status}**: ${count}`)
  }
  lines.push('')

  lines.push(`## Goals by Status\n`)
  const goalTotal = Object.values(s.goalStatusCounts).reduce((a: number, b: number) => a + b, 0)
  lines.push(`Total: ${goalTotal}\n`)
  for (const [status, count] of Object.entries(s.goalStatusCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${status}**: ${count}`)
  }
  lines.push('')

  lines.push(`## Projects by Status\n`)
  const projTotal = Object.values(s.projectStatusCounts).reduce((a: number, b: number) => a + b, 0)
  lines.push(`Total: ${projTotal}\n`)
  for (const [status, count] of Object.entries(s.projectStatusCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${status}**: ${count}`)
  }
  lines.push('')

  lines.push(`## Plan Coverage\n`)
  for (const p of s.plansCoverage) {
    const indicator = p.planCount > 0 ? '✓' : '✗'
    lines.push(`- ${indicator} **${p.project}** (${p.status}): ${p.planCount} plan(s)`)
    if (p.plans.length) {
      for (const plan of p.plans) lines.push(`  - ${plan}`)
    }
  }
  lines.push('')

  if (s.staleIdeas.length || s.staleProjects.length) {
    lines.push(`## Stale Items\n`)
    if (s.staleIdeas.length) {
      lines.push(`### Stale Ideas`)
      for (const item of s.staleIdeas) {
        lines.push(`- **${item.id}**: ${item.daysSinceModified}d since last change`)
      }
      lines.push('')
    }
    if (s.staleProjects.length) {
      lines.push(`### Stale Projects`)
      for (const item of s.staleProjects) {
        lines.push(`- **${item.id}**: ${item.daysSinceModified}d since last change`)
      }
      lines.push('')
    }
  }

  if (s.recentDocsCommits.length) {
    lines.push(`## Recent Docs Activity\n`)
    for (const c of s.recentDocsCommits) {
      lines.push(`- **\`${c.hash}\`** ${c.subject} — _${c.authorName}, ${c.date}_`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
