/**
 * Assistant Designer Workflow — setup hook for luca serve
 *
 * Design assistants visually: edit CORE.md, tools.ts (Zod schemas + handlers),
 * and hooks.ts. Deploy writes real files to assistants/<name>/ and creates
 * a live assistant instance. Chat goes through assistant.ask().
 *
 * Usage:
 *   luca serve --setup workflows/assistant-designer/luca.serve.ts --staticDir workflows/assistant-designer/public --endpoints-dir workflows/assistant-designer/endpoints --any-port
 */

export interface ToolDef {
  name: string
  description: string
  schema: string    // Zod source code, e.g. "z.object({ query: z.string() })"
  handler: string   // Function body source code
}

export interface DesignerState {
  assistantName: string
  systemPrompt: string   // becomes CORE.md
  tools: ToolDef[]
  hooksSource: string    // raw hooks.ts source
  model: string
  provider: 'openai' | 'lm-studio'
  maxTokens: number
  temperature: number
}

export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  await container.helpers.discover('features')

  const assistantsManager = container.feature('assistantsManager') as any
  await assistantsManager.discover()

  const designerState: DesignerState = {
    assistantName: 'my-assistant',
    systemPrompt: '# My Assistant\n\nYou are a helpful assistant.',
    tools: [],
    hooksSource: '',
    model: 'gpt-4o',
    provider: 'openai',
    maxTokens: 4096,
    temperature: 1,
  }

  // The live assistant instance, created on deploy
  let assistant: any = null

  // Create a shared VM context for the REPL
  const vm = container.feature('vm')
  const replContext = vm.createContext({
    container,
    console,
    get assistant() { return assistant },
    get state() { return designerState },
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
    fetch: globalThis.fetch,
  })

  app.locals.designerState = designerState
  app.locals.container = container
  app.locals.assistantsManager = assistantsManager
  app.locals.vm = vm
  app.locals.replContext = replContext

  // Getter/setter for the live assistant instance
  app.locals.getAssistant = () => assistant
  app.locals.setAssistant = (a: any) => { assistant = a }

  console.log('[assistant-designer] workflow API ready')
}
