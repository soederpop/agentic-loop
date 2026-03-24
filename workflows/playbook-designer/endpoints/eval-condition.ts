export const path = '/api/plays/:slug/eval-condition'
export const description = 'Evaluate a condition code block from a play'
export const tags = ['playbook-designer']

/**
 * POST /api/plays/:slug/eval-condition
 * Body: { code: string, index?: number }
 * Returns: { passed: boolean, returnValue: any, error?: string, durationMs: number, logs: string[] }
 */
export async function post(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals
  const slug = ctx.request.params.slug
  const { code } = ctx.request.body

  if (!code || typeof code !== 'string' || !code.trim()) {
    ctx.status = 400
    return { error: 'Missing or empty code field' }
  }

  const vm = container.feature('vm')
  const ui = container.feature('ui')

  // Capture console output
  const logs: string[] = []
  const captureConsole = {
    log: (...args: any[]) => logs.push(args.map(String).join(' ')),
    warn: (...args: any[]) => logs.push('[warn] ' + args.map(String).join(' ')),
    error: (...args: any[]) => logs.push('[error] ' + args.map(String).join(' ')),
    info: (...args: any[]) => logs.push(args.map(String).join(' ')),
  }

  const startTime = Date.now()

  // Timeout protection: 5 seconds
  const timeout = 5000
  let timer: any

  try {
    const hasTopLevelAwait = /\bawait\b/.test(code)
    const wrapped = hasTopLevelAwait ? `(async function() { ${code} })()` : code

    const resultPromise = vm.run(wrapped, {
      container,
      ui,
      console: captureConsole,
      Date,
      Promise,
      setTimeout,
      clearTimeout,
    })

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Condition timed out after 5 seconds')), timeout)
    })

    const result = await Promise.race([resultPromise, timeoutPromise])
    clearTimeout(timer)

    const durationMs = Date.now() - startTime
    const passed = result !== false

    return {
      passed,
      returnValue: result !== undefined ? String(result) : undefined,
      logs,
      durationMs,
    }
  } catch (err: any) {
    clearTimeout(timer!)
    const durationMs = Date.now() - startTime

    return {
      passed: false,
      error: err.message || String(err),
      logs,
      durationMs,
    }
  }
}
