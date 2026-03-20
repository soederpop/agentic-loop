import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import type { TaskEntry } from '../features/task-scheduler'

export const description =
  'Run the Agentic Loop task scheduler as a long-running process. Discovers and executes one-off and scheduled tasks on a configurable interval.'

export const argsSchema = CommandOptionsSchema.extend({
  interval: z
    .number()
    .default(1)
    .describe('Polling interval in minutes for scheduled tasks'),
  once: z
    .boolean()
    .default(false)
    .describe('Run a single discovery/execution cycle and exit'),
  concurrencyOneOff: z
    .number()
    .default(4)
    .describe('Max concurrent one-off tasks'),
  concurrencyScheduled: z
    .number()
    .default(2)
    .describe('Max concurrent scheduled tasks'),
  dryRun: z
    .boolean()
    .default(false)
    .describe('Print what would run without executing'),
  logDir: z
    .string()
    .optional()
    .describe('Directory to write luca-agentic-loop.out.log and .err.log (mimics launchd log capture)'),
  docsPath: z
    .string()
    .default('./docs')
    .describe('Path to the docs folder containing contentbase models'),
})

type AgenticLoopOptions = z.infer<typeof argsSchema>

const MAIN_PREFIX_NAME = 'agentic-loop'
const MAX_PREFIX_WIDTH = 24

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const remainder = s % 60
  return `${m}m ${remainder}s`
}

/** Derive short display name from a task id like "tasks/daily-review" -> "daily-review" */
function taskLabel(task: TaskEntry): string {
  return task.id.split('/').pop() || task.id
}

function getTaskCommand(task: TaskEntry, outDir: string): string[] {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13) // e.g. 20260304-0147
  const outFile = `${outDir}/${task.id.replace(/\//g, '--')}-${ts}.md`
  return ['prompt', task.agent, task.id, '--out-file', outFile, '--permission-mode', 'bypassPermissions', '--exclude-sections', 'Only When,Only If,Run Condition,Conditions', '--chrome']
}

