---
agent: claude
createdBy: soederpop
running: false
---

# Fix assistant-designer OpenAI / LM Studio integration

## Summary

The `workflows/assistant-designer` workflow has multiple correctness and design issues in its OpenAI-compatible path.

The biggest immediate bug is that it calls `client.sdk.chat.completions.create(...)`, but the Luca OpenAI client does not expose `sdk`; it exposes `raw` for direct SDK access and wrapper methods like `createChatCompletion`, `streamResponse`, and `listModels`.

This task should make assistant-designer consistent with the Luca OpenAI client abstraction, preserve LM Studio compatibility, and fix message / tool-call loop bugs so the workflow behaves correctly across Anthropic, OpenAI, and LM Studio.

---

## Files involved

- `workflows/assistant-designer/luca.serve.ts`
- `workflows/assistant-designer/endpoints/chat.ts`
- `workflows/assistant-designer/endpoints/sample-tool.ts`
- `workflows/assistant-designer/endpoints/models.ts`
- `workflows/assistant-designer/public/index.html`
- Reference client docs / implementation:
  - `node_modules/@soederpop/luca/src/clients/openai/index.ts`
  - `node_modules/@soederpop/luca/docs/apis/clients/openai.md`

---

## Confirmed problems

### 1) Incorrect OpenAI client property

In these files:

- `workflows/assistant-designer/endpoints/chat.ts`
- `workflows/assistant-designer/endpoints/sample-tool.ts`

The workflow currently does this:

```ts skip
const stream = await client.sdk.chat.completions.create(params)
```

That is incorrect for Luca's OpenAI client.

The Luca client exposes:

- `client.listModels()`
- `client.createChatCompletion(...)`
- `client.createResponse(...)`
- `client.streamResponse(...)`
- `client.raw`

It does **not** expose `client.sdk`.

#### Required fix

Replace direct usage of `client.sdk`.

Use one of:

```ts skip
client.raw.chat.completions.create(...)
```

or, where appropriate, Luca wrapper methods.

Because assistant-designer is doing streaming tool calls against chat completions for OpenAI-compatible providers, `client.raw.chat.completions.create(...)` is probably the safest direct replacement for now.

---

### 2) REPL docs are misleading

The REPL help text in `public/index.html` says:

```js
// `getOpenAIClient()` — OpenAI SDK client for current provider
```

That is misleading.

`getOpenAIClient()` returns the Luca client wrapper, not the raw SDK.

#### Required fix

Update the REPL help text to something like:

```js
// `getOpenAIClient()` — Luca OpenAI client for current provider
// use `.raw` for direct SDK access
```

Optionally update `luca.serve.ts` comments similarly.

---

### 3) OpenAI path stores duplicate / divergent history representations

In `endpoints/chat.ts`, the OpenAI flow does this:

- converts `state.messages` into OpenAI messages once via `convertToOpenAIMessages(...)`
- streams a response
- appends assistant content back into `state.messages` in Anthropic-style block format
- when tool calls occur, also mutates the local `messages` array directly by pushing:
  - `assistantMsg`
  - `{ role: 'tool', tool_call_id, content }`

This means two separate histories are being maintained:

1. canonical `state.messages`
2. local `messages` used for the loop

That is fragile and easy to desync.

#### Risk

- follow-up loops may diverge from persisted state
- conversions may drift over time
- debugging becomes harder

#### Required fix

Refactor the OpenAI chat loop so there is exactly one clear source of truth during each turn.

Recommended approach:

- keep `state.messages` as the canonical persisted workflow history
- at the start of each loop iteration, derive OpenAI messages fresh from `state.messages`
- after each streamed assistant turn, append the normalized assistant message to `state.messages`
- after mock tool execution, append normalized tool-result blocks to `state.messages`
- then regenerate the OpenAI-format messages from canonical state before the next request

Do **not** keep incrementally mutating a separate long-lived `messages` array across loop iterations unless there is a very explicit reason.

---

### 4) Tool-call streaming emits duplicate `tool_start` events

