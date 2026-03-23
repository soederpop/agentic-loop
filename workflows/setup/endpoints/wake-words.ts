export const path = '/api/wake-words'
export const description = 'Discover wake word models'
export const tags = ['setup']

export async function get(_params: any, ctx: any) {
  const { whichBin, fs } = ctx.request.app.locals
  const container = ctx.container

  const rustpotter = await whichBin('rustpotter')
  const modelsDir = container.paths.resolve('voice', 'wakeword', 'models')
  let models: { file: string; name: string }[] = []
  if (fs.existsSync(modelsDir)) {
    models = fs.readdirSync(modelsDir)
      .filter((f: string) => f.endsWith('.rpw'))
      .map((f: string) => ({ file: f, name: f.replace('.rpw', '').replace(/_/g, ' ') }))
  }
  return { models, rustpotterAvailable: rustpotter.found }
}
