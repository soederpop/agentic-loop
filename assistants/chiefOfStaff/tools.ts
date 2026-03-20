import { z } from 'zod'
import matter from 'gray-matter'
import { validateDocument } from 'contentbase'
import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

// --- Types for getOverallStatusSummary ---

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
	gitActivity: RepoCommits[]
	ideaStatusCounts: StatusCounts
	projectStatusCounts: StatusCounts
	staleIdeas: StaleItem[]
	staleProjects: StaleItem[]
	plansCoverage: PlanCoverage[]
	recentDocsCommits: CommitInfo[]
}

export const schemas = {
	README: z.object({}).describe('This document will explain everything you need to know about who you are, who I am, and how our underlying document structure works so you can effectively read, write, summarize, and answer questions.'),

	/*
	executePrompt: z.object({
	   outFile: z.string().min(8).describe('Give this a unique name and save this in docs/prompt-output/.  Tie it back to the prompt it came from'),
	   id: z.string().min(1).describe('The id of the prompt you want to execute. Here you do need to include the .md extension'),
	}).describe('Call this function to execute a prompt that you or I have written.  The response will be the output of the claude code session.'),
	*/

	updateDocument: z.object({
	   id: z.string().min(1).describe('The id of the document you want to write. No need to include the .md extension'),
		 rawContent: z.string().describe('YAML Frontmatter + Markdown content for the document.  Follow the model schema.  If you do not know it or are not sure, call the README tool.')
	}).describe('Call this function when you want to update the contents of an existing document. Make sure you understand the models requirements in terms of section headings and yaml frontmatter meta fields'),

	readDocs: z.object({
		idOrIdsCsv: z.string().describe('Pass a single document id, or a CSV list of document ids to read multiple documents at once.  Omit the markdown extension.'),
	}).describe('Call this function when you want to read documents.  Pass it a single id, or a CSV list'),

	listCodeDirectories: z.object({}).describe('The list code directories commands shows the portfolio directory structure. Your only interest in these paths is for asking questions of our coding assistant and knowing where to direct them to look. Consult memories/USER for some common references so you can translate when i am asking.'),

	/*
	askClaude: z.object({
		question: z.string().min(15).describe('Which question do you want to ask the coding assistant? They can read every file, run commands, analyze git history, explain how things work, run test suites, whatever you can think of.  Purely read only too.  This is the one case where you have power to do things outside of writing and reading docs.'),
		project: z.string().optional().default("").describe('Which project folder should the assistant constrain their research to? Check the output of listCodeDirectories for possible answers. Defaults to the root.')
	}),
*/

	getOverallStatusSummary: z.object({
		commitCount: z.number().optional().default(5).describe('Number of recent commits to fetch per repo'),
		staleDays: z.number().optional().default(14).describe('Number of days before an item is considered stale'),
		includeChangedFiles: z.boolean().optional().default(true).describe('Include list of changed files per commit'),
		format: z.enum(['json', 'markdown']).optional().default('json').describe('Output format: json returns structured data, markdown returns a formatted string'),
	}).describe('Get a fast snapshot of what changed lately and what is in flight in this repo. Returns recent git activity, idea/project status counts, stale items, plan coverage, and recent docs activity.'),

	ls: z.object({}).describe('List the available documents in the contentbase collection'),

	present: z.object({
		url: z.string().describe('The URL to present to the user in a viewer window'),
		title: z.string().optional().default('Presenter').describe('Window title'),
		mode: z.enum(['display', 'input']).optional().default('input').describe('display = view only, input = collect feedback from the user'),
	}).describe('Show the user a URL in a native presenter window. In input mode (default), the user can type feedback and submit it — you will receive their response. Use this to show dashboards, docs, diagrams, or anything visual and get the user\'s reaction. To present any document (plan, project, idea, task, etc.), use http://localhost:4100/docs/{slug} where slug matches the doc id without .md extension (e.g. http://localhost:4100/docs/projects/my-project).'),
}

export async function ls() : Promise<string> {
	await assistant.contentDb.collection.load({ refresh: true }).catch(e => {
		console.error('error refreshing collection', e)
	})

	const available = assistant.contentDb.collection.available

	return [
		'Available Documents: ',
		'----',
		...available.sort(),
		'----',
		'You can call readDocs({ idOrIdsCsv }) with any one of these values'
	].join('\n')
}

