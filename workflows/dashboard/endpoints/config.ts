export const path = '/api/config'
export const description = 'Returns the WebSocket port for the luca main authority'

export async function get(_params: any, ctx: any) {
  return {
    wsPort: ctx.request.app.locals.wsPort,
    wsUrl: `ws://localhost:${ctx.request.app.locals.wsPort}`,
  }
}