In both OpenAI endpoints, tool start events are emitted whenever a chunk includes a function name.

Files:

- `workflows/assistant-designer/endpoints/chat.ts`
- `workflows/assistant-designer/endpoints/sample-tool.ts`

Current pattern:

```ts skip
if (tc.function?.name) {
  send('tool_start', { id: ..., name: tc.function.name })
}
```

Because streamed tool calls may repeat the name across chunks, this can produce multiple `tool_start` events for the same tool call.

#### Required fix

Emit `tool_start` only once per tool call id / index.

Track a set/map like:

- `startedToolCallsById`
- or per-index state

Only send `tool_start` the first time a tool call becomes identifiable.

---

### 5) Tool-call id handling in `sample-tool.ts` is brittle

`sample-tool.ts` tracks a single:

- `toolArgs`
- `toolId`

That assumes one tool call and assumes chunks arrive in a simple order.

This may be okay if tool choice is forced to a single tool, but it is still brittle because:

- the tool id may arrive after earlier argument chunks
- streamed chunks may be split unpredictably
- duplicate `tool_start` can happen

#### Required fix

Refactor the OpenAI sampler to accumulate tool-call state by tool-call index, just like the main chat flow should.

Even if only one tool is expected, use the same robust streamed assembly pattern:

- map by `tc.index`
- gather `id`, `name`, `arguments`
- emit `tool_start` once
- at end, parse arguments and emit `tool_complete`

This keeps sampler logic aligned with chat logic.

---

### 6) Model/provider validation is too weak

In `endpoints/state.ts`, the workflow accepts arbitrary:

- `provider`
- `model`
- `tools`
- token values
- temperature

with no validation.

That means the UI or a caller can create invalid combinations, such as:

- `provider: 'openai'` with an Anthropic model id
- `provider: 'anthropic'` with an OpenAI model id
- malformed tools or schemas

The UI usually tries to keep things aligned, but the server should not trust the client.

#### Required fix

Add validation in `state.ts` at least for:

- provider enum: `anthropic | openai | lm-studio`
- `model` must be a string
- `maxTokens` positive integer in reasonable range
- `temperature` bounded numeric value
- `tools` must be an array with expected shape

At minimum, reject obviously invalid provider values and malformed tool definitions.

Optional but recommended:

- on provider/model mismatch, either reject or auto-correct
- add a shared schema for `DesignerState` updates

---

### 7) OpenAI model filtering may be too simplistic

In `endpoints/models.ts`, OpenAI models are filtered with hardcoded prefixes and exclusions.

This is okay as a heuristic, but it may exclude valid chat-capable models or include incompatible ones over time.

#### Required fix

Keep the current heuristic if needed, but document that it is heuristic-only.

Optional improvements:

- centralize model capability filtering logic
- annotate whether a model is intended for `chat.completions` vs `responses`
- be explicit that LM Studio is treated as OpenAI-compatible chat-completions only

---

### 8) OpenAI path is using low-level raw SDK while models endpoint uses wrapper methods

`models.ts` correctly uses:

```ts skip
const openai = container.client('openai')
await openai.listModels()
```

But `chat.ts` and `sample-tool.ts` bypass the wrapper.

This inconsistency is not inherently fatal, but it should be intentional.

#### Required fix

Choose and document one of these approaches:

### Option A — preferred
Use Luca wrapper methods wherever they fit, and `client.raw` only where streaming/tool-call compatibility requires it.

### Option B
Use `client.raw` consistently for advanced chat-completion streaming in assistant-designer, but make that explicit in comments.

Either way, remove the nonexistent `sdk` usage and make the abstraction boundary clear.

---

### 9) Frontend state tracking for chat history is lossy / confusing

In `public/index.html`, after `/api/chat` completes, the UI does:

```js
state.messages = []; // We track via server
```

That is confusing because:

- earlier, `state.messages.push({ role: 'user', content: msg })` is done optimistically
- then client-side state is discarded
- the UI renders messages from stream events rather than canonical history

