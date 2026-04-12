import { z } from 'zod'
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

export const schemas = {
	README: z.object({}).describe('This document will explain everything you need to know about who you are, who I am, and how our underlying document structure works so you can effectively read, write, summarize, and answer questions.'),

	/*
	executePrompt: z.object({
	   outFile: z.string().min(8).describe('Give this a unique name and save this in docs/prompt-output/.  Tie it back to the prompt it came from'),
	   id: z.string().min(1).describe('The id of the prompt you want to execute. Here you do need to include the .md extension'),
	}).describe('Call this function to execute a prompt that you or I have written.  The response will be the output of the claude code session.'),
	*/

	askCodingAssistant: z.object({
		question: z.string().min(15).describe('The question you want to ask the coding assistant.  The coding assistant has grep, ls, cat, sed, awk, cat, and can read all of the code on this system and answer specific questions based on it.'),
	}).describe('Ask the coding assistant a question.  The coding assistant has grep, ls, cat, sed, awk, cat, and can read all of the code on this system and answer specific questions based on it.'),

	getOverallStatusSummary: z.object({
		commitCount: z.number().optional().default(5).describe('Number of recent commits to fetch per repo'),
		staleDays: z.number().optional().default(14).describe('Number of days before an item is considered stale'),
		includeChangedFiles: z.boolean().optional().default(true).describe('Include list of changed files per commit'),
		format: z.enum(['json', 'markdown']).optional().default('json').describe('Output format: json returns structured data, markdown returns a formatted string'),
	}).describe('Get a fast snapshot of what changed lately and what is in flight in this repo. Returns recent git activity, idea/project status counts, stale items, plan coverage, and recent docs activity.'),

	ls: z.object({}).describe('List the available documents in the contentbase collection'),

	conductResearch: z.object({
		reportId: z.string().min(1).describe('The id of the report document (e.g. reports/my-topic). Must be in "approved" status. The report\'s Research Plan section will be used as the research prompt.'),
		subfolder: z.string().optional().describe('Optional subfolder within docs/reports/ for the researcher to write artifacts into. Created automatically if it does not exist. E.g. "jason-eckert-harvest" → docs/reports/jason-eckert-harvest/'),
	}).describe('Kick off a research job in the background using the researcher assistant. The report must exist and be in "approved" status. Returns immediately after launch — use checkResearchStatus to monitor progress. The researcher writes results to disk incrementally.'),

	checkResearchStatus: z.object({
		reportId: z.string().optional().describe('The id of a specific report to check status for. If omitted, returns status of all research jobs.'),
	}).describe('Check the status of background research jobs. Returns whether each job is running, completed, or failed. You can also check the output directory for incremental results.'),

	commitFile: z.object({
		filePath: z.string().min(1).describe('The path of the file to commit, relative to the repo root (e.g. docs/memories/SELF.md)'),
		message: z.string().min(1).describe('The commit message'),
	}).describe('Stage and commit exactly one file. Use this after writing or editing a document to commit the change. Only the specified file will be staged — other working tree changes are left untouched. NOTE: Many docs/ subfolders are gitignored (reports/, prompts/, tasks/, README.md, TABLE-OF-CONTENTS.md) because the repo is a shareable template — the content is personal. If this tool returns an error or empty commit for a gitignored path, that is perfectly fine and expected. Do not treat it as a failure, do not retry, and do not mention the failure to the user — they already know these paths are gitignored. Just move on silently.'),

	presentDocument: z.object({
		path: z.string().min(1).describe('The document id to present (e.g. "goals/user-experience-improvements"). Use the ids from the ls tool. Prefixes like "docs/" and suffixes like ".md" are stripped automatically.'),
	}).describe('Open a contentbase document in a native window via the content service. Call ls first to see available document ids, then pass the one you want to present.'),
	
	listTodos: z.object({}).describe('List the TODOs in the TODO.md file in memories.  NOTE, if for some reason this does not match what you think it should, you should probably re-read your memory docs to make sure you are up to date.'),

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
		'You can use readFile to read any of these documents at docs/<id>.md'
	].join('\n')
}

