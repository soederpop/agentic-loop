import { createHash } from 'crypto'

export const path = '/api/vision'
export const description = 'Read or write the vision statement'
export const tags = ['blank-slate']

const DEFAULT_VISION_HASH = 'e2a8b87fc08f0e4b5abb2ef82e98c3002c2a62aa97ff860fb3df122dbab5a055'

export async function get(_params: any, ctx: any) {
  const { fs, getVisionPath } = ctx.request.app.locals

  const visionPath = getVisionPath()
  let text = ''
  let isDefault = true

  if (fs.existsSync(visionPath)) {
    text = fs.readFileSync(visionPath, 'utf-8')
    isDefault = createHash('sha256').update(text).digest('hex') === DEFAULT_VISION_HASH
  }

  return { text, isDefault }
}

export async function post(_params: any, ctx: any) {
  const { fs, getVisionPath } = ctx.request.app.locals

  const { text } = ctx.body

  if (!text || typeof text !== 'string' || !text.trim()) {
    ctx.response.status(400)
    return { error: 'Vision text is required' }
  }

  const content = `# Vision Statement\n\n${text.trim()}\n`
  const visionPath = getVisionPath()
  fs.writeFile(visionPath, content)

  return { ok: true, hash: createHash('sha256').update(content).digest('hex') }
}
