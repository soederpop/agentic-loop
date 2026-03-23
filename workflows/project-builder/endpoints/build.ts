export const path = '/api/build/:slug'
export const description = 'Get build status for a project'
export const tags = ['project-builder']

export async function get(_params: any, ctx: any) {
  const { getBuilder, wireBuilderEvents } = ctx.request.app.locals
  const { slug } = ctx.params
  const builder = getBuilder(slug)
  wireBuilderEvents(builder, slug)

  if (!builder.state.loaded) {
    try {
      await builder.load()
    } catch (err: any) {
      return { status: 'error', error: err.message }
    }
  }

  return {
    status: builder.buildStatus,
    currentPlanId: builder.state.currentPlanId,
    plans: builder.plans.map((p: any) => ({
      id: p.id,
      title: p.title,
      status: p.status,
    })),
  }
}
