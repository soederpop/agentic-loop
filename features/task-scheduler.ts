import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'
import type { ContentDb } from '@soederpop/luca/agi'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    taskScheduler: typeof TaskScheduler
  }
}

const TaskEntrySchema = z.object({
  id: z.string(),
  schedule: z.string().optional(),
  agent: z.string().default('claude'),
  createdBy: z.string().default('soederpop'),
  repeatable: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  lastRanAt: z.number().optional(),
  running: z.boolean().default(false),
})

type TaskEntry = z.infer<typeof TaskEntrySchema>

export type { TaskEntry }

export const TaskSchedulerStateSchema = FeatureStateSchema.extend({
  running: z.boolean().default(false),
  tasks: z.array(TaskEntrySchema).default([]),
  currentTask: z.string().optional(),
})
export type TaskSchedulerState = z.infer<typeof TaskSchedulerStateSchema>

export const TaskSchedulerOptionsSchema = FeatureOptionsSchema.extend({
  tickInterval: z.number().default(60_000),
  autoStart: z.boolean().default(false),
  onExecute: z.any().optional(),
})
export type TaskSchedulerOptions = z.infer<typeof TaskSchedulerOptionsSchema>

/**
 * The TaskScheduler loads Task documents from the container's contentDb contentbase collection.
 *
 * It executes these tasks on a schedule.  
 *
 * The TaskScheduler is designed to act as a system wide singleton, and establishes a process lock.
*/
export class TaskScheduler extends Feature<TaskSchedulerState, TaskSchedulerOptions> {
  static override shortcut = 'features.taskScheduler' as const
  static override stateSchema = TaskSchedulerStateSchema
  static override optionsSchema = TaskSchedulerOptionsSchema

  private _timer: ReturnType<typeof setInterval> | null = null
  private _inProgress = new Set<string>()

  constructor(options: TaskSchedulerOptions, context: ContainerContext) {
    super(options, context)
    this.hide('_timer')
    this.hide('_inProgress')
  }

  override async afterInitialize() {
    if (this.options.autoStart) {
      await this.start()
    }
  }

  /** All loaded task entries from state */
  get tasks() {
    return this.state.get('tasks') as TaskEntry[]
  }

  /** Total number of loaded tasks */
  get taskCount() {
    return this.tasks.length
  }

  /** Tasks that are due for execution and not currently in progress or running */
  get dueTasks() {
    return this.tasks.filter((t) => this._isDue(t) && !this._inProgress.has(t.id) && !t.running) as TaskEntry[]
  }

  /** Number of tasks currently due for execution */
  get dueTaskCount() {
    return this.dueTasks.length
  }

  /** One-off tasks: repeatable=false, not yet completed (no lastRanAt), not in progress, not already running */
  get dueOneOffTasks(): TaskEntry[] {
    return this.tasks.filter(
      (t) => !t.repeatable && !t.lastRanAt && !this._inProgress.has(t.id) && !t.running
    )
  }

  /** Scheduled tasks that are due: repeatable=true with schedule, elapsed > interval, not in progress, not already running */
  get dueScheduledTasks(): TaskEntry[] {
    return this.tasks.filter(
      (t) => t.repeatable && t.schedule && this._isDue(t) && !this._inProgress.has(t.id) && !t.running
    )
  }

  /** Check if a task is currently being executed */
  isInProgress(taskId: string): boolean {
    return this._inProgress.has(taskId)
  }

  /** Get all currently in-progress task IDs */
  get inProgressIds(): string[] {
    return [...this._inProgress]
  }

  /** Start the scheduler loop, loading tasks and beginning the tick interval */
  async start() {
    if (this.state.get('running')) return this
    await this.loadTasks()
    this._timer = setInterval(() => this.tick(), this.options.tickInterval)
    this.state.set('running', true)
    this.emit('started')
    return this
  }