export async function listTodos() : Promise<{ description: string, completed: boolean, index: number }[]> {
	const doc = await container.docs.parseMarkdownAtPath('docs/memories/TODO.md')
	const todosSection = doc.querySection('TODOS') 

	if (!todosSection) {
		throw new Error(`Something is off with the TODO.md in memories`)
	}

	const todoItems = todosSection.selectAll('listItem') as any[]
	const todoLines = todosSection.selectAll('listItem paragraph text')

	return todoLines.map((line,index) => ({
		description: (line as any)?.value || '',
		completed: todoItems[index]?.checked ?? false,
		index: index,
	}))
}

export async function README() : Promise<string> {
	// regenerate the readme fresh
	await assistant.container.proc.spawnAndCapture('cnotes', ['summary'])
	// make sure the collection is fresh
	await assistant.contentDb.collection.load({ refresh: true })

	const docs = await assistant.contentDb.readMultiple(['memories/SELF', 'memories/USER', 'memories/TODO', 'README','assistant-README'])
	return docs
}


let researchAssistant : Assistant | undefined

interface ResearchJob {
	reportId: string
	outputDir: string
	startedAt: string
	status: 'running' | 'completed' | 'failed'
	error?: string
	finishedAt?: string
}

const researchJobs: Map<string, ResearchJob> = new Map()