async function handler(options: AgenticLoopOptions, context: ContainerContext) {
  const { container } = context as any
  const ui = container.feature('ui')
  const proc = container.feature('proc')
  const fs = container.feature('fs')

  await container.helpers.discover('features')

  // --- Output directory for prompt results ---
  const outDir = container.paths.resolve('logs/prompt-outputs')
  fs.ensureFolder(outDir)

  // --- Log file writers (when --log-dir is set) ---
  let outWriter: ReturnType<ReturnType<typeof Bun.file>['writer']> | null = null
  let errWriter: ReturnType<ReturnType<typeof Bun.file>['writer']> | null = null

  if (options.logDir) {
    const logDir = container.paths.resolve(options.logDir)
    fs.ensureFolder(logDir)
    outWriter = Bun.file(`${logDir}/luca-agentic-loop.out.log`).writer()
    errWriter = Bun.file(`${logDir}/luca-agentic-loop.err.log`).writer()
  }

  function timestamp() {
    return new Date().toISOString()
  }

  // --- Prefix logging system ---
  let prefixWidth = MAIN_PREFIX_NAME.length

  function computePrefixWidth(tasks: TaskEntry[]) {
    const allNames = [MAIN_PREFIX_NAME, ...tasks.map(taskLabel)]
    prefixWidth = Math.min(MAX_PREFIX_WIDTH, Math.max(...allNames.map((n) => n.length)))
  }

  function makePrefix(name: string): string {
    const truncated = name.length > prefixWidth ? name.slice(0, prefixWidth - 1) + '~' : name
    const padded = truncated.padEnd(prefixWidth)
    const colorFn = ui.assignColor(name)
    return colorFn(`[${padded}]`)
  }

  function log(prefix: string, ...args: any[]) {
    console.log(prefix, ...args)
    if (outWriter) {
      const msg = [prefix, ...args].map(String).join(' ')
      outWriter.write(`[${timestamp()}] ${msg}\n`)
      outWriter.flush()
    }
  }

  function logError(...args: any[]) {
    console.error(...args)
    if (errWriter) {
      const msg = args.map(String).join(' ')
      errWriter.write(`[${timestamp()}] ${msg}\n`)
      errWriter.flush()
    }
  }

  function mainLog(...args: any[]) {
    log(makePrefix(MAIN_PREFIX_NAME), ...args)
  }

  // --- Lockfile: single instance ---
  proc.establishLock('tmp/luca-agentic-loop.pid')

  // --- Project build tracking ---
  const projectBuildsInProgress = new Set<string>()

  async function buildApprovedProjects() {
    await container.docs.collection.load({ refresh: true })
    const { Project } = container.docs.models

    const approved = await container.docs.query(Project).where('meta.status', 'approved').fetchAll()

    if (approved.length === 0) return

    for (const project of approved) {
      const slug = project.id.replace(/^projects\//, '')

      if (projectBuildsInProgress.has(slug)) {
        mainLog(`project "${slug}" already building, skipping`)
        continue
      }

      projectBuildsInProgress.add(slug)
      mainLog(`building approved project: ${slug}`)

      const prefix = makePrefix(slug)

      // Run build async so it doesn't block the tick
      ;(async () => {
        try {
          await container.helpers.discover('features')
          const builder = container.feature('projectBuilder', {
            projectSlug: slug,
            docsPath: options.docsPath || './docs',
          })

          await builder.load()

          if (!builder.project) {
            log(prefix, `failed to load project`)
            return
          }

          const pending = builder.plans.filter((p: any) => p.status !== 'completed')
          if (pending.length === 0) {
            log(prefix, `all plans already completed`)
            return
          }

          log(prefix, `${pending.length} pending plan(s)`)

          builder.on('plan:start', (data: any) => {
            const plan = builder.plans.find((p: any) => p.id === data.planId)
            log(prefix, `plan started: ${plan?.title || data.planId}`)
          })

          builder.on('plan:delta', (data: any) => {
            for (const line of data.text.split('\n')) {
              if (line.trim()) log(prefix, line)
            }
          })

          builder.on('plan:complete', (data: any) => {
            const plan = builder.plans.find((p: any) => p.id === data.planId)
            const cost = data.costUsd != null ? `$${data.costUsd.toFixed(4)}` : ''
            const turns = data.turns != null ? `${data.turns} turns` : ''
            const stats = [cost, turns].filter(Boolean).join(' | ')
            log(prefix, `plan done: ${plan?.title || data.planId} (${stats})`)
          })

          builder.on('plan:error', (data: any) => {
            const plan = builder.plans.find((p: any) => p.id === data.planId)
            log(prefix, `plan FAILED: ${plan?.title || data.planId}: ${data.error || 'unknown'}`)
          })

          builder.on('build:complete', (data: any) => {
            const cost = data.totalCost != null ? `$${data.totalCost.toFixed(4)}` : ''
            log(prefix, `build complete${cost ? ` (total: ${cost})` : ''}`)
          })

          builder.on('build:error', (data: any) => {
            log(prefix, `build FAILED at ${data.failedPlanId}: ${data.error || 'unknown'}`)
          })

          await builder.run()
        } catch (err: any) {
          log(prefix, `build error: ${err?.message || err}`)
          logError(`[${slug}] ${err?.message || err}`)
        } finally {
          projectBuildsInProgress.delete(slug)
          // Refresh docs so the scheduler sees updated statuses
          await container.docs.collection.load({ refresh: true })
        }
      })()
    }
  }

  // --- Initialize scheduler with custom executor ---
  const scheduler = container.feature('taskScheduler', {
    tickInterval: options.interval * 60 * 1000,
    onExecute: async (task: TaskEntry) => {
      const args = getTaskCommand(task, outDir)
      const prefix = makePrefix(taskLabel(task))

      log(prefix, `$ luca ${args.join(' ')}`)

      const result = await proc.spawnAndCapture('luca', args, {
        onOutput: (data: string) => {
          for (const line of data.split('\n')) {
            if (line) log(prefix, line)
          }
        },
        onError: (data: string) => {
          for (const line of data.split('\n')) {
            if (line) {
              log(prefix, `[stderr] ${line}`)
              logError(`[${taskLabel(task)}] ${line}`)
            }
          }
        },
      })

      if (result.exitCode !== 0) {
        throw new Error(
          result.stderr || `luca prompt exited with code ${result.exitCode}`,
        )
      }
    },
  })

  await container.docs.load()
  await scheduler.loadTasks()

  const { tasks } = scheduler
  computePrefixWidth(tasks)

  mainLog(`Agentic Loop started (pid ${process.pid})`)
  mainLog(`Interval:    ${options.interval} minutes`)
  mainLog(`Concurrency: one-off=${options.concurrencyOneOff}, scheduled=${options.concurrencyScheduled}`)
  mainLog(`Tasks loaded: ${tasks.length}`)
  mainLog(`Output dir:  ${outDir}`)
  if (options.logDir) {
    const logDir = container.paths.resolve(options.logDir)
    mainLog(`Log dir:     ${logDir}`)
  }

  for (const t of tasks) {
    const args = getTaskCommand(t, outDir)
    const status = t.lastRanAt
      ? `last ran ${formatDuration(Date.now() - t.lastRanAt)} ago`
      : 'never ran'
    mainLog(`  ${taskLabel(t)} -> luca ${args.join(' ')} (${status})`)
  }

  mainLog('')

  // --- Wire up event logging ---
  scheduler.on('taskStarted', (taskId: string) => {
    const label = taskId.split('/').pop() || taskId
    log(makePrefix(label), `started`)
  })

  scheduler.on('taskCompleted', (taskId: string) => {
    const label = taskId.split('/').pop() || taskId
    log(makePrefix(label), `completed`)
    container.docs.collection.load({ refresh: true })
  })

  scheduler.on('taskFailed', (taskId: string, err: any) => {
    const label = taskId.split('/').pop() || taskId
    log(makePrefix(label), `FAILED: ${err?.message || err}`)
    container.docs.collection.load({ refresh: true })
  })

  // --- Cycle function ---
  async function cycle(): Promise<{
    oneOffStarted: number
    scheduledStarted: number
    failed: boolean
  }> {
    await container.docs.collection.load({ refresh: true })
    await scheduler.loadTasks()
    computePrefixWidth(scheduler.tasks)

    const oneOffs = scheduler.dueOneOffTasks
    const scheduled = scheduler.dueScheduledTasks

    mainLog(
      `Tick — one-off: ${oneOffs.length} due, scheduled: ${scheduled.length} due, in-progress: ${scheduler.inProgressIds.length}`,
    )

    if (!oneOffs.length && !scheduled.length) {
      mainLog(`Nothing to run.`)
      return { oneOffStarted: 0, scheduledStarted: 0, failed: false }
    }

    let failed = false

    // Pre-filter by conditions so skipped tasks don't consume concurrency slots
    const oneOffBatch: typeof oneOffs = []
    let oneOffChecked = 0
    for (const task of oneOffs) {
      if (oneOffBatch.length >= options.concurrencyOneOff) break
      oneOffChecked++
      const ok = await scheduler.checkConditions(task.id)
      if (!ok) {
        log(makePrefix(taskLabel(task)), `skipped (conditions not met)`)
        continue
      }
      oneOffBatch.push(task)
    }
    const scheduledBatch: typeof scheduled = []
    let scheduledChecked = 0
    for (const task of scheduled) {
      if (scheduledBatch.length >= options.concurrencyScheduled) break
      scheduledChecked++
      const ok = await scheduler.checkConditions(task.id)
      if (!ok) {
        log(makePrefix(taskLabel(task)), `skipped (conditions not met)`)
        continue
      }
      scheduledBatch.push(task)
    }
    const allBatch = [...oneOffBatch, ...scheduledBatch]

    for (const task of oneOffBatch) {
      mainLog(`queuing one-off: ${taskLabel(task)}`)
    }
    for (const task of scheduledBatch) {
      mainLog(`queuing scheduled: ${taskLabel(task)} (schedule: ${task.schedule})`)
    }

    // Run all tasks concurrently, each streaming with its own prefix
    const promises = allBatch.map((task) =>
      scheduler.execute(task.id).then(
        (result: { success: boolean; durationMs: number; skipped?: boolean }) => {
          if (result.skipped) return
          if (!result.success) failed = true
          const label = taskLabel(task)
          log(
            makePrefix(label),
            `${result.success ? 'done' : 'fail'} (${formatDuration(result.durationMs)})`,
          )
        },
        (err: any) => {
          failed = true
          const label = taskLabel(task)
          log(makePrefix(label), `error: ${err?.message || err}`)
        },
      ),
    )

    await Promise.all(promises)

    const oneOffDeferred = oneOffs.length - oneOffChecked
    const scheduledDeferred = scheduled.length - scheduledChecked
    if (oneOffDeferred > 0) {
      mainLog(
        `${oneOffDeferred} one-off task(s) deferred (concurrency limit)`,
      )
    }
    if (scheduledDeferred > 0) {
      mainLog(
        `${scheduledDeferred} scheduled task(s) deferred (concurrency limit)`,
      )
    }

    // Build any approved projects (runs async, doesn't block the tick)
    await buildApprovedProjects()

    mainLog(`Tick complete.`)
    mainLog('')

    return {
      oneOffStarted: oneOffBatch.length,
      scheduledStarted: scheduledBatch.length,
      failed,
    }
  }

  // --- Dry run mode ---
  if (options.dryRun) {
    const oneOffs = scheduler.dueOneOffTasks
    const scheduled = scheduler.dueScheduledTasks

    mainLog(`Dry run — would execute:`)
    mainLog('')

    if (oneOffs.length) {
      mainLog(`One-off tasks (${oneOffs.length}):`)
      for (const t of oneOffs) {
        const args = getTaskCommand(t, outDir)
        mainLog(`  ${taskLabel(t)}`)
        mainLog(`    cmd: luca ${args.join(' ')}`)
      }
    } else {
      mainLog(`One-off tasks: none due`)
    }

    mainLog('')

    if (scheduled.length) {
      mainLog(`Scheduled tasks (${scheduled.length}):`)
      for (const t of scheduled) {
        const lastRun = t.lastRanAt
          ? `last ran ${formatDuration(Date.now() - t.lastRanAt)} ago`
          : 'never ran'
        const args = getTaskCommand(t, outDir)
        mainLog(`  ${taskLabel(t)} (schedule: ${t.schedule}, ${lastRun})`)
        mainLog(`    cmd: luca ${args.join(' ')}`)
      }
    } else {
      mainLog(`Scheduled tasks: none due`)
    }

    mainLog('')
    return
  }

  // --- Once mode ---
  if (options.once) {
    try {
      const result = await cycle()
      if (result.failed) {
        process.exit(1)
      }
    } catch (err: any) {
      mainLog(`Cycle error: ${err?.message || err}`)
      logError(err)
      process.exit(1)
    }
    return
  }

  // --- Daemon mode ---
  try {
    await cycle()
  } catch (err: any) {
    mainLog(`First cycle error: ${err?.message || err}`)
    logError(err)
  }

  const intervalMs = options.interval * 60 * 1000
  const timer = setInterval(async () => {
    try {
      await cycle()
    } catch (err: any) {
      mainLog(`Cycle error: ${err?.message || err}`)
      logError(err)
    }
  }, intervalMs)

  // Graceful shutdown
  function shutdown(signal: string) {
    mainLog('')
    mainLog(`Received ${signal}. Shutting down...`)
    clearInterval(timer)
    scheduler.stop()

    const inProgress = scheduler.inProgressIds
    if (inProgress.length) {
      mainLog(
        `${inProgress.length} task(s) still in progress: ${inProgress.join(', ')}`,
      )
      mainLog(`Waiting for completion is not implemented — exiting now.`)
    }

    mainLog('Agentic Loop stopped. Goodbye.')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Status on SIGUSR1
  process.on('SIGUSR1', () => {
    mainLog('')
    mainLog(`Agentic Loop Status:`)
    mainLog(`  Running: ${scheduler.state.get('running')}`)
    mainLog(`  Total tasks: ${scheduler.taskCount}`)
    mainLog(`  Due one-off: ${scheduler.dueOneOffTasks.length}`)
    mainLog(`  Due scheduled: ${scheduler.dueScheduledTasks.length}`)
    mainLog(`  In progress: ${scheduler.inProgressIds.join(', ') || 'none'}`)
    mainLog(`  Projects building: ${[...projectBuildsInProgress].join(', ') || 'none'}`)
    mainLog('')
  })

  mainLog(`Agentic Loop running. Next tick in ${options.interval} minutes.`)
  mainLog(`Send SIGUSR1 (kill -USR1 ${process.pid}) for status.`)
  mainLog('')

  // Keep the process alive forever
  await new Promise(() => {})
}

export default {
  description,
  argsSchema,
  handler,
}