  /** Stop the scheduler loop and clear the tick interval */
  stop() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
    this.state.set('running', false)
    this.emit('stopped')
    return this
  }

  /** Load task entries from the contentDb Play and Task models, filtering untracked files and clearing stale running flags */
  async loadTasks() {
    const docs = (this.container as any).docs
    if (!docs.isLoaded) await docs.load()

    const tasks: TaskEntry[] = []

    // Load Plays (repeatable, scheduled)
    if (docs.models.Play) {
      const allPlays = await docs.query(docs.models.Play).fetchAll()
      for (const doc of allPlays) {
        tasks.push({
          id: doc.id,
          schedule: doc.meta?.schedule,
          agent: doc.meta?.agent ?? 'claude',
          repeatable: true,
          tags: doc.meta?.tags ?? [],
          lastRanAt: doc.meta?.lastRanAt ? Number(doc.meta.lastRanAt) : undefined,
          running: doc.meta?.running ?? false,
        })
      }
    }

    // Load Tasks (one-off)
    if (docs.models.Task) {
      const allTasks = await docs.query(docs.models.Task).fetchAll()
      for (const doc of allTasks) {
        tasks.push({
          id: doc.id,
          schedule: undefined,
          agent: doc.meta?.agent ?? 'claude',
          createdBy: doc.meta?.createdBy ?? 'soederpop',
          repeatable: false,
          tags: doc.meta?.tags ?? [],
          lastRanAt: doc.meta?.lastRanAt ? Number(doc.meta.lastRanAt) : undefined,
          running: doc.meta?.running ?? false,
        })
      }
    }

    // Gate: reject tasks whose files aren't tracked by git
    const git = this.container.feature('git')
    const untrackedFiles = await git.lsFiles({ others: true }).catch(() => [] as string[])
    const untrackedSet = new Set(untrackedFiles)

    const tracked: TaskEntry[] = []
    for (const t of tasks) {
      // Skip the git-tracking gate for tasks created by chief
      if (t.createdBy === 'chief') {
        tracked.push(t)
        continue
      }
      // Resolve the doc file path relative to the repo (e.g. docs/tasks/foo.md)
      const docPath = `docs/${t.id}.md`
      if (untrackedSet.has(docPath)) {
        this.emit('taskRejected', t.id, { reason: 'file not tracked by git', path: docPath })
        continue
      }
      tracked.push(t)
    }

    // Preserve in-memory running state for tasks actively executing in this process
    for (const t of tracked) {
      if (this._inProgress.has(t.id)) {
        t.running = true
      }
    }

    // Clear stale running flags from previous crashes (but not tasks actively running in this process)
    const stale = tracked.filter((t) => t.running && !this._inProgress.has(t.id))
    for (const t of stale) {
      t.running = false
      await this._updateTaskMeta(t.id, { running: false }).catch(() => {})
    }

    this.state.set('tasks', tracked)
    this.emit('tasksLoaded', tracked)
    return this
  }

  /** Load the contentbase document model for a specific task by ID */
  async loadTaskModel(taskId: string) {
    const docs = (this.container as any).docs as ContentDb

    if (!docs.isLoaded) await docs.load()

    // Determine model based on prefix
    const isPlay = taskId.startsWith('plays/')
    const Model = isPlay ? docs.models.Play : docs.models.Task
    const doc = await docs.collection.getModel(taskId, Model)
    return doc
  }
  
  get isPaused() {
    return this.state.get('paused')
  }
  
  pause() {
    this.state.set('paused', true)
  }

  unpause() {
    this.state.set('paused', false)
  }
  
  resume() {
    this.unpause()
  }
  
  get isRunning() {
    return this.state.get('running')
  }

  /** Run one scheduler cycle: reload docs, check due tasks, and execute any that are ready */
  async tick() {
    if (this.isPaused) {
      return
    }
    // Re-scan docs so newly created/changed documents are picked up
    const docs = (this.container as any).docs
    await docs.reload()
    await this.loadTasks()
    const { tasks } = this
    const dueOneOff = this.dueOneOffTasks
    const dueScheduled = this.dueScheduledTasks
    const inProgress = [...this._inProgress]

    this.emit('tick', {
      totalTasks: tasks.length,
      dueOneOff: dueOneOff.length,
      dueScheduled: dueScheduled.length,
      inProgress: inProgress.length,
      dueIds: [...dueOneOff, ...dueScheduled].map((t) => t.id),
      inProgressIds: inProgress,
    })

    for (const task of tasks) {
      if (this._inProgress.has(task.id)) {
        continue
      }
      if (this._isDue(task)) {
        try {
          await this.execute(task.id)
        } catch (err) {
          this.emit('taskFailed', task.id, err)
        }
      }
    }
  }

  /** Check whether a task is due for execution based on its schedule and last run time */
  isDue(task: TaskEntry): boolean {
    return this._isDue(task)
  }

  private _isDue(task: TaskEntry): boolean {
    // One-time tasks that haven't run yet — always due
    if (!task.repeatable && !task.lastRanAt) return true

    // One-time tasks that already ran — never due again
    if (!task.repeatable && task.lastRanAt) return false

    // Repeatable tasks need a schedule
    if (!task.schedule) return false

    // Never run before — due immediately
    if (!task.lastRanAt) return true

    // Check if enough time has passed since last run
    const elapsed = Date.now() - task.lastRanAt
    const interval = this._scheduleToMs(task.schedule)

    return elapsed >= interval
  }

  /** Convert a human-readable schedule string (e.g. 'hourly', 'daily', '4pm') to milliseconds */
  scheduleToMs(schedule: string): number {
    return this._scheduleToMs(schedule)
  }

  private _scheduleToMs(schedule: string): number {
    switch (schedule) {
      case 'every-five-minutes':
        return 5 * 60 * 1000
      case 'every-ten-minutes':
        return 10 * 60 * 1000
      case 'every-half-hour':
        return 30 * 60 * 1000
      case 'hourly':
        return 60 * 60 * 1000
      case 'daily':
      case 'beginning-of-day':
      case 'end-of-day':
        return 24 * 60 * 60 * 1000
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000
      default: {
        // Time-of-day schedules like "4pm" — treat as daily interval
        const timeMatch = schedule.match(/^(\d{1,2})(am|pm)$/i)
        if (timeMatch) return 24 * 60 * 60 * 1000
        return 24 * 60 * 60 * 1000
      }
    }
  }

  /** Evaluate condition code blocks from the task document; returns false if any condition fails */
  async checkConditions(taskId: string): Promise<boolean> {
    try {
      const model = await this.loadTaskModel(taskId)
      const conditions = model?.sections?.conditions

      if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
        return true
      }

      const vm = this.container.feature('vm')
      const ui = this.container.feature('ui')

      for (const block of conditions) {
        const code = block.value ?? block
        if (typeof code !== 'string' || !code.trim()) continue

        const hasTopLevelAwait = /\bawait\b/.test(code)
        const wrapped = hasTopLevelAwait ? `(async function() { ${code} })()` : code
        const result = await vm.run(wrapped, { container: this.container, ui })
        if (result === false) return false
      }

      return true
    } catch (err) {
      this.emit('conditionError', taskId, err)
      return false
    }
  }

  /** Execute a task by ID, managing in-progress state, condition checks, and document metadata updates */
  async execute(taskId: string): Promise<{ success: boolean; durationMs: number; skipped?: boolean }> {
    const tasks = this.state.get('tasks') as TaskEntry[]
    const task = tasks.find((t) => t.id === taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    if (this._inProgress.has(taskId) || task.running) {
      this.emit('taskSkipped', taskId, { reason: 'already in progress', task })
      return { success: true, durationMs: 0, skipped: true }
    }

    // Check conditions before executing
    const conditionsMet = await this.checkConditions(taskId)
    if (!conditionsMet) {
      this.emit('taskSkipped', taskId, { reason: 'conditions not met', task })
      return { success: true, durationMs: 0, skipped: true }
    }

    this._inProgress.add(taskId)
    this.state.set('currentTask', taskId)

    // Persist running: true to the document so other processes won't pick it up
    await this._updateTaskMeta(taskId, { running: true })

    this.emit('taskStarted', taskId, task)

    const startTime = Date.now()

    try {
      if (this.options.onExecute) {
        await this.options.onExecute(task)
      } else {
        const proc = this.container.feature('proc')
        const outFile = `tmp/agentic-loop/${taskId.replace(/\//g, '--')}.md`
        const result = await proc.execAndCapture(`luca prompt ${task.agent} ${taskId} --out-file ${outFile} --chrome`)
        if (result.exitCode !== 0) {
          throw new Error(result.stderr || `luca prompt exited with code ${result.exitCode}`)
        }
      }

      const now = Date.now()
      const durationMs = now - startTime

      // Update in-memory state
      const updated = tasks.map((t) =>
        t.id === taskId ? { ...t, lastRanAt: now, running: false } : t
      )
      this.state.set('tasks', updated)

      // Persist lastRanAt and clear running flag
      await this._updateTaskMeta(taskId, { lastRanAt: now, running: false })

      this.emit('taskCompleted', taskId)
      return { success: true, durationMs }
    } catch (err) {
      const durationMs = Date.now() - startTime

      // Clear running flag on failure
      const updated = (this.state.get('tasks') as TaskEntry[]).map((t) =>
        t.id === taskId ? { ...t, running: false } : t
      )
      this.state.set('tasks', updated)
      await this._updateTaskMeta(taskId, { running: false }).catch(() => {})

      this.emit('taskFailed', taskId, err)
      return { success: false, durationMs }
    } finally {
      this._inProgress.delete(taskId)
      this.state.set('currentTask', undefined)
    }
  }

  private async _updateTaskMeta(taskId: string, updates: Record<string, any>) {
    const docs = (this.container as any).docs
    const doc = docs.collection.document(taskId)
    if (!doc?.meta) return
    Object.assign(doc.meta, updates)
    await doc.save()
  }
}

export default features.register('taskScheduler', TaskScheduler)
