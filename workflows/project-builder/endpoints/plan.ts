export const path = '/api/plan/:planId'
export const description = 'Get or update a single plan by encoded ID'
export const tags = ['project-builder']

function decodePlanId(encoded: string): string {
  return encoded.replace(/~/g, '/')
}

export async function get(_params: any, ctx: any) {
  const { docs, serializePlan } = ctx.request.app.locals
  const planId = decodePlanId(ctx.params.planId)

  const plans = await docs.query(docs.models.Plan).fetchAll()
  const plan = plans.find((p: any) => p.id === planId)

  if (!plan) {
    ctx.response.status(404)
    return { error: 'Plan not found' }
  }

  return serializePlan(plan)
}

export async function put(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const planId = decodePlanId(ctx.params.planId)
  const { content, meta } = ctx.request.body || {}

  const plans = await docs.query(docs.models.Plan).fetchAll()
  const plan = plans.find((p: any) => p.id === planId)

  if (!plan) {
    ctx.response.status(404)
    return { error: 'Plan not found' }
  }

  const doc = plan.document

  if (meta) {
    if (meta.status !== undefined) doc.meta.status = meta.status
    if (meta.project !== undefined) doc.meta.project = meta.project
  }

  if (content !== undefined) {
    const yaml = ctx.container.feature('yaml')
    const frontmatter = yaml.stringify(doc.meta).trim()
    const fs = ctx.container.feature('fs')
    await fs.writeFile(doc.path, `---\n${frontmatter}\n---\n\n${content}`)
    await docs.load()
  } else {
    await doc.save({ normalize: false })
    await docs.load()
  }

  const updated = (await docs.query(docs.models.Plan).fetchAll())
    .find((p: any) => p.id === planId)

  return { ok: true, plan: updated ? ctx.request.app.locals.serializePlan(updated) : null }
}
