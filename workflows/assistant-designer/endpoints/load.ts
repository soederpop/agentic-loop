export const path = '/api/load'
export const description = 'Load an existing assistant definition into the designer, or list available assistants'

export async function get(_params: any, ctx: any) {
  const { assistantsManager } = ctx.request.app.locals

  const assistants = assistantsManager.list().map((a: any) => ({
    name: a.name,
    folder: a.folder,
  }))

  return { assistants }
}

export async function post(_params: any, ctx: any) {
  const { designerState, container } = ctx.request.app.locals
  const { name } = ctx.request.body || {}
  const fs = container.feature('fs')

  if (!name) {
    ctx.response.status(400)
    return { error: 'Missing assistant name' }
  }

  const folder = container.paths.resolve('assistants', name)

  // Read CORE.md
  let systemPrompt = '# ' + name + '\n\nYou are a helpful assistant.'
  try {
    systemPrompt = await fs.readFileAsync(container.paths.join(folder, 'CORE.md'), 'utf8')
  } catch {}

  // Read tools.ts and parse it back into tool definitions
  let tools: any[] = []
  let rawToolsSource = ''
  try {
    rawToolsSource = await fs.readFileAsync(container.paths.join(folder, 'tools.ts'), 'utf8')
    tools = parseToolsSource(rawToolsSource)
  } catch {}

  // Read hooks.ts
  let hooksSource = ''
  try {
    hooksSource = await fs.readFileAsync(container.paths.join(folder, 'hooks.ts'), 'utf8')
  } catch {}

  designerState.assistantName = name
  designerState.systemPrompt = systemPrompt
  designerState.tools = tools
  designerState.hooksSource = hooksSource

  return {
    ok: true,
    assistantName: name,
    systemPrompt,
    tools,
    hooksSource,
    rawToolsSource,
  }
}

// Best-effort parsing of tools.ts back into structured tool definitions.
// This is heuristic — it extracts schema and handler blocks by convention.
function parseToolsSource(source: string): Array<{ name: string; description: string; schema: string; handler: string }> {
  const tools: Array<{ name: string; description: string; schema: string; handler: string }> = []

  // Extract schema names from "export const schemas = { name: z.object(...), ... }"
  const schemasMatch = source.match(/export\s+const\s+schemas\s*=\s*\{([\s\S]*?)\n\}/)
  if (!schemasMatch) return tools

  // Extract each "name: z.object(...)" entry
  const schemasBody = schemasMatch[1]
  const schemaEntries = schemasBody.match(/(\w+)\s*:\s*(z\.\w+\([\s\S]*?\))(?:\.describe\((['"`])([\s\S]*?)\3\))?\s*,/g)

  if (!schemaEntries) return tools

  for (const entry of schemaEntries) {
    const nameMatch = entry.match(/^(\w+)\s*:/)
    if (!nameMatch) continue
    const name = nameMatch[1]

    // Extract the schema (everything between "name: " and the .describe or trailing comma)
    const schemaMatch = entry.match(/:\s*(z\.[\s\S]*?)(?:\.describe\(|,\s*$)/)
    const schema = schemaMatch ? schemaMatch[1].trim() : 'z.object({})'

    // Extract description from .describe('...')
    const descMatch = entry.match(/\.describe\((['"`])([\s\S]*?)\1\)/)
    const description = descMatch ? descMatch[2] : ''

    // Find the corresponding handler function
    const fnRegex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`)
    const fnMatch = source.match(fnRegex)
    const handler = fnMatch ? fnMatch[1].replace(/^\n/, '').replace(/^  /gm, '').trimEnd() : ''

    tools.push({ name, description, schema, handler })
  }

  return tools
}
