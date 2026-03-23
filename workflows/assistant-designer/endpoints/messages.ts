export const path = '/api/messages'
export const description = 'Get or clear the conversation history'

export async function get(_params: any, ctx: any) {
  const { designerState } = ctx.request.app.locals
  return { messages: designerState.messages }
}

const del = async (_params: any, ctx: any) => {
  const { designerState } = ctx.request.app.locals
  designerState.messages = []
  return { ok: true }
}

export { del as delete }