This may not break functionality directly, but it makes debugging harder.

#### Required fix

Clean up client-side chat state handling.

Recommended:

- either stop pretending `state.messages` is maintained client-side
- or reload canonical history from `/api/messages` after each turn

At minimum, remove misleading local state behavior and comments.

---

### 10) Export format is Anthropic-shaped only

`endpoints/export.ts` exports:

```json
{
  "model": "...",
  "system": "...",
  "max_tokens": ...,
  "temperature": ...,
  "tools": [
    {
      "name": "...",
      "description": "...",
      "input_schema": { ... }
    }
  ]
}
```

That is fine for Anthropic-ish configs, but assistant-designer supports OpenAI-compatible providers too.

#### Required fix

Decide whether export is:

- provider-neutral canonical designer config
- Anthropic-oriented config
- or provider-specific export

Then label/document it accordingly.

At minimum:

- document the format clearly
- avoid implying that the export is equally native for Anthropic and OpenAI if it is not

---

## Recommended implementation plan

### Phase 1 — correctness fixes

1. Replace `client.sdk` with the correct access pattern.
2. Fix REPL/help text to reflect Luca client vs raw SDK.
3. Deduplicate `tool_start` emission.
4. Refactor `sample-tool.ts` tool-call assembly to be index-based and robust.
5. Add basic validation to `/api/state`.

### Phase 2 — history/tool-loop cleanup

6. Refactor `streamOpenAI(...)` to use a single canonical message history flow.
7. Ensure assistant + tool_result turns are appended to canonical state cleanly.
8. Rebuild OpenAI-format messages from canonical state for each loop iteration.
9. Verify tool loops work for:
   - plain text reply
   - one tool call
   - multiple sequential tool calls
   - tool call followed by final text answer

### Phase 3 — UX/docs cleanup

10. Clarify provider/model/export semantics.
11. Clean up frontend chat state assumptions.
12. Update ABOUT/docs/comments to explain OpenAI vs LM Studio behavior.

---

## Acceptance criteria

### OpenAI client correctness

- No code in assistant-designer references `client.sdk`
- Any low-level SDK use goes through `client.raw`
- Wrapper methods are used where appropriate

### Chat correctness

For `provider = openai`:

- plain text chat streams correctly
- tool calls stream correctly
- `tool_start` is emitted once per tool call
- tool args are assembled correctly from streamed chunks
- mock tool results are fed back into the next completion turn
- final assistant answer appears after tool result loop

For `provider = lm-studio`:

- model listing still works when LM Studio is available
- tool sampling works
- chat with tool calls works at least as well as the OpenAI path, within LM Studio limitations

For `provider = anthropic`:

- no regressions in existing chat/tool behavior

### State correctness

- `/api/state` rejects malformed provider values
- malformed tool definitions do not silently poison server state
- canonical server-side message history remains coherent after a full tool loop

### UI/docs correctness

- REPL help text accurately describes `getOpenAIClient()`
- frontend no longer implies nonexistent local message state ownership
- export format is documented honestly

---

## Suggested test matrix

### Providers

- Anthropic
- OpenAI
- LM Studio (if running locally)

### Scenarios

1. No tools, plain user chat
2. One tool, forced tool usage
3. One tool, model decides whether to call it
4. Multiple tools available, one selected
5. Tool call returns mock result, assistant continues and finishes
6. Sampler with forced tool choice
7. Clear messages, then chat again
8. Switch providers and models from UI and verify state remains valid

---

## Nice-to-haves

- Consider introducing a shared message normalization module for Anthropic/OpenAI conversions.
- Consider using Luca's conversation feature for at least part of this workflow if it simplifies tool-loop handling.
- Consider surfacing provider-specific capability notes in the UI, especially for LM Studio.

---

## One-line brief for the boys

Fix assistant-designer so its OpenAI-compatible path uses the Luca OpenAI client correctly, assembles streamed tool calls robustly, keeps canonical history coherent, validates state updates, and documents provider/export behavior clearly.
