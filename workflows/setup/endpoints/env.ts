export const path = '/api/env'
export const description = 'Save an allowlisted env key to .env'
export const tags = ['setup']

const ENV_ALLOWLIST = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY']

export async function post(_params: any, ctx: any) {
  const { fs } = ctx.request.app.locals
  const container = ctx.container
  const { key, value } = ctx.body

  if (!key || !value) {
    ctx.response.status(400)
    return { error: 'key and value are required' }
  }
  if (!ENV_ALLOWLIST.includes(key)) {
    ctx.response.status(403)
    return { error: `Key "${key}" is not in the allowlist` }
  }

  const envPath = container.paths.resolve('.env')
  let envContent = ''
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')
  }

  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`)
  } else {
    envContent = envContent.trimEnd() + `\n${key}=${value}\n`
  }

  fs.writeFile(envPath, envContent)
  process.env[key] = value

  return { ok: true, key }
}
