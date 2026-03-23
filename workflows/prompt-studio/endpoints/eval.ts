export const path = '/api/eval'
export const description = 'Evaluate TypeScript code in the server-side VM'
export const tags = ['prompt-studio']

export async function post(_params: any, ctx: any) {
  const { vm, replContext } = ctx.request.app.locals
  const { code } = ctx.request.body

  if (!code) {
    ctx.response.status(400)
    return { error: 'Missing code' }
  }

  // Capture console output
  const logs: string[] = []
  const captureConsole = {
    log: (...args: any[]) => logs.push(args.map(String).join(' ')),
    error: (...args: any[]) => logs.push('[error] ' + args.map(String).join(' ')),
    warn: (...args: any[]) => logs.push('[warn] ' + args.map(String).join(' ')),
    info: (...args: any[]) => logs.push(args.map(String).join(' ')),
  }

  // Temporarily replace console in the context
  replContext.console = captureConsole

  try {
    const result = await vm.run(code, replContext)
    replContext.console = console // restore

    return {
      ok: true,
      output: logs.join('\n'),
      result: result !== undefined ? String(result) : undefined,
    }
  } catch (err: any) {
    replContext.console = console // restore
    return {
      ok: false,
      output: logs.join('\n'),
      error: err.message || String(err),
    }
  }
}
