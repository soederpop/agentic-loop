# Creating New Voice Command Handlers

Voice command handlers are how the system responds to spoken commands. They live in `commands/voice/handlers/` and are auto-discovered at runtime — just drop a new `.ts` file in there and it works.

## The Handler Interface

Every handler implements `VoiceHandler` from `commands/voice/types.ts`:

```ts
export interface VoiceHandler {
  name: string                                    // Unique handler name
  description: string                             // Human-readable description
  keywords: string[]                              // Search/discovery keywords
  priority?: number                               // Lower = checked first (default: 100)
  transformInput?(text: string): string | Promise<string>  // Optional text preprocessing
  match(ctx: HandlerContext): boolean | Promise<boolean>    // Should this handler run?
  execute(ctx: HandlerContext): Promise<void>               // Do the thing
}
```

## Minimal Example

Create a new file in `commands/voice/handlers/` (you can use subdirectories for organization):

```ts
import type { VoiceHandler } from '../../types'

const handler: VoiceHandler = {
  name: 'my-handler',
  description: 'Does the thing when you say the word',
  keywords: ['thing', 'do the thing'],

  match(ctx) {
    return ctx.normalizedText.includes('thing')
  },

  async execute(ctx) {
    const { cmd, container, windowManager } = ctx

    // 1. Acknowledge — play a sound and tell the voice service we're on it
    ctx.playPhrase('generic-ack')
    cmd.ack()

    // 2. Do your work
    // ... your logic here ...

    // 3. Finish — play completion sound and report result
    ctx.playPhrase('generic-finish')
    cmd.finish({ result: { action: 'completed', text: cmd.text } })
  },
}

export default handler
```

That's it. The voice router will pick it up automatically.

## What's in HandlerContext

The `ctx` object passed to `match()` and `execute()` gives you everything you need:

| Property | Type | Description |
|---|---|---|
| `rawText` | `string` | Original transcribed text |
| `inputText` | `string` | After `transformInput` (if defined) |
| `normalizedText` | `string` | Lowercased version of inputText — use this for matching |
| `parsed` | `ParsedUtterance \| null` | NLP-parsed intent, target, subject, entities |
| `dictionary` | `VoiceDictionaryRuntime` | Voice dictionary for resolving spoken terms to paths/names |
| `container` | `AGIContainer & NodeContainer` | Full container access |
| `windowManager` | `WindowManager` | Spawn TTY windows or browser windows |
| `workspaceRoot` | `string` | Project root path |
| `activeWorkspace` | `VoiceWorkspaceContext` | Current workspace context |
| `cmd` | `CommandHandle` | Report status back to the voice service |
| `playPhrase(tag)` | `function` | Play a pre-generated TTS phrase by tag |
| `playAssistantPhrase(tag)` | `function` | Play an assistant-specific phrase |
| `speakPhrase(text)` | `async function` | Synthesize and speak arbitrary text via TTS |

## The CommandHandle Lifecycle

Every handler must report its status through `cmd`:

```ts
cmd.ack()                           // "I got it, working on it"
cmd.progress(0.5, 'Halfway done')   // Optional progress updates
cmd.finish({ result: { ... } })     // Success
cmd.fail({ error: 'Something broke' }) // Failure
```

At minimum: call `cmd.ack()` at the start and `cmd.finish()` or `cmd.fail()` at the end.

## Real Examples

### Opening a TTY app (terminal, console, etc.)

```ts
// commands/voice/handlers/apps/console.ts
import type { VoiceHandler } from '../../types'

const handler: VoiceHandler = {
  name: 'console',
  description: 'Opens up a luca console',
  keywords: ['repl', 'console'],

  match(ctx) {
    return (
      ctx.normalizedText.includes('console') || ctx.normalizedText.includes('repl')
    )
  },

  async execute(ctx) {
    const { cmd, container, windowManager } = ctx

    ctx.playPhrase('generic-ack')
    cmd.ack()

    await windowManager.spawnTTY({
      command: 'luca',
      args: ['console'],
      cwd: container.cwd
    })

    await container.sleep(3000)
    ctx.playPhrase('generic-finish')
    cmd.finish({ result: { action: 'completed', text: cmd.text } })
  },
}

export default handler
```

