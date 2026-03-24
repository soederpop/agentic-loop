import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    workflowLibrary: typeof WorkflowLibrary
  }
}

export interface WorkflowInfo {
  name: string
  title: string
  description: string
  tags: string[]
  folderPath: string
  hasServeHook: boolean
  hasPublicDir: boolean
  raw: Record<string, any>
}

export const WorkflowLibraryStateSchema = FeatureStateSchema.extend({
  workflows: z.array(z.any()).default([]),
  loaded: z.boolean().default(false),
})

export type WorkflowLibraryState = z.infer<typeof WorkflowLibraryStateSchema>

export const WorkflowLibraryOptionsSchema = FeatureOptionsSchema.extend({
  workflowsDir: z.string().optional().describe('Override the workflows directory path'),
})
export type WorkflowLibraryOptions = z.infer<typeof WorkflowLibraryOptionsSchema>

export class WorkflowLibrary extends Feature<WorkflowLibraryState, WorkflowLibraryOptions> {
  static override shortcut = 'features.workflowLibrary' as const
  static override stateSchema = WorkflowLibraryStateSchema
  static override optionsSchema = WorkflowLibraryOptionsSchema

  static tools = {
    listAvailableWorkflows: {
      description: 'List all available workflows with their names, descriptions, and metadata',
      schema: z.object({
        tag: z.string().optional().describe('Filter workflows by tag'),
      }),
    },
    viewWorkflow: {
      description: 'View detailed information about a specific workflow including its full ABOUT.md content',
      schema: z.object({
        name: z.string().describe('The workflow name (folder name)'),
      }),
    },
  }

  get workflowsDir(): string {
    return this.options.workflowsDir || this.container.paths.resolve('workflows')
  }

  get workflows(): WorkflowInfo[] {
    return this.state.get('workflows') || [] as WorkflowInfo[]
  }

  get isLoaded(): boolean {
    return this.state.get('loaded') as boolean
  }

  override async afterInitialize() {
    await this.discover()
  }

  get available() {
	  return this.workflows.map(w => w.name)
  }

  /** Scan the workflows directory and parse each ABOUT.md */
  async discover(): Promise<WorkflowInfo[]> {
    const fs = this.container.fs
    const dir = this.workflowsDir

    const entries = fs.readdirSync(dir).filter((name: string) => {
      // Skip files (only directories — files have extensions)
      if (name.match(/\.\w+$/)) return false
      const s = fs.stat(this.container.paths.resolve(dir, name))
      return s.isDirectory()
    })

    const workflows: WorkflowInfo[] = []

    for (const name of entries) {
      const folderPath = this.container.paths.resolve(dir, name)
      const aboutPath = this.container.paths.resolve(folderPath, 'ABOUT.md')

      let info: WorkflowInfo = {
        name,
        title: name,
        description: '',
        tags: [],
        folderPath,
        hasServeHook: fs.existsSync(this.container.paths.resolve(folderPath, 'luca.serve.ts')),
        hasPublicDir: fs.existsSync(this.container.paths.resolve(folderPath, 'public')),
        raw: {},
      }

      if (fs.existsSync(aboutPath)) {
        try {
          const docs = (this.container as any).docs ?? this.container.feature('contentDb', {
            rootPath: this.container.paths.resolve('docs'),
          })
          if (!docs.isLoaded) await docs.load()
          const parsed = await docs.parseMarkdownAtPath(aboutPath)
          const meta = parsed.meta || {}
          info.title = meta.title || parsed.title || name
          info.description = meta.description || ''
          info.tags = meta.tags || []
          info.raw = { ...meta, content: parsed.content }
        } catch {
          // Workflow exists but ABOUT.md can't be parsed — still include it
        }
      }

      workflows.push(info)
    }

    this.state.set('workflows', workflows)
    this.state.set('loaded', true)
    this.emit('discovered', workflows)
    return workflows
  }

  /** Get a specific workflow by name */
  get(name: string): WorkflowInfo | undefined {
    return this.workflows.find((w) => w.name === name)
  }

  // --- Tool handlers (matched by name to static tools) ---

  async listAvailableWorkflows(options: { tag?: string } = {}): Promise<WorkflowInfo[]> {
    if (!this.isLoaded) await this.discover()

    let results = this.workflows
    if (options.tag) {
      results = results.filter((w) => w.tags.includes(options.tag!))
    }

    return results
  }

  async viewWorkflow(options: { name: string }): Promise<WorkflowInfo & { content?: string }> {
    if (!this.isLoaded) await this.discover()

    const workflow = this.get(options.name)
    if (!workflow) {
      throw new Error(`Workflow not found: ${options.name}. Available: ${this.workflows.map((w) => w.name).join(', ')}`)
    }

    return {
      ...workflow,
      content: workflow.raw?.content,
    }
  }

  async runWorkflow(options: { name: string }): Promise<{ url: string; pid?: number }> {
    if (!this.isLoaded) await this.discover()

    const workflow = this.get(options.name)
    if (!workflow) {
      throw new Error(`Workflow not found: ${options.name}. Available: ${this.workflows.map((w) => w.name).join(', ')}`)
    }

    if (!workflow.hasServeHook) {
      throw new Error(`Workflow "${options.name}" has no luca.serve.ts — cannot run it as a server`)
    }

    const networking = this.container.feature('networking')
    const actualPort = await networking.findOpenPort(3001)
    const url = `http://localhost:${actualPort}`

    const args = ['workflow', 'run', options.name]

    let resolvedPid: number | undefined

    // Dispatch the workflow command headlessly — fire and forget
    this.container.proc.spawnAndCapture('luca', args, {
      stdio: 'ignore',
      onStart: (p: any) => {
        resolvedPid = p.pid
        this.emit('workflowStarted', { name: options.name, url, pid: p.pid })
      },
    })

    // Give the server a moment to bind
    await new Promise((resolve) => setTimeout(resolve, 1500))

    return { url, pid: resolvedPid }
  }

  generateSummary() {
	  const summaries = this.workflows.map(w => {
		  return w.raw
	  }).join("\n---\n")

  }

  override setupToolsConsumer(assistant: Assistant) {
	  Promise.resolve(this.discover()).then(() => {
	  	assistant.addSystemPromptExtension('workflowLibraryTools', this.generateSummary.call(this))
	  })
  }
}

export default features.register('workflowLibrary', WorkflowLibrary)
