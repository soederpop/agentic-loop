# Creating Your Own Assistant

An Assistant is the core conversational unit in the Agentic Loop. It combines a personality (system prompt), capabilities (tools), and optionally a voice — all backed by the full power of the luca container. This guide walks you through creating one from scratch and chatting with it.

## What Makes an Assistant

An assistant lives in its own folder under `assistants/`. The folder name becomes the assistant's name. Here's the anatomy:

```
assistants/myAssistant/
├── CORE.md        # System prompt — who the assistant is (required)
├── tools.ts       # Functions the model can call (required)
├── hooks.ts       # Lifecycle event handlers (optional)
├── voice.yaml     # Voice/TTS configuration (optional)
└── docs/          # Documents the assistant can access (optional)
```

Only `CORE.md` and `tools.ts` are required. Everything else is optional.

## Step 1: Scaffold It

The fastest way to get started is `luca scaffold`:

```sh
luca scaffold assistant my-research-bot
```

This creates `assistants/myResearchBot/` with working starter files: `CORE.md`, `tools.ts`, and `hooks.ts`. You can immediately chat with the scaffolded assistant:

```sh
luca chat my-research-bot
```

The scaffold gives you a working baseline — the CORE.md explains what each file does, tools.ts has a placeholder tool, and hooks.ts has a `started` hook. From here, you edit the files to make it yours.

If you prefer to build from scratch instead, just `mkdir assistants/myAssistant` and create the files manually.

## Step 2: Write CORE.md — The System Prompt

This is plain markdown. No frontmatter needed. Write it like you're briefing someone on who they are, what they do, and how they should behave.

```markdown
# You are the Research Assistant

You help the user explore topics, summarize findings, and organize research notes.

You have access to tools that let you read and search documents in the project.
Keep your responses focused and factual. When you don't know something, say so.

## Your Style

- Clear, concise language
- Cite document IDs when referencing project docs
- Ask clarifying questions when a request is ambiguous
```

Tips from the existing assistants:

- **chiefOfStaff** uses CORE.md to define an entire workflow — how to handle ideas, projects, and plans. It references its tools by name and tells the model when to call them.

The system prompt is the single most important file. Spend time on it. Everything the assistant does well (or poorly) traces back to how clearly you defined its role here.

## Step 3: Write tools.ts — Give It Capabilities

Tools are how the assistant takes action. Each tool is an exported async function paired with a Zod schema.

```typescript
import { z } from 'zod'
import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

// These globals are injected at runtime — no imports needed
declare global {
  var assistant: Assistant
  var container: AGIContainer
}

// 1. Define schemas — these tell the model what each tool does and accepts
export const schemas = {
  searchDocs: z.object({
    query: z.string().describe('Search term to find in project documents'),
  }).describe('Search the project documents for a given term'),

  readDoc: z.object({
    id: z.string().describe('Document ID (e.g. "ideas/my-idea")'),
  }).describe('Read the full contents of a document'),

  summarize: z.object({
    text: z.string().describe('Text to summarize'),
    maxSentences: z.number().default(3).describe('Maximum sentences in summary'),
  }).describe('Produce a concise summary of the given text'),
}

// 2. Implement each tool — function name must match the schema key
export async function searchDocs({ query }: z.infer<typeof schemas.searchDocs>) {
  const grep = container.feature('grep')
  const results = await grep.search(query, { path: 'docs/' })
  return results
}

export async function readDoc({ id }: z.infer<typeof schemas.readDoc>) {
  const cdb = assistant.contentDb
  await cdb.collection.load({ refresh: true })
  const content = await cdb.readMultiple([id], { meta: true })
  return content
}

export async function summarize({ text, maxSentences }: z.infer<typeof schemas.summarize>) {
  // Tools can do anything — call APIs, run shell commands, read files
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).slice(0, maxSentences)
  return sentences.join('. ') + '.'
}
```

### What's Available Inside Tools

Every tool function has access to two globals:

| Global | What It Is |
|--------|-----------|
| `container` | The full luca AGI container — file system, shell, HTTP clients, SQLite, everything |
| `assistant` | The assistant instance itself — access conversation history, state, contentDb |

Since you have the full container, your tools can do anything luca can do:

```typescript
// File operations
const fs = container.feature('fs')
const content = fs.readFile('some/path.md')

// Run shell commands
const proc = container.feature('proc')
const output = await proc.exec('git log -5 --oneline')

// HTTP requests
const rest = container.client('rest', { baseURL: 'https://api.example.com' })
const data = await rest.get('/endpoint')

// Access the assistant's own docs folder
const docs = assistant.contentDb
```

### The Schema-to-Function Contract

- Every key in `export const schemas` must have a matching exported function
- The function name must exactly match the schema key
- The schema `.describe()` is what the model sees — make it clear and specific
- Parameter `.describe()` strings matter — they guide the model's tool use

## Step 4 (Optional): Add hooks.ts — React to Events

Hooks let you run code at specific points in the assistant's lifecycle.

```typescript
import type { Assistant } from '@soederpop/luca/agi'

// Runs after the assistant loads its prompt, tools, and hooks
export function created(assistant: Assistant) {
  console.log(`${assistant.name} is ready`)
}

// Runs after the assistant is fully initialized
export function started(assistant: Assistant) {
  // Good place for one-time setup
}

// Runs when the assistant produces a final response
export function response(assistant: Assistant, text: string) {
  console.log(`Response length: ${text.length} chars`)
}

// Runs when a tool is called
export function toolCall(assistant: Assistant, name: string, args: any) {
  console.log(`Tool called: ${name}`)
}
```

