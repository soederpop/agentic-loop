/**
 * luca task-scheduler — Standalone or embedded task scheduler for the Agentic Loop.
 *
 * Runs one-off and scheduled tasks in two independent concurrency pools.
 * Can be run standalone (`luca task-scheduler`) or as part of `luca main`.
 */

import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import type { TaskEntry } from '../features/task-scheduler'

export const description =
  'Run the Agentic Loop task scheduler. Discovers and executes one-off and scheduled tasks on a configurable interval.'

export const argsSchema = z.object({
  interval: z.number().default(15).describe('Minutes between scheduler ticks'),
  once: z.boolean().default(false).describe('Run a single cycle and exit'),
  concurrencyOneOff: z.number().default(2).describe('Max concurrent one-off tasks'),
  concurrencyScheduled: z.number().default(2).describe('Max concurrent scheduled tasks'),
  dryRun: z.boolean().default(false).describe('Print what would run without executing'),
})

type Options = z.infer<typeof argsSchema>

const LOCK_FILE = 'tmp/luca-task-scheduler.pid'

// ── Reusable Task Scheduler Service ─────────────────────────────────────────

export interface TaskSchedulerHooks {
  log?: (source: string, message: string) => void
  recordEvent?: (source: string, event: string, data?: any) => void
}

export interface TaskSchedulerOptions {
  interval?: number
  concurrencyOneOff?: number
  concurrencyScheduled?: number
  dryRun?: boolean
}

/**
 * Starts the task scheduler service.
 *
 * Returns the scheduler feature instance and a stop() function.
 * Can be called from the standalone `luca task-scheduler` command or from `luca main`.
 */
