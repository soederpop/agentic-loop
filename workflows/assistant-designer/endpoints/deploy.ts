export const path = '/api/deploy'
export const description = 'Write assistant files and create/recreate the live assistant instance'

export async function post(_params: any, ctx: any) {
  const { designerState, container, assistantsManager, getAssistant, setAssistant } = ctx.request.app.locals
  const fs = container.feature('fs')

  const name = designerState.assistantName
  if (!name || !name.trim()) {
    ctx.response.status(400)
    return { error: 'assistantName is required' }
  }

  const folder = container.paths.resolve('assistants', name)
  await fs.mkdirp(folder)

  // Write CORE.md
  await fs.writeFileAsync(
    container.paths.join(folder, 'CORE.md'),
    designerState.systemPrompt,
  )

  // Write tools.ts
  const toolsSrc = generateToolsSource(designerState.tools)
  await fs.writeFileAsync(
    container.paths.join(folder, 'tools.ts'),
    toolsSrc,
  )

  // Write hooks.ts (if provided)
  if (designerState.hooksSource.trim()) {
    await fs.writeFileAsync(
      container.paths.join(folder, 'hooks.ts'),
      designerState.hooksSource,
    )
  }

  // Tear down previous assistant if any
  const prev = getAssistant()
  if (prev) {
    try { prev.removeAllListeners() } catch {}
  }

  // Re-discover so the manager picks up new/changed folders
  await assistantsManager.discover()

  // Create fresh assistant instance
  try {
    const assistant = container.feature('assistant', {
      folder,
      model: designerState.model,
      maxTokens: designerState.maxTokens,
      local: designerState.provider === 'lm-studio',
    })
    await assistant.start()
    setAssistant(assistant)

    return {
      ok: true,
      folder,
      name,
      tools: assistant.availableTools,
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || String(err),
      folder,
    }
  }
}

function generateToolsSource(tools: Array<{ name: string; description: string; schema: string; handler: string }>): string {
  if (tools.length === 0) {
    return `import { z } from 'zod'\n\nexport const schemas = {}\n`
  }

  const lines: string[] = [`import { z } from 'zod'`, '']

  // schemas export
  lines.push('export const schemas = {')
  for (const tool of tools) {
    const desc = tool.description ? `.describe(${JSON.stringify(tool.description)})` : ''
    lines.push(`  ${tool.name}: ${tool.schema}${desc},`)
  }
  lines.push('}')
  lines.push('')

  // handler functions
  for (const tool of tools) {
    lines.push(`export async function ${tool.name}(args: any) {`)
    // Indent handler body
    const body = tool.handler.trim() || `return { result: 'not implemented' }`
    for (const line of body.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}
