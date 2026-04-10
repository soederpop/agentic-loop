import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({
  docsPath: z.string().default('./docs').describe('Path to the docs folder containing contentbase models'),
  ui: z.boolean().default(false).describe('Launch interactive terminal UI instead of log output'),
  dryRun: z.boolean().default(false).describe('Load and report the build plan without executing anything'),
})

async function projectBuilder(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context as any
  let slug = options._?.[1]
  const ui = container.feature('ui')

  if (!slug) {
    ui.print(ui.colors.red('Usage: luca project-builder <project-slug>'))
    process.exit(1)
  }

  slug = slug.split(/\/|\\/).pop().replace(/\.md$/,'')

  await container.helpers.discover('features')

  slug = `${slug}`.replace(/^undefined$/,'').replace(/^docs\//,'').replace(/^projects\//,'').replace(/\.md$/,'')

  if (!slug) {
    ui.print(ui.colors.red('Usage: luca project-builder <project-slug>'))
    process.exit(1)
  }

  if (options.dryRun) {
    return runDryRun(container, slug, options, ui)
  }

  if (options.ui) {
    return runInteractiveUI(container, slug, options)
  }

  return runHeadless(container, slug, options, ui)
}

async function runDryRun(container: any, slug: string, options: z.infer<typeof argsSchema>, ui: any) {
  const { colors } = ui
  const log = (msg: string) => ui.print(msg)
  const dim = (msg: string) => colors.gray(msg)
  const bold = (msg: string) => colors.bold(msg)

  const builder = container.feature('projectBuilder', {
    projectSlug: slug,
    docsPath: options.docsPath,
  })

  await builder.load()

  if (!builder.project) {
    log(colors.red(`Project "${slug}" not found`))
    process.exit(1)
  }

  log('')
  log(bold(`${builder.project.title}`) + dim(` (${slug})`))
  log(dim(`Status: ${builder.project.status}`))
  log(dim(`Plans: ${builder.plans.length} total`))
  log('')

  const pending = builder.plans.filter((p: any) => p.status !== 'completed')
  const completed = builder.plans.filter((p: any) => p.status === 'completed')

  if (completed.length > 0) {
    log(dim(`── Completed (${completed.length}) ──`))
    for (const plan of completed) {
      const stats = [
        plan.costUsd != null ? `$${plan.costUsd.toFixed(4)}` : null,
        plan.turns != null ? `${plan.turns} turns` : null,
        plan.toolCalls != null ? `${plan.toolCalls} tool calls` : null,
      ].filter(Boolean).join(' | ')
      log(`  ${colors.green('✓')} ${plan.title}` + (stats ? dim(` (${stats})`) : ''))
    }
    log('')
  }

  if (pending.length === 0) {
    log(colors.green('All plans already completed — nothing to build.'))
    return
  }

  log(dim(`── Pending (${pending.length}) ──`))
  for (const plan of pending) {
    const statusColor = plan.status === 'approved' ? colors.cyan : colors.yellow
    log(`  ${statusColor('○')} ${plan.title}` + dim(` [${plan.status}]`))

    if (plan.agentOptions && Object.keys(plan.agentOptions).length > 0) {
      log(dim(`    agentOptions:`))
      for (const [key, value] of Object.entries(plan.agentOptions)) {
        const display = Array.isArray(value) ? value.join(', ') : String(value)
        log(dim(`      ${key}: `) + display)
      }
    }
  }

  log('')
  log(dim(`Run without --dryRun to execute.`))
}

async function runInteractiveUI(container: any, slug: string, options: z.infer<typeof argsSchema>) {
  const builder = container.feature('projectBuilder', {
    projectSlug: slug,
    docsPath: options.docsPath,
  })

  await builder.startServer()

  try {
    const { default: runApp } = await import('./project-builder-app.tsx')

    await runApp(container, { projectSlug: slug, docsPath: options.docsPath })
  } finally {
    await builder.stopServer()
  }
}

async function runHeadless(container: any, slug: string, options: z.infer<typeof argsSchema>, ui: any) {
  const { colors } = ui
  const log = (msg: string) => ui.print(msg)
  const dim = (msg: string) => colors.gray(msg)
  const bold = (msg: string) => colors.bold(msg)

  const builder = container.feature('projectBuilder', {
    projectSlug: slug,
    docsPath: options.docsPath,
  })

  log(dim(`[project-builder] loading project "${slug}"...`))
  await builder.load()

  if (!builder.project) {
    log(colors.red(`[project-builder] failed to load project "${slug}"`))
    process.exit(1)
  }

  log(bold(`[project-builder] ${builder.project.title}`))
  log(dim(`[project-builder] ${builder.plans.length} plans`))

  for (const plan of builder.plans) {
    const statusLabel = plan.status === 'completed' ? colors.green('done') : colors.cyan(plan.status)
    log(`  ${statusLabel} ${plan.title}`)
  }

  if (builder.plans.length === 0) {
    log(colors.yellow(`[project-builder] no plans found — does the project have an Execution section?`))
    return
  }

  const pending = builder.plans.filter((p: any) => p.status !== 'completed')
  if (pending.length === 0) {
    log(colors.green(`[project-builder] all plans already completed`))
    return
  }

  log('')
  log(dim(`[project-builder] executing ${pending.length} pending plan(s)...`))
  log('')

  // Wire up event listeners for structured log output
  const planStartTimes = new Map<string, number>()

  builder.on('plan:skipped', (data: any) => {
    log(dim(`[skip] ${data.planId} — already completed`))
  })

  builder.on('plan:queued', (data: any) => {
    log(dim(`[queue] ${data.planId} (${data.index + 1}/${data.total})`))
  })

  builder.on('plan:start', (data: any) => {
    planStartTimes.set(data.planId, Date.now())
    const plan = builder.plans.find((p: any) => p.id === data.planId)
    log(colors.yellow(`[start] ${plan?.title || data.planId}`))
  })

  builder.on('plan:delta', (data: any) => {
    // Write delta text directly — this is the streaming claude output
    const lines = data.text.split('\n')
    for (const line of lines) {
      if (line.trim()) {
        process.stdout.write(dim(`  │ `) + line + '\n')
      }
    }
  })

  builder.on('plan:complete', (data: any) => {
    const plan = builder.plans.find((p: any) => p.id === data.planId)
    const elapsed = planStartTimes.has(data.planId)
      ? ((Date.now() - planStartTimes.get(data.planId)!) / 1000).toFixed(1)
      : '?'
    const cost = data.costUsd != null ? `$${data.costUsd.toFixed(4)}` : ''
    const turns = data.turns != null ? `${data.turns} turns` : ''
    const stats = [cost, turns, `${elapsed}s`].filter(Boolean).join(' | ')
    log(colors.green(`[done] ${plan?.title || data.planId}`) + dim(` (${stats})`))
    log('')
  })

  builder.on('plan:error', (data: any) => {
    const plan = builder.plans.find((p: any) => p.id === data.planId)
    log(colors.red(`[error] ${plan?.title || data.planId}: ${data.error || 'unknown error'}`))
  })

  builder.on('build:complete', (data: any) => {
    const cost = data.totalCost != null ? `$${data.totalCost.toFixed(4)}` : ''
    log(colors.green(bold(`[project-builder] build complete`)) + (cost ? dim(` (total: ${cost})`) : ''))
  })

  builder.on('build:error', (data: any) => {
    log(colors.red(`[project-builder] build failed at ${data.failedPlanId}: ${data.error || 'unknown'}`))
  })

  builder.on('build:aborting', () => {
    log(colors.yellow(`[project-builder] aborting build...`))
  })

  builder.on('build:aborted', () => {
    log(colors.yellow(`[project-builder] build aborted`))
  })

  // Allow Ctrl+C to abort the running build gracefully
  let abortRequested = false
  const sigintHandler = () => {
    if (abortRequested) {
      log(colors.red(`[project-builder] force exit`))
      process.exit(1)
    }
    abortRequested = true
    log(colors.yellow(`\n[project-builder] Ctrl+C received — aborting build (press again to force exit)...`))
    builder.abort().catch((err: any) => {
      log(colors.red(`[project-builder] abort failed: ${err.message || err}`))
      process.exit(1)
    })
  }
  process.on('SIGINT', sigintHandler)

  try {
    await builder.run()
  } finally {
    process.off('SIGINT', sigintHandler)
  }
}

export default {
  description: 'Terminal UI for building projects with multi-plan execution',
  argsSchema,
  handler: projectBuilder,
}
