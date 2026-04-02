import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, features } from '@soederpop/luca'
import type { ExpressServer } from '@soederpop/luca'
import type { AGIContainer} from '@soederpop/luca/agi'

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

// ── Feature ───────────────────────────────────────────────────────────────────

/**
 * WorkflowService — one Express server that:
 *  - Discovers all workflows public directories and serves them statically
 *  - Loads ContentDB once and attaches it to app.locals.docs
 *  - Serves shared CSS at /shared/base.css
 *  - Exposes GET /api/workflows
 *  - Renders a landing page at /
 */
export class WorkflowService extends Feature<WorkflowServiceState, WorkflowServiceOptions> {
  static override shortcut = 'features.workflowService' as const
  static override stateSchema = WorkflowServiceStateSchema
  static override optionsSchema = WorkflowServiceOptionsSchema

  static {
    Feature.register(this as any, 'workflowService')
  }

  private _expressServer: any = null
  
  override get container() : AGIContainer {
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

  /**
   * Start the unified workflow server.
   * Discovers all workflows, mounts their public dirs, loads ContentDB,
   * and begins listening.
   */
  async start(): Promise<this> {
    const library = this.container.feature('workflowLibrary')
    if (!library.isLoaded) await library.discover()

    const workflows = library.workflows.filter((w) => w.hasPublicDir)
    
    const server = this.expressServer

    const app = server.app
    const express = server.express
    
    const { docs } = this.container

    await docs.load()
    app.locals.docs = docs
    app.locals.container = this.container

    // 4. Serve shared CSS
    const sharedCssPath = this.container.paths.resolve('workflows/shared/base.css')
    app.get('/shared/base.css', (_req: any, res: any) => {
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
      res.sendFile(sharedCssPath)
    })

    // 5. Mount each workflow's public/ as /workflows/:name/
    for (const workflow of workflows) {
      const publicDir = this.container.paths.resolve(workflow.folderPath, 'public')
      app.use(`/workflows/${workflow.name}`, express.static(publicDir))
    }

    // 6. GET /api/workflows
    app.get('/api/workflows', (_req: any, res: any) => {
      res.json({
        workflows: library.workflows.map((w) => ({
          name: w.name,
          title: w.title,
          description: w.description,
          tags: w.tags,
          url: `/workflows/${w.name}/`,
          hasPublicDir: w.hasPublicDir,
        })),
      })
    })

    // 7. Start listening
    await server.start()

    this.state.set('port', server.port)
    this.state.set('listening', true)
    this.state.set('workflowCount', workflows.length)

    this.emit('started', { port: server.port, workflowCount: workflows.length })

    return this 
  }

  /** Stop the server and clean up. */
  async stop() {
    if (this._expressServer) {
      await this._expressServer.stop()
      this._expressServer = null
    }
    this.state.set('listening', false)
    this.state.set('port', null)
    this.emit('stopped')
  }

}

export default features.register('workflowService', WorkflowService)