### Opening a browser window

```ts
// commands/voice/handlers/apps/draw.ts
import type { VoiceHandler } from '../../types'

const handler: VoiceHandler = {
  name: 'draw',
  description: 'Open Excalidraw for drawing and diagrams',
  keywords: ['lets draw', 'draw a diagram', 'excalidraw'],

  match(ctx) {
    return (
      ctx.normalizedText.includes('draw') ||
      ctx.normalizedText.includes('diagram') ||
      ctx.normalizedText.includes('excalidraw')
    )
  },

  async execute(ctx) {
    const { cmd, container, windowManager } = ctx

    ctx.playPhrase('editor')
    cmd.ack()

    await windowManager.spawn({
      url: 'https://excalidraw.com',
      width: 1000,
      height: 1000,
    })

    await container.sleep(3000)
    ctx.playPhrase('generic-finish')
    cmd.finish({ result: { action: 'completed', text: cmd.text } })
  },
}

export default handler
```

### Positioning a window

The monitor handler shows how to control window placement:

```ts
await windowManager.spawnTTY({
  command: 'luca',
  args: ['main'],
  cwd: container.cwd,
  x: 0,
  y: 0,
  height: '100%',
  width: '50%',
})
```

## Writing Good Match Functions

The `match()` function determines whether your handler should respond to a given voice command. Tips:

- **Always use `ctx.normalizedText`** — it's already lowercased
- **Keep matches specific** to avoid stealing commands from other handlers
- **Use `ctx.parsed`** for intent-based matching when simple keyword matching isn't enough (e.g. `ctx.parsed?.intent === 'open'`)
- **Use `ctx.dictionary`** to resolve spoken terms: `ctx.dictionary.resolveNoun('assistants')` maps voice terms to filesystem paths and canonical names

## Using Priority

Handlers are checked in priority order (lower number = checked first, default is 100). Use this when you need a handler to take precedence:

```ts
const handler: VoiceHandler = {
  name: 'urgent-handler',
  priority: 10,  // checked before default-priority handlers
  // ...
}
```

## Using transformInput

If your handler needs to preprocess the spoken text before matching:

```ts
const handler: VoiceHandler = {
  name: 'smart-handler',
  transformInput(text) {
    return text.replace(/gonna/g, 'going to')
  },
  // match() and execute() will see the transformed text in ctx.inputText
}
```

## Testing Your Handler

Use the `luca yo` command to test voice commands by typing instead of speaking:

```shell
# Test a command
luca yo friday open up the console

# Dry run — shows routing info without executing
luca yo --dry "open the console"
```

The dry-run output shows you the normalized text, NLP parse results, dictionary matches, and which handler would match.

## File Organization

Handlers in `commands/voice/handlers/` are auto-discovered recursively, so you can organize them into subdirectories:

```
commands/voice/handlers/
├── apps/           # App-launching handlers (console, terminal, draw, etc.)
├── navigation/     # Workspace navigation handlers
├── automation/     # Handlers that trigger automations
└── my-handler.ts   # Top-level is fine too
```

## Phrase Tags

Common pre-generated phrase tags you can use with `ctx.playPhrase()`:

- `generic-ack` — general acknowledgement ("Got it", "On it")
- `generic-finish` — general completion ("Done")
- `terminal` — terminal-specific acknowledgement
- `editor` — editor-specific acknowledgement

Custom phrases are defined in the assistant's `voice.yaml` file (e.g. `assistants/voice-assistant/voice.yaml`) and generated with `luca voice --generateSounds`.

## Summary

1. Create a `.ts` file in `commands/voice/handlers/` (or a subdirectory)
2. Export a default `VoiceHandler` object with `name`, `description`, `keywords`, `match`, and `execute`
3. In `match()`, check `ctx.normalizedText` (or `ctx.parsed`) to decide if this is your command
4. In `execute()`, call `cmd.ack()`, do your work, then call `cmd.finish()` or `cmd.fail()`
5. Test with `luca yo --dry "your command"` then `luca yo friday your command`