Available hook names: `created`, `started`, `turnStart`, `turnEnd`, `chunk`, `preview`, `response`, `toolCall`, `toolResult`, `toolError`.

## Step 5 (Optional): Add voice.yaml — Enable Voice Chat

If you want your assistant to work with the voice chat system, add a `voice.yaml`:

```yaml
voiceId: your-elevenlabs-voice-id
conversationModePrefix: "[friendly conversational tone]"
voiceSettings:
  stability: 0.35
  similarityBoost: 0.8
  style: 0.6
  speed: 1.05
  useSpeakerBoost: true
aliases:
  - myAssistant
  - research
phrases:
  greeting:
    - "Hello there"
    - "What can I help with?"
  thinking:
    - "Let me look into that"
    - "One moment..."
  generic-ack:
    - "Got it"
```

| Field | Purpose |
|-------|---------|
| `voiceId` | ElevenLabs voice ID for text-to-speech |
| `conversationModePrefix` | Text prepended to every response for TTS style control |
| `voiceSettings` | ElevenLabs voice parameters (stability, speed, etc.) |
| `aliases` | Alternate names the voice router can use to find this assistant |
| `phrases` | Pre-generated audio phrases for common responses (greeting, ack, etc.) |

Voice chat requires the `ELEVENLABS_API_KEY` environment variable.

## Step 6 (Optional): Add a docs/ Folder

If your assistant needs its own document collection, create a `docs/` folder inside the assistant directory. This becomes accessible via `assistant.contentDb`.

You can also symlink to the project's main docs:

```sh
cd assistants/myAssistant
ln -s ../../docs docs
```

The chiefOfStaff assistant does this — it symlinks to the project's `docs/` so it can read and write all project documents through its tools.

## Chatting With Your Assistant

### Option A: `luca chat` — The Built-In Chat CLI

The simplest way to have a conversation:

```sh
luca chat myAssistant
```

By default, `luca chat` uses **daily** history mode — your conversation persists for the calendar day. Come back later the same day and it picks up where you left off. To start fresh:

```sh
luca chat myAssistant --clear
```

#### Debugging with `/console`

While in a `luca chat` session, type `/console` to drop into a live REPL where you can interact with the assistant programmatically. The `assistant` and `container` variables are in scope:

```
you > /console

> assistant.messages.length
12
> assistant.name
'myAssistant'
> assistant.state.get('conversationCount')
4
> await assistant.ask('summarize our conversation so far')
'We discussed...'
> container.feature('fs').readFile('docs/ideas/cool-thing.md')
'---\nstatus: spark\n...'
```

This is invaluable for debugging tools, inspecting conversation state, or testing things interactively without leaving the chat session. Type `.exit` to return to the normal chat.

### Option B: Use the Existing Voice Chat

If your assistant has a `voice.yaml`, you can use the built-in voice chat:

```sh
luca demo --assistant myAssistant
```

This launches the cyberpunk terminal UI with push-to-talk voice interaction.

### Option C: Use the `yo` Command

For quick one-off questions without entering a chat loop:

```sh
luca yo myAssistant what documents do we have
```

### Option D: Use Programmatically in a Script

```typescript
// scripts/ask-assistant.ts
import { createContainer } from '@soederpop/luca/agi'

const container = await createContainer()
await container.helpers.discover('features')

const manager = container.feature('assistantsManager')
await manager.discover()

const assistant = manager.create('myAssistant')
const response = await assistant.ask('What documents are in the project?')
console.log(response)
```

Run with:

```sh
luca run scripts/ask-assistant.ts
```

## History Modes

When creating an assistant, you can choose how conversation history is persisted:

| Mode | Behavior |
|------|----------|
| `lifecycle` | No persistence. Conversation lost when process exits. |
| `daily` | One conversation per calendar day. Resumes if you come back the same day. (default for `luca chat`) |
| `persistent` | Single long-running thread across all sessions. Always resumes. |
| `session` | Unique per run, but can be resumed later by ID. |

Set it when creating the assistant:

```typescript
const assistant = manager.create('myAssistant', { historyMode: 'daily' })
```

## Real-World Examples

### chiefOfStaff — The Strategy Assistant

- **CORE.md**: Defines a Chief of Staff role managing ideas, projects, and plans. References the content model schema directly in the prompt so the model knows what valid documents look like.
- **tools.ts**: 7 tools — `README`, `readDocs`, `updateDocument`, `ls`, `listCodeDirectories`, `getOverallStatusSummary`, `present`. These give it full read/write access to the document collection plus git activity analysis.
- **hooks.ts**: Minimal — just a `created` hook placeholder.
- **voice.yaml**: English narrator voice, aliases include "chief".
- **docs/**: Symlinked to the project's `docs/` folder.

## Quick Start Checklist

1. `luca scaffold assistant myAssistant` — generates the folder with starter files
2. Edit `CORE.md` — define who the assistant is
3. Edit `tools.ts` — define what it can do (schemas + functions)
4. Test it: `luca chat myAssistant` or `luca yo myAssistant hello, what can you do?`
5. (Optional) Add `voice.yaml` for voice chat
6. (Optional) Edit `hooks.ts` for lifecycle events
7. (Optional) Add or symlink `docs/` for document access
