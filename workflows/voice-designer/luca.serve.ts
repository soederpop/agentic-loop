/**
 * Voice Designer Workflow — setup hook for luca serve
 *
 * Exposes the assistant voice configs for live editing and phrase testing.
 *
 * Usage:
 *   luca serve --setup workflows/voice-designer/luca.serve.ts --staticDir workflows/voice-designer/public --endpoints-dir workflows/voice-designer/endpoints --any-port --no-open
 */
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const yaml = container.feature('yaml')
  const fs = container.feature('fs')

  function discoverAssistants() {
    const manager = container.feature('assistantsManager') as any
    manager.discover()
    const results: any[] = []
    for (const entry of manager.list()) {
      if (!entry.hasVoice) continue
      const inst = container.feature('assistant', { folder: entry.folder })
      if (inst.voiceConfig) {
        results.push({
          name: entry.name,
          folder: entry.folder,
          voiceConfig: inst.voiceConfig,
          assistant: inst,
        })
      }
    }
    return results
  }

  app.locals.discoverAssistants = discoverAssistants
  app.locals.yaml = yaml
  app.locals.fs = fs

  console.log('[voice-designer] workflow API ready')
}
