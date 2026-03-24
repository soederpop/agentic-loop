export const path = '/api/export'
export const description = 'Export the generated file contents as JSON for preview'

export async function get(_params: any, ctx: any) {
  const { designerState } = ctx.request.app.locals

  return {
    assistantName: designerState.assistantName,
    files: {
      'CORE.md': designerState.systemPrompt,
      'tools.ts': generateToolsPreview(designerState.tools),
      'hooks.ts': designerState.hooksSource || '// No hooks defined',
    },
    config: {
      model: designerState.model,
      provider: designerState.provider,
      maxTokens: designerState.maxTokens,
      temperature: designerState.temperature,
    },
  }
}

function generateToolsPreview(tools: Array<{ name: string; description: string; schema: string; handler: string }>): string {
  if (tools.length === 0) return `import { z } from 'zod'\n\nexport const schemas = {}\n`

  const lines: string[] = [`import { z } from 'zod'`, '']
  lines.push('export const schemas = {')
  for (const tool of tools) {
    const desc = tool.description ? `.describe(${JSON.stringify(tool.description)})` : ''
    lines.push(`  ${tool.name}: ${tool.schema}${desc},`)
  }
  lines.push('}')
  lines.push('')
  for (const tool of tools) {
    lines.push(`export async function ${tool.name}(args: any) {`)
    const body = tool.handler.trim() || `return { result: 'not implemented' }`
    for (const line of body.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('}')
    lines.push('')
  }
  return lines.join('\n')
}
