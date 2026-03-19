/**
 * Project Builder — React Ink Terminal App
 *
 * Terminal UI for viewing and executing contentbase projects.
 * Displays project overview on the left, plan tiles on the right,
 * with a question input bar at the bottom for asking Claude Code questions.
 *
 * IMPORTANT: We use ink.React (not `import React`) to avoid dual-React
 * instance issues in the compiled luca binary. All rendering uses
 * React.createElement (aliased as `h`) instead of JSX.
 *
 * Usage (via luca command):
 *   luca project-builder <project-slug>
 */
import type { PlanInfo, BuildStatus } from '../../features/project-builder'

const MAX_LINES = 40
const MAX_DELTA_CHARS = 2000

function lastNLines(text: string, n: number): string {
  const lines = text.split('\n')
  return lines.slice(-n).join('\n')
}

function extractDescription(content: string, maxLen = 100): string {
  if (!content) return ''
  let text = content.replace(/^---[\s\S]*?---\s*/, '')
  text = text.replace(/^#+\s+[^\n]+\n*/gm, '').trim()
  const firstPara = text.split(/\n\s*\n/)[0] || ''
  const desc = firstPara.replace(/\s+/g, ' ').trim()
  return desc.length > maxLen ? desc.slice(0, maxLen) + '...' : desc
}

export default async function runApp(
  container: any,
  options: { projectSlug: string; docsPath: string }
) {
  const ink = container.feature('ink', { enable: true })
  await ink.loadModules()

  // Use ink's React to ensure same instance as the reconciler
  const React = ink.React
  const h = React.createElement
  const { Box, Text, Spacer } = ink.components
  const { useState, useEffect, useRef, useCallback } = React
  const { useInput, useApp } = ink.hooks

  // Get the ProjectBuilder as a Luca feature
  const builder = container.feature('projectBuilder', {
    projectSlug: options.projectSlug,
    docsPath: options.docsPath,
  })

  // ─── Spinner Hook ──────────────────────────────────────────────────────────

  function useSpinner(active: boolean): string {
    const frames = ['|', '/', '-', '\\']
    const [idx, setIdx] = useState(0)

    useEffect(() => {
      if (!active) return
      const interval = setInterval(() => {
        setIdx((prev: number) => (prev + 1) % frames.length)
      }, 250)
      return () => clearInterval(interval)
    }, [active])

    return active ? frames[idx] : ''
  }

  // ─── StatusBar ─────────────────────────────────────────────────────────────

  function StatusBar({ projectTitle, buildStatus, currentPlanId }: any) {
    const spinner = useSpinner(buildStatus === 'running' || buildStatus === 'aborting')

    const statusColors: Record<string, string> = {
      idle: 'gray',
      loading: 'blue',
      ready: 'cyan',
      running: 'yellow',
      aborting: 'magenta',
      completed: 'green',
      error: 'red',
    }

    const statusLabel = buildStatus === 'running'
      ? ` ${spinner} running ${currentPlanId?.split('/').pop() || ''} `
      : buildStatus === 'aborting'
      ? ` ${spinner} aborting... `
      : ` ${buildStatus} `

    return h(Box, { paddingX: 1 },
      h(Text, { bold: true }, projectTitle || 'Loading...'),
      h(Spacer),
      h(Text, { backgroundColor: statusColors[buildStatus] || 'gray', color: 'black' }, statusLabel),
      h(Text, null, ' '),
      h(Text, { dimColor: true },
        buildStatus === 'running' ? 'a:abort  v:view  ↑↓:scroll' :
        buildStatus === 'aborting' ? 'aborting...' :
        buildStatus === 'ready' ? 'r:run  q:quit  tab:focus' :
        'q:quit  tab:focus  esc:back'
      ),
    )
  }

  // ─── ProjectPanel ──────────────────────────────────────────────────────────

  function ProjectPanel({ markdown, questionMode, streamingResponse, questionLoading, lastQuestion }: any) {
    if (questionMode) {
      return h(Box, {
        flexDirection: 'column',
        flexBasis: '60%',
        borderStyle: 'round',
        borderColor: 'blue',
        paddingX: 1,
        paddingY: 0,
      },
        h(Text, { bold: true, color: 'blue' }, 'Question: ', lastQuestion),
        h(Text, { dimColor: true }, '─'.repeat(40)),
        questionLoading && !streamingResponse
          ? h(Text, { dimColor: true }, 'Thinking...')
          : h(Text, { wrap: 'wrap' }, lastNLines(streamingResponse, MAX_LINES)),
      )
    }

    return h(Box, {
      flexDirection: 'column',
      flexBasis: '60%',
      borderStyle: 'round',
      paddingX: 1,
      paddingY: 0,
    },
      h(Text, { bold: true }, 'Project Overview'),
      h(Text, { dimColor: true }, '─'.repeat(40)),
      h(Text, { wrap: 'wrap' }, lastNLines(markdown || 'Loading project...', MAX_LINES)),
    )
  }

  // ─── PlanTile ──────────────────────────────────────────────────────────────

  function PlanTile({ plan, isActive, delta }: any) {
    const spinner = useSpinner(isActive)

    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: 'gray', label: 'pend' },
      approved: { color: 'cyan', label: 'ready' },
      queued: { color: 'blue', label: 'queue' },
      running: { color: 'yellow', label: spinner || 'run' },
      completed: { color: 'green', label: 'done' },
      error: { color: 'red', label: 'fail' },
      skipped: { color: 'gray', label: 'skip' },
    }

    const status = statusConfig[plan.status] || statusConfig.pending
    const title = plan.title || plan.id.split('/').pop() || plan.id

    const costStr = plan.costUsd != null ? `$${plan.costUsd.toFixed(4)}` : ''
    const turnsStr = plan.turns != null ? `${plan.turns}t` : ''
    const toolsStr = plan.toolCalls != null ? `${plan.toolCalls}tc` : ''
    const statsLine = [costStr, turnsStr, toolsStr].filter(Boolean).join(' | ')

    const lastDeltaLine = delta
      ? delta.split('\n').filter((l: string) => l.trim()).slice(-1)[0] || ''
      : ''

    const description = extractDescription(plan.content)

    const children = [
      h(Box, null,
        h(Text, { bold: true, wrap: 'truncate' }, title),
        h(Spacer),
        h(Text, { backgroundColor: status.color, color: 'black' }, ` ${status.label} `),
      ),
    ]

    if (description) {
      children.push(h(Text, { dimColor: true, wrap: 'truncate' }, description))
    }

    if (statsLine) {
      children.push(h(Text, { dimColor: true }, statsLine))
    }

    if (isActive && lastDeltaLine) {
      children.push(h(Text, { dimColor: true, wrap: 'truncate' }, lastDeltaLine.slice(0, 60)))
    }

    return h(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: status.color,
      paddingX: 1,
      marginBottom: 0,
    }, ...children)
  }

  // ─── PlansPanel ────────────────────────────────────────────────────────────

  function PlansPanel({ plans, currentPlanId, planDeltas, scrollOffset }: any) {
    if (plans.length === 0) {
      return h(Box, {
        flexDirection: 'column',
        flexBasis: '40%',
        borderStyle: 'round',
        paddingX: 1,
      },
        h(Text, { dimColor: true }, 'No plans found'),
      )
    }

    const visiblePlans = plans.slice(scrollOffset)

    const headerChildren = [h(Text, { bold: true }, `Plans (${plans.length})`)]
    if (scrollOffset > 0) {
      headerChildren.push(h(Text, { dimColor: true }, ` [${scrollOffset} above]`))
    }

    return h(Box, {
      flexDirection: 'column',
      flexBasis: '40%',
      paddingX: 0,
    },
      h(Box, { paddingX: 1 }, ...headerChildren),
      ...visiblePlans.map((plan: PlanInfo) =>
        h(PlanTile, {
          key: plan.id,
          plan,
          isActive: plan.id === currentPlanId,
          delta: planDeltas.get(plan.id),
        })
      ),
    )
  }

  // ─── QuestionInput ─────────────────────────────────────────────────────────

  function QuestionInput({ value, focused, disabled }: any) {
    const prompt = focused ? '> ' : '  '
    const cursor = focused && !disabled ? '_' : ''

    return h(Box, {
      borderStyle: 'round',
      borderColor: focused ? 'cyan' : 'gray',
      paddingX: 1,
    },
      h(Text, { dimColor: !focused }, prompt),
      disabled
        ? h(Text, { dimColor: true }, '(build running...)')
        : h(Text, null, value, cursor),
    )
  }

  // ─── ProgressView ─────────────────────────────────────────────────────────

  function ProgressView({ planTitle, delta }: any) {
    const rows = process.stdout.rows || 40
    const spinner = useSpinner(true)

    return h(Box, { flexDirection: 'column', height: rows },
      h(Box, { paddingX: 1 },
        h(Text, { bold: true }, planTitle || 'Plan Progress'),
        h(Spacer),
        h(Text, { backgroundColor: 'yellow', color: 'black' }, ` ${spinner} running `),
        h(Text, null, ' '),
        h(Text, { dimColor: true }, 'v:back  esc:back'),
      ),
      h(Box, {
        flexDirection: 'column',
        flexGrow: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        paddingX: 1,
      },
        h(Text, { wrap: 'wrap' }, lastNLines(delta || 'Waiting for output...', rows - 4)),
      ),
    )
  }

  // ─── App ───────────────────────────────────────────────────────────────────

  function App() {
    const { exit } = useApp()

    // ProjectBuilder state
    const [project, setProject] = useState(null)
    const [plans, setPlans] = useState([])
    const [buildStatus, setBuildStatus] = useState('idle')
    const [currentPlanId, setCurrentPlanId] = useState(null)
    const [projectMarkdown, setProjectMarkdown] = useState('')
    const [loadError, setLoadError] = useState(null)

    // Question/Claude state
    const [questionMode, setQuestionMode] = useState(false)
    const [questionText, setQuestionText] = useState('')
    const [lastQuestion, setLastQuestion] = useState('')
    const [streamingResponse, setStreamingResponse] = useState('')
    const [questionLoading, setQuestionLoading] = useState(false)

    // UI state
    const [focusedPanel, setFocusedPanel] = useState('input')
    const [planScrollOffset, setPlanScrollOffset] = useState(0)
    const [planDeltas, setPlanDeltas] = useState(new Map())
    const [viewMode, setViewMode] = useState('normal')

    const questionSessionRef = useRef(null)

    // ── Load project on mount ──
    useEffect(() => {
      builder.load().then(() => {
        setProject(builder.project)
        setPlans([...builder.plans])
        setBuildStatus(builder.buildStatus)

        try {
          const contentDb = container.feature('contentDb', { rootPath: options.docsPath })
          if (contentDb.collection) {
            const doc = contentDb.collection.document(`projects/${options.projectSlug}`)
            if (doc) {
              let stripped = doc
              try { stripped = stripped.removeSection('Execution') } catch {}
              try { stripped = stripped.removeSection('Execution Plan') } catch {}
              try { stripped = stripped.removeSection('Execution Order') } catch {}
              try { stripped = stripped.removeSection('Plans') } catch {}
              setProjectMarkdown(stripped.content || doc.content || '')
            }
          }
        } catch {
          setProjectMarkdown('(Could not load project markdown)')
        }
      }).catch((err: any) => {
        setLoadError(err.message || String(err))
        setBuildStatus('error')
      })
    }, [])

    // ── Wire ProjectBuilder events ──
    useEffect(() => {
      const handlers: Record<string, (data: any) => void> = {
        'build:start': () => {
          setBuildStatus('running')
          setPlanDeltas(new Map())
        },
        'build:complete': () => {
          setBuildStatus('completed')
          setCurrentPlanId(null)
        },
        'build:error': () => {
          setBuildStatus('error')
        },
        'build:aborting': () => {
          setBuildStatus('aborting')
        },
        'build:aborted': () => {
          setBuildStatus('ready')
          setCurrentPlanId(null)
        },
        'plan:start': (data) => {
          setCurrentPlanId(data.planId)
          setPlans((prev: any[]) => prev.map(p =>
            p.id === data.planId ? { ...p, status: 'running' } : p
          ))
        },
        'plan:delta': (data) => {
          setPlanDeltas((prev: Map<string, string>) => {
            const next = new Map(prev)
            const current = next.get(data.planId) || ''
            const updated = current + data.text
            next.set(data.planId, updated.length > MAX_DELTA_CHARS
              ? updated.slice(-MAX_DELTA_CHARS)
              : updated
            )
            return next
          })
        },
        'plan:complete': (data) => {
          setPlans((prev: any[]) => prev.map(p =>
            p.id === data.planId
              ? { ...p, status: 'completed', costUsd: data.costUsd, turns: data.turns }
              : p
          ))
        },
        'plan:error': (data) => {
          setPlans((prev: any[]) => prev.map(p =>
            p.id === data.planId ? { ...p, status: 'error' } : p
          ))
        },
        'plan:skipped': (data) => {
          setPlans((prev: any[]) => prev.map(p =>
            p.id === data.planId ? { ...p, status: 'skipped' } : p
          ))
        },
        'plan:queued': (data) => {
          setPlans((prev: any[]) => prev.map(p =>
            p.id === data.planId ? { ...p, status: 'queued' } : p
          ))
        },
      }

      for (const [event, handler] of Object.entries(handlers)) {
        builder.on(event, handler)
      }

      return () => {
        for (const [event, handler] of Object.entries(handlers)) {
          builder.off(event, handler)
        }
      }
    }, [])

    // ── Auto-reset progress view when build stops ──
    useEffect(() => {
      if (buildStatus !== 'running' && buildStatus !== 'aborting' && viewMode === 'progress') {
        setViewMode('normal')
      }
    }, [buildStatus])

    // ── Auto-scroll to active plan ──
    useEffect(() => {
      if (currentPlanId) {
        const idx = plans.findIndex((p: any) => p.id === currentPlanId)
        if (idx >= 0 && idx < planScrollOffset) {
          setPlanScrollOffset(idx)
        }
      }
    }, [currentPlanId, plans])

    // ── Ask question handler ──
    const handleAskQuestion = useCallback(async (question: string) => {
      setQuestionMode(true)
      setQuestionLoading(true)
      setStreamingResponse('')
      setLastQuestion(question)
      setQuestionText('')

      try {
        const cc = container.feature('claudeCode', { streaming: true })

        const contextPrompt = [
          `You are answering a question about the project "${project?.title}".`,
          `Project overview:\n${projectMarkdown}`,
          `\nPlans:\n${plans.map((p: any) => `- ${p.title} (${p.status})`).join('\n')}`,
          `\nThe user asks: ${question}`,
          `\nAnswer concisely and helpfully.`,
        ].join('\n')

        const sessionId = await cc.start(contextPrompt, {
          cwd: process.cwd(),
          streaming: true,
        })

        questionSessionRef.current = sessionId

        const deltaHandler = (data: { sessionId: string; text: string }) => {
          if (data.sessionId === sessionId) {
            setStreamingResponse((prev: string) => prev + data.text)
          }
        }

        const doneHandler = (data: { sessionId: string }) => {
          if (data.sessionId === sessionId) {
            setQuestionLoading(false)
            cc.off('session:delta', deltaHandler)
            cc.off('session:result', doneHandler)
            cc.off('session:error', errorHandler)
          }
        }

        const errorHandler = (data: { sessionId: string }) => {
          if (data.sessionId === sessionId) {
            setQuestionLoading(false)
            setStreamingResponse((prev: string) => prev + '\n[Error occurred]')
            cc.off('session:delta', deltaHandler)
            cc.off('session:result', doneHandler)
            cc.off('session:error', errorHandler)
          }
        }

        cc.on('session:delta', deltaHandler)
        cc.on('session:result', doneHandler)
        cc.on('session:error', errorHandler)
      } catch (err: any) {
        setQuestionLoading(false)
        setStreamingResponse(`Error: ${err.message || String(err)}`)
      }
    }, [project, projectMarkdown, plans])

    // ── Keyboard input ──
    useInput((input: string, key: any) => {
      // Global shortcuts
      if (key.escape) {
        if (viewMode === 'progress') {
          setViewMode('normal')
          return
        }
        if (questionMode) {
          setQuestionMode(false)
          setStreamingResponse('')
          return
        }
      }

      if (key.tab) {
        setFocusedPanel((prev: string) => prev === 'input' ? 'plans' : 'input')
        return
      }

      // Input mode: handle text entry
      if (focusedPanel === 'input' && buildStatus !== 'running') {
        if (key.return) {
          if (questionText.trim()) {
            handleAskQuestion(questionText.trim())
          }
          return
        }
        if (key.backspace || key.delete) {
          setQuestionText((prev: string) => prev.slice(0, -1))
          return
        }
        if (input && !key.ctrl && !key.meta && !key.escape) {
          setQuestionText((prev: string) => prev + input)
          return
        }
      }

      // Plans panel shortcuts
      if (focusedPanel === 'plans' || buildStatus === 'running') {
        if (key.upArrow) {
          setPlanScrollOffset((prev: number) => Math.max(0, prev - 1))
          return
        }
        if (key.downArrow) {
          setPlanScrollOffset((prev: number) => Math.min(Math.max(0, plans.length - 1), prev + 1))
          return
        }
      }

      // Command shortcuts (only when not typing in input)
      if (input === 'v' && (buildStatus === 'running' || buildStatus === 'aborting')) {
        setViewMode((prev: string) => prev === 'progress' ? 'normal' : 'progress')
        return
      }
      if (focusedPanel !== 'input' || buildStatus === 'running' || buildStatus === 'aborting') {
        if (input === 'r' && buildStatus === 'ready') {
          builder.run().catch(() => {})
          return
        }
        if (input === 'a' && buildStatus === 'running') {
          builder.abort().catch(() => {})
          return
        }
        if (input === 'q' && buildStatus !== 'running' && buildStatus !== 'aborting') {
          exit()
          return
        }
      }
    })

    // ── Render ──
    const termRows = process.stdout.rows || 40

    if (loadError) {
      return h(Box, { flexDirection: 'column', padding: 1, height: termRows },
        h(Text, { bold: true, color: 'red' }, 'Error loading project'),
        h(Text, { color: 'red' }, loadError),
        h(Text, { dimColor: true }, 'Press q to quit'),
      )
    }

    if (viewMode === 'progress' && currentPlanId && (buildStatus === 'running' || buildStatus === 'aborting')) {
      const currentPlan = plans.find((p: any) => p.id === currentPlanId)
      return h(ProgressView, {
        planTitle: currentPlan?.title || currentPlanId,
        delta: planDeltas.get(currentPlanId),
      })
    }

    return h(Box, { flexDirection: 'column', width: '100%', height: termRows },
      h(StatusBar, { projectTitle: project?.title, buildStatus, currentPlanId }),
      h(Box, { flexDirection: 'row', flexGrow: 1 },
        h(ProjectPanel, {
          markdown: projectMarkdown,
          questionMode,
          streamingResponse,
          questionLoading,
          lastQuestion,
        }),
        h(PlansPanel, {
          plans,
          currentPlanId,
          planDeltas,
          scrollOffset: planScrollOffset,
        }),
      ),
      h(QuestionInput, {
        value: questionText,
        focused: focusedPanel === 'input',
        disabled: buildStatus === 'running',
      }),
    )
  }

  // ── Mount ──────────────────────────────────────────────────────────────────

  // Clear screen and position cursor at top before rendering
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H')

  await ink.render(h(App))
  await ink.waitUntilExit()
}