export async function conductResearch(options: z.infer<typeof schemas.conductResearch>) : Promise<string> {
	const { reportId, subfolder } = options
	const id = reportId.replace(/.md$/i, '').replace(/^docs\//i, '')

	// Check if there's already a running job for this report
	const existing = researchJobs.get(id)
	if (existing?.status === 'running') {
		return JSON.stringify({ success: false, error: `Research is already running for "${id}" (started ${existing.startedAt}). Use checkResearchStatus to monitor progress.` })
	}

	// Read the report
	await assistant.contentDb.collection.load({ refresh: true })
	const doc = assistant.contentDb.collection.document(id)

	if (!doc) {
		return JSON.stringify({ success: false, error: `Report "${id}" not found.` })
	}

	if (doc.meta?.status !== 'approved') {
		return JSON.stringify({ success: false, error: `Report "${id}" is in "${doc.meta?.status}" status. It must be "approved" before research can begin. Present the research plan to the boss for approval first.` })
	}

	// Determine and create output directory
	let outputDir = 'docs/reports'
	if (subfolder) {
		outputDir = `docs/reports/${subfolder}`
		const fs = container.feature('fs')
		await fs.ensureFolderAsync(outputDir)
	}

	// Extract the Research Plan section to use as the prompt
	const fullContent = await assistant.contentDb.readMultiple([id])

	// Update status to researching
	doc.meta.status = 'researching'
	await doc.save()

	// Spawn the researcher
	if (!researchAssistant) {
		researchAssistant = await assistant.subagent('researcher')
	}

	// Set output folder on researcher state so it propagates to forks via onFork
	researchAssistant.state.set('outputFolder', outputDir)
	researchAssistant.addSystemPromptExtension('output-folder', [
		'## Output Directory',
		`Write ALL research output files to: ${outputDir}/`,
		'Do NOT write files outside of this directory.',
		'',
		'## Incremental Saving',
		'Save your work to disk incrementally — create your output file early with your first finding, then use editFile to append new sections as you discover more.',
		'Do NOT wait until you are finished to write. Partial results must survive interruption.',
	].join('\n'))

	const prompt = [
		`You are conducting research for a report: "${doc.title || id}"`,
		'',
		`IMPORTANT: Write all output files to the ${outputDir}/ directory. Save incrementally — create your file early and append findings as you go, so partial results survive if the job is aborted.`,
		'',
		'Here is the full report with the research plan:',
		'---',
		fullContent,
		'---',
		'',
		'Investigate the questions in the Research Plan thoroughly.',
		'Return your findings organized by question, with sources cited.',
		'Be specific, factual, and note any contradictions or gaps.',
	].join('\n')

	// Track the job
	const job: ResearchJob = {
		reportId: id,
		outputDir,
		startedAt: new Date().toISOString(),
		status: 'running',
	}
	researchJobs.set(id, job)

	// Fire and forget — don't await
	researchAssistant.ask(prompt).then(() => {
		job.status = 'completed'
		job.finishedAt = new Date().toISOString()
	}).catch((err: any) => {
		job.status = 'failed'
		job.error = err?.message || String(err)
		job.finishedAt = new Date().toISOString()
	})

	return JSON.stringify({
		success: true,
		reportId: id,
		outputDir,
		message: `Research job launched for "${id}". The researcher is working in the background and writing results to ${outputDir}/. Use checkResearchStatus to monitor progress, or check the output directory directly.`,
	})
}

export async function checkResearchStatus(options: z.infer<typeof schemas.checkResearchStatus>) : Promise<string> {
	const { reportId } = options
	const id = reportId ? reportId.replace(/.md$/i, '').replace(/^docs\//i, '') : undefined

	if (id) {
		const job = researchJobs.get(id)
		if (!job) {
			return JSON.stringify({ found: false, message: `No research job found for "${id}".` })
		}
		return JSON.stringify(job)
	}

	// Return all jobs
	const allJobs = Object.fromEntries(researchJobs)
	if (researchJobs.size === 0) {
		return JSON.stringify({ message: 'No research jobs have been launched this session.' })
	}
	return JSON.stringify(allJobs)
}

let codingAssistant : Assistant | undefined

export async function askCodingAssistant(options: z.infer<typeof schemas.askCodingAssistant>) : Promise<string> {
	const { question } = options
	
	if (!codingAssistant) {
		codingAssistant = await assistant.subagent('lucaCoder')
	}

	return codingAssistant.ask(question)
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


export async function commitFile(options: z.infer<typeof schemas.commitFile>): Promise<{ success: boolean, error?: string }> {
	const { filePath, message } = options
	const proc = assistant.container.feature('proc')
	const cwd = assistant.container.cwd

	try {
		await proc.exec(`git -C "${cwd}" add -- "${filePath}"`)
		await proc.exec(`git -C "${cwd}" commit -m "${message.replace(/"/g, '\\"')}" -- "${filePath}"`)
		return { success: true }
	} catch (err: any) {
		return { success: false, error: err?.message || String(err) }
	}
}

export async function presentDocument(options: z.infer<typeof schemas.presentDocument>): Promise<{ success: boolean, url?: string, error?: string }> {
	// Normalize: strip leading "docs/" and trailing ".md"
	const docPath = options.path
		.replace(/^docs\//, '')
		.replace(/\.md$/i, '')

	// Verify the document exists
	await assistant.contentDb.collection.load({ refresh: true })
	const available = assistant.contentDb.collection.available
	if (!available.includes(docPath)) {
		return { success: false, error: `Document "${docPath}" not found. Call ls to see available documents.` }
	}

	// Look up the content service port from the instance registry
	const registry = assistant.container.feature('instanceRegistry')
	const instance = registry.getSelf()
	const contentPort = instance?.ports?.content

	if (!contentPort) {
		return { success: false, error: 'Content service port not found. Is luca main running?' }
	}

	const url = `http://localhost:${contentPort}/docs/${docPath}`

	// Open in a native window via windowManager
	const windowManager = assistant.container.feature('windowManager')
	await windowManager.spawn({ url, title: docPath, width: 900, height: 700 })

	return { success: true, url }
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

	const fs = assistant.container.feature('fs')

	// Ensure collection is loaded
	if (!collection.isLoaded) await collection.load()

	// 0. Vision hash check
	const visionHash = assistant.container.utils.hashObject({
		vision: fs.readFile('docs/VISION.md')
	})
	const visionEdited = visionHash !== '6pvu54'

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

	// Vision status
	if (!s.visionEdited) {
		lines.push(`> ⚠️ **userHasNotEditedVisionDocument** — The vision file has not been customized yet.\n`)
	}

	// Totals
	lines.push(`## Document Totals\n`)
	lines.push(`- **Ideas**: ${s.totals.ideas}`)
	lines.push(`- **Goals**: ${s.totals.goals}`)
	lines.push(`- **Projects**: ${s.totals.projects}`)
	lines.push(`- **Plans**: ${s.totals.plans}`)
	lines.push('')

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

	// Goal status counts
	lines.push(`## Goals by Status\n`)
	const goalTotal = Object.values(s.goalStatusCounts).reduce((a, b) => a + b, 0)
	lines.push(`Total: ${goalTotal}\n`)
	for (const [status, count] of Object.entries(s.goalStatusCounts).sort((a, b) => b[1] - a[1])) {
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
