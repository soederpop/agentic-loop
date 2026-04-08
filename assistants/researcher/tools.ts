import { z } from 'zod'

const fileTools = container.feature('fileTools')

export const use = [
	container.feature('browserUse', { headed: true }),
	fileTools.toTools({ only: ['listDirectory', 'writeFile', 'editFile', 'deleteFile'] }),
]

export const schemas = {
	createResearchJob: z.object({
		prompt: z.string().describe(
			'Shared context that all parallel research forks will see. Describe the overarching question or framing so each fork understands the bigger picture. Keep it concise but sufficient — each fork only sees this prompt plus its individual question.'
		),
		questions: z.array(z.string().min(5)).min(2).describe(
			'The specific questions to investigate in parallel. Each one becomes an independent research fork. Make them focused and non-overlapping — broad questions produce shallow results. 2-5 questions is the sweet spot.'
		),
		effort: z.enum(['low', 'medium', 'high']).optional().describe(
			'Research effort level. "low" for quick factual lookups and simple verification. "medium" (default) for standard research. "high" for deep analysis requiring nuanced reasoning.'
		),
		history: z.enum(['full', 'none']).optional().describe(
			'How much conversation context each fork inherits. "none" (default) means forks only get the system prompt + shared research prompt — cheapest and usually sufficient. "full" means forks see the entire conversation so far — use when the question requires understanding prior discussion.'
		),
	}).describe(
		'Kick off a parallel research job. Creates multiple independent forks that investigate different angles simultaneously. Returns a job ID immediately — does NOT block. Use checkResearchJobs to poll for results. Best for 2-5 independent sub-questions that do not depend on each other.'
	),

	checkResearchJobs: z.object({
		jobId: z.string().optional().describe(
			'Check a specific job by ID. Omit to get a summary of all active and completed jobs.'
		),
	}).describe(
		'Check the status and results of research jobs. Returns progress (completed/total), status, and any results that have come in so far. Call this periodically after creating a job — do not spin-wait.'
	),

	addSource: z.object({
		url: z.string().describe('The URL of the source. Use the actual page URL, not a shortened or tracking link.'),
		title: z.string().describe('A concise title for the source. Use the page title or a descriptive label if the page title is generic.'),
		comment: z.string().describe(
			'Your annotation on this source — what it establishes, why it matters, how reliable you judge it to be. This is YOUR note, not a summary of the source. Be specific: "Confirms that X uses Y approach as of 2024" is better than "Discusses X".'
		),
		tags: z.array(z.string()).optional().describe(
			'Optional tags for categorizing this source. Useful when a research project spans multiple sub-topics.'
		),
	}).describe(
		'Register a source you have found during research. Every meaningful claim should trace back to a source. Call this as soon as you find something relevant — do not wait until the end. Returns a source ID you can use in citations.'
	),

	removeSource: z.object({
		sourceId: z.string().describe('The ID of the source to remove (returned by addSource).'),
		reason: z.string().optional().describe(
			'Why you are removing this source. Helps maintain an audit trail — e.g. "Superseded by more recent data" or "Source turned out to be unreliable".'
		),
	}).describe(
		'Remove a previously registered source. Use when a source turns out to be unreliable, outdated, irrelevant, or superseded by a better source. The source is soft-deleted — it remains in the audit trail but will not appear in active sources.'
	),

	listSources: z.object({
		tags: z.array(z.string()).optional().describe('Filter sources by tags. Returns only sources matching ALL specified tags.'),
	}).describe(
		'List all active sources registered during this research session. Returns source IDs, titles, URLs, and your comments. Use this to review what you have found so far and to construct citation lists.'
	),
}

// -- Source Management --

interface Source {
	id: string
	url: string
	title: string
	comment: string
	tags: string[]
	addedAt: string
	removed?: boolean
	removedReason?: string
}

function getSources(): Source[] {
	return (assistant.state.get('sources') as Source[] | undefined) || []
}

function setSources(sources: Source[]) {
	assistant.state.set('sources', sources)
}

