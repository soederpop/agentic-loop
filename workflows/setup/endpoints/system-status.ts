export const path = '/api/system-status'
export const description = 'Check all system capabilities'
export const tags = ['setup']

export async function get(_params: any, ctx: any) {
  const { getAllCapabilities } = ctx.request.app.locals
  const capabilities = await getAllCapabilities()
  const ready = capabilities.filter((c: any) => c.status === 'ok').length
  const total = capabilities.length
  return { ready, total, capabilities }
}
