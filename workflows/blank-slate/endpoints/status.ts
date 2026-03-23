import { createHash } from 'crypto'

export const path = '/api/status'
export const description = 'Onboarding status for step detection'
export const tags = ['blank-slate']

const DEFAULT_VISION_HASH = 'e2a8b87fc08f0e4b5abb2ef82e98c3002c2a62aa97ff860fb3df122dbab5a055'

export async function get(_params: any, ctx: any) {
  const { docs, fs, getVisionPath } = ctx.request.app.locals

  const visionPath = getVisionPath()
  let hasVision = false
  let visionHash = ''

  if (fs.existsSync(visionPath)) {
    const content = fs.readFileSync(visionPath, 'utf-8')
    visionHash = createHash('sha256').update(content).digest('hex')
    hasVision = visionHash !== DEFAULT_VISION_HASH
  }

  const goals = await docs.query(docs.models.Goal).fetchAll()
  const ideas = await docs.query(docs.models.Idea).fetchAll()

  return {
    hasVision,
    visionHash,
    goalCount: goals.length,
    ideaCount: ideas.length,
  }
}