export function addSource(options: z.infer<typeof schemas.addSource>): string {
	const sources = getSources()
	const id = String(sources.length + 1)

	const source: Source = {
		id,
		url: options.url,
		title: options.title,
		comment: options.comment,
		tags: options.tags || [],
		addedAt: new Date().toISOString(),
	}

	setSources([...sources, source])

	return JSON.stringify({
		sourceId: id,
		message: `Source [${id}] registered: "${options.title}"`,
	})
}

export function removeSource(options: z.infer<typeof schemas.removeSource>): string {
	const sources = getSources()
	const source = sources.find(s => s.id === options.sourceId && !s.removed)

	if (!source) {
		return JSON.stringify({ error: `Source ${options.sourceId} not found or already removed.` })
	}

	source.removed = true
	source.removedReason = options.reason
	setSources([...sources])

	return JSON.stringify({
		message: `Source [${source.id}] removed: "${source.title}"${options.reason ? ` — ${options.reason}` : ''}`,
	})
}

export function listSources(options: z.infer<typeof schemas.listSources>): string {
	const sources = getSources().filter(s => !s.removed)

	const filtered = options.tags?.length
		? sources.filter(s => options.tags!.every(t => s.tags.includes(t)))
		: sources

	if (filtered.length === 0) {
		return JSON.stringify({ sources: [], message: 'No active sources registered.' })
	}

	return JSON.stringify({
		count: filtered.length,
		sources: filtered.map(s => ({
			id: s.id,
			title: s.title,
			url: s.url,
			comment: s.comment,
			tags: s.tags,
		})),
	})
}

// -- Research Job Management --

const effortModels: Record<string, string> = {
	low: 'gpt-5.4',
	medium: 'gpt-5.4',
	high: 'gpt-5.4',
}

export async function createResearchJob(options: z.infer<typeof schemas.createResearchJob>): Promise<string> {
	if (assistant.isFork) {
		return JSON.stringify({ error: 'Research forks cannot create sub-forks. Answer the question directly.' })
	}

	const model = effortModels[options.effort || 'medium']

	const outputFolder = assistant.state.get('outputFolder') as string | undefined
	
	if (outputFolder) {
		await container.fs.ensureFolderAsync(outputFolder)
	}

	const job = await assistant.createResearchJob(
		options.prompt,
		options.questions,
		{
			history: options.history === 'full' ? 'full' : 'none',
			model,
			forbidTools: ['createResearchJob', 'checkResearchJobs'],
			onFork: (fork) => {
				if (outputFolder) {
					fork.addSystemPromptExtension('output-folder', [
						'## Output Directory',
						`Write ALL research output files to: ${outputFolder}/`,
						'Do NOT write files outside of this directory.',
						'',
						'## Incremental Saving',
						'Save your work to disk incrementally — create your output file early with your first finding, then use editFile to append new sections as you discover more.',
						'Do NOT wait until you are finished to write. Partial results must survive interruption.',
					].join('\n'))
				}
			},
		}
	)

	return JSON.stringify({
		jobId: job.id,
		total: options.questions.length,
		status: 'running',
		message: `Research job started with ${options.questions.length} parallel forks. Use checkResearchJobs with jobId "${job.id}" to monitor progress.`,
		questions: options.questions,
	})
}

export function checkResearchJobs(options: z.infer<typeof schemas.checkResearchJobs>): string {
	if (options.jobId) {
		const job = assistant.researchJobs.get(options.jobId)
		if (!job) {
			return JSON.stringify({ error: `No job found with ID "${options.jobId}".` })
		}

		const state = {
			jobId: job.id,
			status: job.state.get('status'),
			completed: job.state.get('completed'),
			total: job.state.get('total'),
			questions: job.state.get('questions'),
			results: job.state.get('results'),
			errors: job.state.get('errors'),
		}

		return JSON.stringify(state)
	}

	// Summary of all jobs
	const jobs = Array.from(assistant.researchJobs.entries()).map(([id, job]) => ({
		jobId: id,
		status: job.state.get('status'),
		completed: job.state.get('completed'),
		total: job.state.get('total'),
		questions: job.state.get('questions'),
	}))

	if (jobs.length === 0) {
		return JSON.stringify({ jobs: [], message: 'No research jobs have been created.' })
	}

	return JSON.stringify({
		count: jobs.length,
		jobs,
	})
}
