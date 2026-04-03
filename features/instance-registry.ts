import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'

// ─── Standalone helpers (importable without a container) ──────────────────────

/**
 * Read the registry entry for the instance running from a given cwd.
 * Returns null if no entry exists or the process is dead.
 */
export function readInstanceEntry(cwd: string): InstanceEntry | null {
  const id = basename(cwd).replace(/[/\\:]/g, '_')
  const file = join(REGISTRY_DIR, `${id}.json`)
  if (!existsSync(file)) return null
  try {
    const entry = InstanceEntrySchema.parse(JSON.parse(readFileSync(file, 'utf-8')))
    // Verify process is still alive
    try { process.kill(entry.pid, 0) } catch { return null }
    return entry
  } catch {
    return null
  }
}

/**
 * Read the registry entry for the current working directory.
 */
export function readCurrentInstance(): InstanceEntry | null {
  return readInstanceEntry(process.cwd())
}

/**
 * List all live instances from the registry.
 */
export function listAllInstances(): InstanceEntry[] {
  if (!existsSync(REGISTRY_DIR)) return []
  const entries: InstanceEntry[] = []
  for (const file of readdirSync(REGISTRY_DIR)) {
    if (!file.endsWith('.json')) continue
    try {
      const entry = InstanceEntrySchema.parse(JSON.parse(readFileSync(join(REGISTRY_DIR, file), 'utf-8')))
      try { process.kill(entry.pid, 0); entries.push(entry) } catch {}
    } catch {}
  }
  return entries
}

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    instanceRegistry: typeof InstanceRegistry
  }
}

const REGISTRY_DIR = join(homedir(), '.luca', 'agentic-loops')

/** Shape of a registered instance */
export const InstanceEntrySchema = z.object({
  id: z.string(),
  cwd: z.string(),
  pid: z.number(),
  startedAt: z.string(),
  ports: z.object({
    authority: z.number(),
    content: z.number(),
    workflow: z.number(),
  }),
})
export type InstanceEntry = z.infer<typeof InstanceEntrySchema>

export const InstanceRegistryStateSchema = FeatureStateSchema.extend({
  registered: z.boolean().default(false),
  instanceId: z.string().optional(),
})

export const InstanceRegistryOptionsSchema = FeatureOptionsSchema.extend({})

/**
 * Manages ~/.luca/agentic-loops/ as a shared registry so multiple luca main
 * processes on the same machine can coexist without port collisions.
 *
 * Instance ID is derived from the CWD basename (e.g. "@agentic-loop").
 */
export class InstanceRegistry extends Feature<
  z.infer<typeof InstanceRegistryStateSchema>,
  z.infer<typeof InstanceRegistryOptionsSchema>
> {
  static override shortcut = 'features.instanceRegistry' as const
  static override stateSchema = InstanceRegistryStateSchema
  static override optionsSchema = InstanceRegistryOptionsSchema
  static override description = 'Shared instance registry for multi-project luca main coexistence'

  static {
    Feature.register(this, 'instanceRegistry')
  }

  /** Default port ranges — each instance gets the next available set */
  static BASE_PORTS = {
    authority: 4410,
    content: 4100,
    workflow: 7700,
  }

  get registryDir() {
    return REGISTRY_DIR
  }

  get instanceId(): string {
    return basename(this.container.cwd)
  }

  get instanceFile(): string {
    // Sanitize the ID for use as a filename (@ is fine, but be safe)
    const safeId = this.instanceId.replace(/[/\\:]/g, '_')
    return join(REGISTRY_DIR, `${safeId}.json`)
  }

  /** Ensure the registry directory exists */
  ensureDir() {
    if (!existsSync(REGISTRY_DIR)) {
      mkdirSync(REGISTRY_DIR, { recursive: true })
    }
  }

  /** Read all currently registered instances */
  listInstances(): InstanceEntry[] {
    this.ensureDir()
    const entries: InstanceEntry[] = []
    for (const file of readdirSync(REGISTRY_DIR)) {
      if (!file.endsWith('.json')) continue
      try {
        const raw = JSON.parse(readFileSync(join(REGISTRY_DIR, file), 'utf-8'))
        entries.push(InstanceEntrySchema.parse(raw))
      } catch {
        // Corrupted or stale — skip
      }
    }
    return entries
  }

  /** Get a specific instance by ID */
  getInstance(id: string): InstanceEntry | null {
    const safeId = id.replace(/[/\\:]/g, '_')
    const file = join(REGISTRY_DIR, `${safeId}.json`)
    if (!existsSync(file)) return null
    try {
      return InstanceEntrySchema.parse(JSON.parse(readFileSync(file, 'utf-8')))
    } catch {
      return null
    }
  }

  /** Get the entry for the current project, if registered */
  getSelf(): InstanceEntry | null {
    return this.getInstance(this.instanceId)
  }

  /** Collect all ports currently claimed by other instances */
  claimedPorts(): Set<number> {
    const claimed = new Set<number>()
    for (const entry of this.listInstances()) {
      // Skip our own stale entry
      if (entry.id === this.instanceId) continue
      // Skip entries whose process is no longer alive
      if (!this.isProcessAlive(entry.pid)) continue
      for (const port of Object.values(entry.ports)) {
        claimed.add(port)
      }
    }
    return claimed
  }

  /**
   * Allocate ports for this instance, avoiding collisions with other
   * registered instances and verifying ports are actually open.
   */
  async allocatePorts(): Promise<InstanceEntry['ports']> {
    const networking = this.container.feature('networking')
    const claimed = this.claimedPorts()

    const findPort = async (base: number): Promise<number> => {
      let port = base
      while (claimed.has(port) || !(await networking.isPortOpen(port))) {
        port++
        if (port > base + 100) throw new Error(`Could not find open port starting from ${base}`)
      }
      claimed.add(port) // Reserve it for subsequent allocations in this call
      return port
    }

    return {
      authority: await findPort(InstanceRegistry.BASE_PORTS.authority),
      content: await findPort(InstanceRegistry.BASE_PORTS.content),
      workflow: await findPort(InstanceRegistry.BASE_PORTS.workflow),
    }
  }

  /** Register this instance with its allocated ports */
  register(ports: InstanceEntry['ports']): InstanceEntry {
    this.ensureDir()
    const entry: InstanceEntry = {
      id: this.instanceId,
      cwd: this.container.cwd,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      ports,
    }
    writeFileSync(this.instanceFile, JSON.stringify(entry, null, 2))
    this.state.set('registered', true)
    this.state.set('instanceId', this.instanceId)
    return entry
  }

  /** Deregister this instance (called on shutdown) */
  deregister() {
    try {
      if (existsSync(this.instanceFile)) {
        unlinkSync(this.instanceFile)
      }
    } catch {}
    this.state.set('registered', false)
  }

  /** Clean up stale entries whose processes are no longer alive */
  pruneStale(): string[] {
    const pruned: string[] = []
    this.ensureDir()
    for (const file of readdirSync(REGISTRY_DIR)) {
      if (!file.endsWith('.json')) continue
      try {
        const raw = JSON.parse(readFileSync(join(REGISTRY_DIR, file), 'utf-8'))
        const entry = InstanceEntrySchema.parse(raw)
        if (!this.isProcessAlive(entry.pid)) {
          unlinkSync(join(REGISTRY_DIR, file))
          pruned.push(entry.id)
        }
      } catch {
        // Corrupted — remove it
        try { unlinkSync(join(REGISTRY_DIR, file)) } catch {}
        pruned.push(file)
      }
    }
    return pruned
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
}
