import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, features } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

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

  get expressServer() {
    return this._expressServer
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
  async start(options: { port?: number; host?: string } = {}): Promise<any> {
    const port = options.port ?? this.options.port
    const host = options.host ?? this.options.host

    // 1. Discover workflows
    const library = this.container.feature('workflowLibrary')
    if (!library.isLoaded) await library.discover()

    const workflows = library.workflows.filter((w) => w.hasPublicDir)

    // 2. Create the Express server (no static dir — we mount manually)
    const server = this.container.server('express', {
      port,
      host,
      cors: true,
    })

    this._expressServer = server

    const app = server.app
    const express = server.express

    // 3. Load ContentDB once and attach to app.locals
    const docs = this.container.feature('contentDb', {
      rootPath: this.container.paths.resolve('docs'),
    })
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

    // 7. Landing page at /
    app.get('/', (_req: any, res: any) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(this._renderLandingPage(library.workflows, port))
    })

    // 8. Start listening
    await server.start({ port, host })

    this.state.set('port', port)
    this.state.set('listening', true)
    this.state.set('workflowCount', workflows.length)

    this.emit('started', { port, host, workflowCount: workflows.length })

    return server
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

  // ── Private ──────────────────────────────────────────────────────────────

  private _renderLandingPage(workflows: any[], port: number): string {
    const workflowItems = workflows
      .filter((w) => w.hasPublicDir)
      .map((w) => {
        const tags = (w.tags || []).map((t: string) => `<span class="tag">${t}</span>`).join('')
        return `
      <a class="workflow-card" href="/workflows/${w.name}/">
        <div class="card-name">${w.name}</div>
        <div class="card-title">${w.title || w.name}</div>
        ${w.description ? `<div class="card-desc">${w.description}</div>` : ''}
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      </a>`
      })
      .join('\n')

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agentic Loop — Workflows</title>
<link rel="stylesheet" href="/shared/base.css">
<style>
  body {
    padding: 32px 24px;
    max-width: 900px;
    margin: 0 auto;
  }

  .header {
    margin-bottom: 32px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 20px;
  }

  .header h1 {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .header p {
    color: var(--text-dim);
    font-size: 12px;
    margin-top: 6px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .workflow-card {
    display: block;
    text-decoration: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    transition: border-color 0.15s, background 0.15s;
    animation: fadeIn 0.2s ease-out;
  }

  .workflow-card:hover {
    border-color: var(--accent);
    background: var(--surface-2);
  }

  .card-name {
    font-size: 10px;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
  }

  .card-desc {
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.4;
    margin-bottom: 8px;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }

  .tag {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--accent-dim);
    color: var(--accent);
    border-radius: 3px;
  }

  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-faint);
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Agentic Loop</h1>
    <p>${workflows.filter((w) => w.hasPublicDir).length} workflows available &mdash; port ${port}</p>
  </div>
  <div class="grid">
${workflowItems}
  </div>
  <div class="footer">
    <span>workflow service</span>
    <span><a href="/api/workflows" style="color:var(--accent);text-decoration:none">/api/workflows</a></span>
  </div>
</body>
</html>`
  }
}

export default features.register('workflowService', WorkflowService)
