/**
 * Prompt Studio Workflow — setup hook for luca serve
 *
 * Provides APIs for listing, reading, updating, and executing prompt documents.
 * Includes a server-side VM for running code blocks and a streaming endpoint for `luca prompt`.
 *
 * Usage:
 *   luca serve --setup workflows/prompt-studio/luca.serve.ts --staticDir workflows/prompt-studio/public --endpoints-dir workflows/prompt-studio/endpoints --port 9320
 */

export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  // Discover features (needed for assistantsManager)
  await container.helpers.discover('features')
  const assistantsManager = container.feature('assistantsManager')
  await assistantsManager.discover()

  // Create a shared VM context for the REPL
  const vm = container.feature('vm')
  const replContext = vm.createContext({
    container,
    console,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
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
  })

  // Share state with endpoint files
  app.locals.docs = docs
  app.locals.container = container
  app.locals.vm = vm
  app.locals.replContext = replContext
  app.locals.assistantsManager = assistantsManager

  // SSE clients for streaming prompt execution output
  app.locals.sseClients = new Set()

  console.log('[prompt-studio] workflow API ready')
}