export async function startTaskScheduler(
  container: any,
  opts: TaskSchedulerOptions = {},
  hooks: TaskSchedulerHooks = {},
) {
  const log = hooks.log ?? ((source: string, msg: string) => console.log(`[${source}] ${msg}`))
  const recordEvent = hooks.recordEvent ?? (() => {})

  const ui = container.feature('ui')
  const proc = container.feature('proc')
  const fs = container.feature('fs')

  const interval = opts.interval ?? 15
  const concurrencyOneOff = opts.concurrencyOneOff ?? 2
  const concurrencyScheduled = opts.concurrencyScheduled ?? 2
  const dryRun = opts.dryRun ?? false

  // --- Ensure output directories ---
  const outDir = container.paths.resolve('logs', 'prompt-outputs')
  fs.ensureFolder(outDir)

  // --- Build the task command ---
  function getTaskCommand(task: TaskEntry): string[] {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13)
    const outFile = `${outDir}/${task.id.replace(/\//g, '--')}-${ts}.md`
    return [
      'prompt', task.agent, task.id,
      '--out-file', outFile,
      '--permission-mode', 'bypassPermissions',
      '--exclude-sections', 'Only When,Only If,Run Condition,Conditions',
      '--chrome',
    ]
  }

  // --- Initialize scheduler feature ---
  await container.helpers.discover('features')
  await container.docs.load()

  const scheduler = container.feature('taskScheduler', {
    tickInterval: interval * 60 * 1000,
    onExecute: async (task: TaskEntry) => {
      const args = getTaskCommand(task)
      const label = task.id.split('/').pop() || task.id
      log(label, `$ luca ${args.join(' ')}`)

      const result = await proc.spawnAndCapture('luca', args, {
        onOutput: (data: string) => {
          for (const line of data.split('\n')) {
            if (line) log(label, line)
          }
        },
        onError: (data: string) => {
          for (const line of data.split('\n')) {
            if (line) log(label, `[stderr] ${line}`)
          }
        },
      })

      if (result.exitCode !== 0) {
        throw new Error(result.stderr || `luca prompt exited with code ${result.exitCode}`)
      }
    },
  })

  // Wire up scheduler events
  scheduler.on('taskStarted', (taskId: string) => {
    log('scheduler', `started: ${taskId}`)
    recordEvent('scheduler', 'taskStarted', { taskId })
  })
  scheduler.on('taskSkipped', (taskId: string, info: any) => {
    log('scheduler', `skipped: ${taskId} (${info?.reason || 'unknown'})`)
    recordEvent('scheduler', 'taskSkipped', { taskId, reason: info?.reason })
  })
  scheduler.on('conditionError', (taskId: string, err: any) => {
    log('scheduler', `condition error: ${taskId}: ${err?.message || err}`)
    recordEvent('scheduler', 'conditionError', { taskId, error: err?.message })
  })
  scheduler.on('taskCompleted', async (taskId: string) => {
    log('scheduler', ui.colors.green(`completed: ${taskId}`))
    recordEvent('scheduler', 'taskCompleted', { taskId })
    await container.docs.collection.load({ refresh: true })
  })
  scheduler.on('taskFailed', async (taskId: string, err: any) => {
    log('scheduler', ui.colors.red(`FAILED: ${taskId}: ${err?.message || err}`))
    recordEvent('scheduler', 'taskFailed', { taskId, error: err?.message })
    await container.docs.collection.load({ refresh: true })
  })

  // --- Load tasks and print inventory ---
  await scheduler.loadTasks()

  function timeSince(ms: number): string {
    const diff = Date.now() - ms
    const secs = Math.floor(diff / 1000)
    if (secs < 60) return `${secs}s ago`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ${mins % 60}m ago`
  }

  const loadedTasks = scheduler.tasks
  log('scheduler', `${loadedTasks.length} tasks loaded:`)
  for (const t of loadedTasks) {
    const sched = t.schedule || (t.repeatable ? 'no schedule' : 'one-off')
    const lastRan = t.lastRanAt ? `last ran ${timeSince(t.lastRanAt)}` : 'never ran'
    const due = scheduler.isDue(t) ? ui.colors.green('DUE') : ui.colors.gray('waiting')
    log('scheduler', `  ${due} ${t.id} [${sched}, ${lastRan}]`)
  }

  // --- Run a single cycle with two-queue concurrency ---
  async function runCycle(): Promise<{ oneOffRan: number; scheduledRan: number; failures: number }> {
    const cycleStart = Date.now()
    log('cycle', ui.colors.cyan('--- tick start ---'))

    // Reload docs and tasks so newly created/changed documents are picked up
    await container.docs.reload()
    await scheduler.loadTasks()

    const dueOneOff = scheduler.dueOneOffTasks
    const dueScheduled = scheduler.dueScheduledTasks

    log('cycle', `discovered: ${dueOneOff.length} one-off, ${dueScheduled.length} scheduled, ${scheduler.inProgressIds.length} in-progress`)
    recordEvent('scheduler', 'tick', {
      dueOneOff: dueOneOff.length,
      dueScheduled: dueScheduled.length,
      inProgress: scheduler.inProgressIds.length,
      totalTasks: scheduler.tasks.length,
    })

    if (dryRun) {
      if (dueOneOff.length > 0) {
        log('dry-run', 'Would execute one-off tasks:')
        for (const t of dueOneOff) log('dry-run', `  ${t.id} [agent: ${t.agent}]`)
      }
      if (dueScheduled.length > 0) {
        log('dry-run', 'Would execute scheduled tasks:')
        for (const t of dueScheduled) {
          log('dry-run', `  ${t.id} [schedule: ${t.schedule}, agent: ${t.agent}]`)
        }
      }
      if (dueOneOff.length === 0 && dueScheduled.length === 0) {
        log('dry-run', 'Nothing to run.')
      }
      return { oneOffRan: 0, scheduledRan: 0, failures: 0 }
    }

    let failures = 0

    async function runPool(tasks: TaskEntry[], concurrency: number, label: string): Promise<number> {
      if (tasks.length === 0) return 0

      const toRun = tasks.slice(0, concurrency)
      const deferred = tasks.length - toRun.length

      if (deferred > 0) {
        log(label, `running ${toRun.length}/${tasks.length} (${deferred} deferred to next cycle)`)
      }

      const promises = toRun.map(async (task) => {
        const start = Date.now()
        try {
          const result = await scheduler.execute(task.id)
          const dur = ((Date.now() - start) / 1000).toFixed(1)
          if (result.skipped) {
            log(label, ui.colors.yellow(`${task.id} skipped (${dur}s)`))
          } else if (result.success) {
            log(label, ui.colors.green(`${task.id} completed (${dur}s)`))
          } else {
            log(label, ui.colors.red(`${task.id} failed (${dur}s)`))
            failures++
          }
        } catch (err: any) {
          const dur = ((Date.now() - start) / 1000).toFixed(1)
          log(label, ui.colors.red(`${task.id} error (${dur}s): ${err?.message || err}`))
          failures++
        }
      })

      await Promise.all(promises)
      return toRun.length
    }

    const oneOffRan = await runPool(dueOneOff, concurrencyOneOff, 'one-off')
    const scheduledRan = await runPool(dueScheduled, concurrencyScheduled, 'scheduled')

    const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1)
    log('cycle', ui.colors.cyan(`--- tick end (${elapsed}s) — ran ${oneOffRan} one-off, ${scheduledRan} scheduled, ${failures} failure(s) ---`))

    return { oneOffRan, scheduledRan, failures }
  }

  log('scheduler', `interval: ${interval}m | one-off concurrency: ${concurrencyOneOff} | scheduled concurrency: ${concurrencyScheduled}`)

  // Run first tick immediately
  await runCycle()

  // Start the interval loop
  const timer = setInterval(async () => {
    try {
      await runCycle()
    } catch (err: any) {
      log('scheduler', ui.colors.red(`Cycle error: ${err?.message || err}`))
    }
  }, interval * 60 * 1000)

  log('scheduler', `Next tick in ${interval}m.`)

  // Return the scheduler instance + stop handle
  return {
    scheduler,
    runCycle,
    stop() {
      clearInterval(timer)
    },
  }
}

// ── CLI Command (standalone) ────────────────────────────────────────────────

export default async function taskScheduler(options: Options, context: ContainerContext) {
  const container = (context as any).container
  const ui = container.feature('ui')
  const fs = container.feature('fs')
  const proc = container.feature('proc')

  // --- Load config.yml overrides ---
  const yaml = container.feature('yaml')
  const configPath = container.paths.resolve('config.yml')
  if (fs.exists(configPath)) {
    try {
      const config = yaml.parse(String(fs.readFile(configPath))) || {}
      const sched = config.scheduler || {}
      const argv = process.argv.join(' ')
      const wasExplicit = (flag: string) => {
        const kebab = flag.replace(/[A-Z]/g, (c: string) => `-${c.toLowerCase()}`)
        return argv.includes(`--${flag}`) || argv.includes(`--${kebab}`)
      }
      if (sched.concurrencyOneOff != null && !wasExplicit('concurrencyOneOff')) options.concurrencyOneOff = sched.concurrencyOneOff
      if (sched.concurrencyScheduled != null && !wasExplicit('concurrencyScheduled')) options.concurrencyScheduled = sched.concurrencyScheduled
      if (sched.taskInterval != null && !wasExplicit('interval')) options.interval = sched.taskInterval
    } catch (err: any) {
      console.warn(`Warning: failed to parse config.yml: ${err?.message || err}`)
    }
  }

  // --- Single-instance lockfile ---
  const lockPath = container.paths.resolve(LOCK_FILE)
  fs.ensureFolder(container.paths.resolve('tmp'))

  if (fs.exists(lockPath)) {
    const existingPid = String(fs.readFile(lockPath)).trim()
    try {
      process.kill(Number(existingPid), 0)
      console.log(ui.colors.red(`Another instance is already running (PID ${existingPid}). Exiting.`))
      process.exit(1)
    } catch {
      console.log(ui.colors.yellow(`Removing stale lockfile (PID ${existingPid} is gone)`))
    }
  }

  fs.writeFile(lockPath, String(process.pid))
  function removeLock() {
    try { fs.rm(lockPath) } catch {}
  }

  // --- Banner ---
  const log = (source: string, ...args: any[]) => {
    const ts = new Date().toISOString().slice(11, 19)
    console.log(`${ui.colors.gray(ts)} ${ui.assignColor(source)(`[${source}]`)}`, ...args)
  }

  log('task-scheduler', ui.colors.bold('Agentic Loop Task Scheduler'))
  log('task-scheduler', `PID: ${process.pid}`)
  if (options.once) log('task-scheduler', ui.colors.yellow('--once mode: will run a single cycle and exit'))
  if (options.dryRun) log('task-scheduler', ui.colors.yellow('--dry-run mode: no tasks will be executed'))

  // --- Single cycle / dry-run: run once and exit ---
  if (options.once || options.dryRun) {
    const svc = await startTaskScheduler(container, {
      ...options,
      interval: options.interval,
    }, {
      log: (source, msg) => log(source, msg),
    })
    svc.stop() // don't keep the interval running
    removeLock()
    process.exit(0)
  }

  // --- Long-running mode ---
  const svc = await startTaskScheduler(container, {
    interval: options.interval,
    concurrencyOneOff: options.concurrencyOneOff,
    concurrencyScheduled: options.concurrencyScheduled,
  }, {
    log: (source, msg) => log(source, msg),
  })

  log('task-scheduler', `Press Ctrl+C to stop.`)

  function shutdown(signal: string) {
    log('task-scheduler', `Shutting down (${signal})...`)
    svc.stop()
    removeLock()
    log('task-scheduler', 'Goodbye.')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  await new Promise(() => {})
}
