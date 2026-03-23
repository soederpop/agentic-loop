/**
 * Assistant Designer Workflow — setup hook for luca serve
 *
 * Manages a live assistant definition (system prompt, tools, conversation)
 * and proxies to the Anthropic or OpenAI-compatible APIs for chat and tool sampling.
 *
 * Usage:
 *   luca serve --setup workflows/assistant-designer/luca.serve.ts --staticDir workflows/assistant-designer/public --endpoints-dir workflows/assistant-designer/endpoints --port 9330
 */

export interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, any>
  mock_result?: string
}

export interface DesignerState {
  systemPrompt: string
  tools: ToolDef[]
  messages: Array<{ role: string; content: any }>
  model: string
  provider: 'anthropic' | 'openai' | 'lm-studio'
  maxTokens: number
  temperature: number
}

export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  await container.helpers.discover('features')

  const designerState: DesignerState = {
    systemPrompt: 'You are a helpful assistant.',
    tools: [],
    messages: [],
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    maxTokens: 4096,
    temperature: 1,
  }

  // Helper: get an OpenAI client for the current provider
  function getOpenAIClient(provider?: string) {
    const p = provider || designerState.provider
    if (p === 'lm-studio') {
      return container.client('openai', {
        baseURL: 'http://localhost:1234/v1',
        apiKey: 'lm-studio',
      })
    }
    // Default OpenAI
    return container.client('openai')
  }

  // Create a shared VM context for the REPL
  const vm = container.feature('vm')
  const replContext = vm.createContext({
    container,
    console,
    state: designerState,
    getOpenAIClient,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    JSON,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Error,
    Buffer,
    process,
    require,
    fetch,
  })

  app.locals.designerState = designerState
  app.locals.container = container
  app.locals.vm = vm
  app.locals.replContext = replContext
  app.locals.apiKey = process.env.ANTHROPIC_API_KEY
  app.locals.getOpenAIClient = getOpenAIClient

  console.log('[assistant-designer] workflow API ready')
}
