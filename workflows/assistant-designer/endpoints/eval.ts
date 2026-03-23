export const path = '/api/eval'
export const description = 'Evaluate an expression in the REPL context'

export async function post(_params: any, ctx: any) {
  const { vm, replContext, designerState } = ctx.request.app.locals
  const { code } = ctx.request.body || {}

  if (!code) {
    ctx.response.status(400)
    return { error: 'Missing code' }
  }

  // Keep the state reference current
  replContext.state = designerState

  try {
    const result = await vm.run(code, replContext)
    const output = result === undefined ? 'undefined' : JSON.stringify(result, null, 2)
    return { ok: true, output }
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) }
  }
}