export async function README() : Promise<string> {
	// regenerate the readme fresh
	await assistant.container.proc.spawnAndCapture('cnotes', ['summary'])
	// make sure the collection is fresh
	await assistant.contentDb.collection.load({ refresh: true })

	const docs = await assistant.contentDb.readMultiple(['memories/SELF', 'memories/USER', 'memories/TODO', 'README','assistant-README'])
	return docs
}

export async function readDocs(options: z.infer<typeof schemas.readDocs>): Promise<string> {
	const { idOrIdsCsv } = options

	const ids = idOrIdsCsv.split(',').map(id => id.trim().replace(/.md$/i, '').replace(/^docs\//i, ''))

	// make sure the collection is fresh, this is expensive i know
	await assistant.contentDb.collection.load({ refresh: true })

	const combinedDocs = await assistant.contentDb.readMultiple(ids, {
		meta: true,
	})

	return combinedDocs 
}


export async function listCodeDirectories() : Promise<string> {
	const result = await assistant.container.proc.exec('tree -d -L 3 -I node_modules')
	return result
}

/*
export async function askClaude(options: z.infer<typeof schemas.askClaude>) : Promise<string> {
	const cc = assistant.container.feature('claudeCode')
	if (!cc.options.claudePath) cc.options.claudePath = '/Users/jon/.local/bin/claude'
	const { question, project } = options

	const baseCwd = assistant.container.cwd
	const cwd = project ? `${baseCwd}/${project}` : baseCwd

	const session = await cc.run(question, {
		cwd,
		appendSystemPrompt: 'You are a read-only research assistant. Do NOT create, edit, write, or delete any files. Do NOT run any destructive commands. Only read files, search code, and analyze what exists. Answer concisely.',
		disallowedTools: ['Edit', 'Write', 'NotebookEdit'],
		model: 'sonnet',
		maxBudgetUsd: 0.50,
	})

	return session.result || 'No response received.'
}
/*
/*
export async function executePrompt(options: z.infer<typeof schemas.executePrompt>) : Promise<string> {
	const { id, outFile } = options
	const promptPath = `docs/prompts/${id}`
	const outPath = `docs/prompt-output/${outFile}`

	const { stdout, stderr, exitCode } = await assistant.container.proc.execAndCapture(
		`luca prompt ${promptPath} --out-file ${outPath} --permission-mode bypassPermissions --include-output`
	)

	if (exitCode !== 0) {
		return `Prompt failed (exit ${exitCode}): ${stderr || stdout}`
	}

	return stdout || `Prompt executed. Output saved to ${outPath}`
}
*/

export async function updateDocument(options: z.infer<typeof schemas.updateDocument>) : Promise<{ success: boolean, errors?: string[] }> {
	const { id, rawContent } = options
	const collection = assistant.contentDb.collection

	// Parse the raw content to extract meta and body
	const { data: meta, content } = matter(rawContent)

	// Create an in-memory document for validation
	const doc = collection.createDocument({ id, content, meta })

	// Find the model definition for this pathId
	const modelDef = collection.findModelDefinition(id)

	if (modelDef) {
		const result = validateDocument(doc, modelDef)

		if (!result.valid) {
			return {
				success: false,
				errors: result.errors.map(e => `${e.path.join('.')}: ${e.message}`)
			}
		}
	}

	// Validation passed (or no model to validate against) — write to disk
	await collection.saveItem(id, { content: rawContent })
	await collection.load({ refresh: true })

	return { success: true }
}
export async function getOverallStatusSummary(
	options?: z.infer<typeof schemas.getOverallStatusSummary>
): Promise<{ json: OverallStatusSummary; markdown?: string }> {
	const {
		commitCount = 5,
		staleDays = 14,
		includeChangedFiles = true,
		format = 'json',
	} = options || {}

	let proc: any
	try {
		proc = assistant.container.feature('proc')
	} catch {
		proc = assistant.container.proc
	}
	const cdb = assistant.contentDb
	const collection = cdb.collection

	// Ensure collection is loaded
	if (!collection.isLoaded) await collection.load()

	// 1. Git activity across repos (parallel)
	const repos = resolveRepoPaths()
	const gitActivity = await Promise.all(
		repos.map(r => fetchRepoCommits(r.name, r.path, commitCount, includeChangedFiles))
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

	// 3. Projects status counts
	const projectDocs = collection.available
		.filter((id: string) => id.startsWith('projects/'))
		.map((id: string) => collection.document(id))

	const projectStatusCounts: StatusCounts = {}
	for (const doc of projectDocs) {
		const status = inferStatus(doc, 'projects')
		projectStatusCounts[status] = (projectStatusCounts[status] || 0) + 1
	}

	// 4. Stale items
	const now = Date.now()
	const staleThreshold = staleDays * 24 * 60 * 60 * 1000

	async function findStaleItems(docs: any[], prefix: string): Promise<StaleItem[]> {
		const stale: StaleItem[] = []
		for (const doc of docs) {
			const filePath = `docs/${doc.id}.md`
			const lastMod = await getDocLastModified(filePath)
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
		findStaleItems(ideaDocs, 'ideas'),
		findStaleItems(projectDocs, 'projects'),
	])

	// 5. Plans coverage per project
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

	// 6. Recent docs activity (last N commits touching docs/)
	let recentDocsCommits: CommitInfo[] = []
	try {
		const raw = await proc.exec(
			`git -C "${assistant.container.cwd}" log -n ${commitCount} --pretty=format:"%h%n%an%n%ae%n%ad%n%s%n%b%n${COMMIT_DELIMITER}" --date=iso -- docs/`
		)
		recentDocsCommits = parseGitLog(raw, false)
	} catch { /* non-critical */ }

	const summary: OverallStatusSummary = {
		generatedAt: new Date().toISOString(),
		gitActivity,
		ideaStatusCounts,
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

export async function present(options: z.infer<typeof schemas.present>): Promise<{ action: string; feedback?: string }> {
	const { url, title = 'Presenter', mode = 'input' } = options
	const proc = assistant.container.proc

	return new Promise((resolve) => {
		let resolved = false
		let feedbackStarted = false
		let feedbackLines: string[] = []

		const done = (result: { action: string; feedback?: string }) => {
			if (resolved) return
			resolved = true
			try { child.kill() } catch {}
			resolve(result)
		}

		const child = proc.spawn('luca', ['present', '--url', url, '--title', title, '--mode', mode])

		child.stdout?.on('data', (buf: Buffer) => {
			const chunk = buf.toString()
			const lines = chunk.split('\n')
			for (const line of lines) {
				if (feedbackStarted) {
					if (line.includes('__END_FEEDBACK_TEXT__')) {
						feedbackStarted = false
						done({ action: 'submitted', feedback: feedbackLines.join('\n').trim() || '(no feedback provided)' })
						return
					}
					feedbackLines.push(line)
					continue
				}

				if (line.includes('__BEGIN_FEEDBACK_TEXT__')) {
					feedbackStarted = true
					feedbackLines = []
					continue
				}

				if (line.includes('__PRESENTER_EVENT__=windowClosed') || line.includes('__PRESENTER_EVENT__=disconnected')) {
					done({ action: 'closed' })
					return
				}
			}
		})

		child.on('exit', () => {
			done({ action: 'closed' })
		})

		// Safety timeout
		assistant.container.sleep(5 * 60 * 1000).then(() => done({ action: 'closed' }))
	})
}

// --- getOverallStatusSummary implementation ---

const COMMIT_DELIMITER = '==COMMIT_END=='

/**
 * Resolve repo paths to check for git activity.
 */
function resolveRepoPaths(): { name: string; path: string }[] {
	const base = assistant.container.cwd
	return [
		{ name: 'agentic-loop', path: base },
	]
}

/**
 * Parse git log output into CommitInfo array.
 * Format: hash\nauthor\nemail\ndate\nsubject\nbody\n==COMMIT_END==
 */
function parseGitLog(raw: string, includeChangedFiles: boolean): CommitInfo[] {
	const commits: CommitInfo[] = []
	const blocks = raw.split(COMMIT_DELIMITER).filter(b => b.trim())

	for (const block of blocks) {
		const lines = block.trim().split('\n')
		if (lines.length < 5) continue

		const hash = lines[0]
		const authorName = lines[1]
		const authorEmail = lines[2]
		const date = lines[3]
		const subject = lines[4]

		// Body is everything after subject until changed files marker or end
		let body = ''
		let changedFiles: string[] | undefined
		const bodyLines: string[] = []
		let inFiles = false

		for (let i = 5; i < lines.length; i++) {
			if (lines[i] === '==FILES==') {
				inFiles = true
				continue
			}
			if (inFiles) {
				if (lines[i].trim()) changedFiles = changedFiles || [], changedFiles.push(lines[i].trim())
			} else {
				bodyLines.push(lines[i])
			}
		}

		body = bodyLines.join('\n').trim()
		// Cap body at 500 chars
		if (body.length > 500) body = body.slice(0, 500) + '…'
		// Cap changed files at 25
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

/**
 * Fetch recent commits from a git repo.
 */
async function fetchRepoCommits(
	repoName: string,
	repoPath: string,
	commitCount: number,
	includeChangedFiles: boolean,
): Promise<RepoCommits> {
	const proc = assistant.container.feature('proc')

	try {
		// Build git log format: include files inline if requested
		const filesPart = includeChangedFiles ? `echo ==FILES== && git -C "${repoPath}" diff-tree --no-commit-id --name-only -r %H` : ''
		const formatStr = `%h%n%an%n%ae%n%ad%n%s%n%b%n${includeChangedFiles ? '' : COMMIT_DELIMITER}`

		let raw: string
		if (includeChangedFiles) {
			// Two-pass: get log, then files per commit
			const logResult = await proc.exec(
				`git -C "${repoPath}" log -n ${commitCount} --pretty=format:"%h%n%an%n%ae%n%ad%n%s%n%b%n==FILES==" --date=iso`
			)

			// For each commit hash, get changed files
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

/**
 * Infer status for a doc if meta.status is missing.
 * - ideas default: "spark"; workstreams/** → "workstream" unless overridden
 * - projects default: "draft"
 */
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

/**
 * Get last modified date for a doc file via git.
 */
async function getDocLastModified(docPath: string): Promise<string | null> {
	const proc = assistant.container.feature('proc')
	try {
		const result = await proc.exec(
			`git -C "${assistant.container.cwd}" log -1 --format="%aI" -- "${docPath}"`
		)
		return result.trim() || null
	} catch {
		return null
	}
}


function formatSummaryAsMarkdown(s: OverallStatusSummary): string {
	const lines: string[] = []

	lines.push(`# Overall Status Summary`)
	lines.push(`_Generated: ${s.generatedAt}_\n`)

	// Git activity
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

	// Idea status counts
	lines.push(`## Ideas by Status\n`)
	const ideaTotal = Object.values(s.ideaStatusCounts).reduce((a, b) => a + b, 0)
	lines.push(`Total: ${ideaTotal}\n`)
	for (const [status, count] of Object.entries(s.ideaStatusCounts).sort((a, b) => b[1] - a[1])) {
		lines.push(`- **${status}**: ${count}`)
	}
	lines.push('')

	// Project status counts
	lines.push(`## Projects by Status\n`)
	const projTotal = Object.values(s.projectStatusCounts).reduce((a, b) => a + b, 0)
	lines.push(`Total: ${projTotal}\n`)
	for (const [status, count] of Object.entries(s.projectStatusCounts).sort((a, b) => b[1] - a[1])) {
		lines.push(`- **${status}**: ${count}`)
	}
	lines.push('')

	// Plans coverage
	lines.push(`## Plan Coverage\n`)
	for (const p of s.plansCoverage) {
		const indicator = p.planCount > 0 ? '✓' : '✗'
		lines.push(`- ${indicator} **${p.project}** (${p.status}): ${p.planCount} plan(s)`)
		if (p.plans.length) {
			for (const plan of p.plans) lines.push(`  - ${plan}`)
		}
	}
	lines.push('')

	// Stale items
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

	// Recent docs commits
	if (s.recentDocsCommits.length) {
		lines.push(`## Recent Docs Activity\n`)
		for (const c of s.recentDocsCommits) {
			lines.push(`- **\`${c.hash}\`** ${c.subject} — _${c.authorName}, ${c.date}_`)
		}
		lines.push('')
	}

	return lines.join('\n')
}

// export async function pauseTaskScheduler() {
// 	const taskScheduler = assistant.container.feature('taskScheduler')
// 	taskScheduler.pause()
// 	return 'Task scheduler paused'
// }

// export async function unpauseTaskScheduler() {
// 	const taskScheduler = assistant.container.feature('taskScheduler')
// taskScheduler.unpause()
// 	return 'Task scheduler unpaused'
// }
