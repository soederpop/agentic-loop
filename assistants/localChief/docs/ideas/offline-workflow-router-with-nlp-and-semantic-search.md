---
goal: user-experience-improvements
tags:
  - workflows
  - routing
  - nlp
  - semantic-search
  - offline
  - luca
status: parked
---

# Offline Workflow Router With NLP And Semantic Search

Design a local, fast, offline-capable router that maps natural language user requests onto workflows by combining Luca's `nlp` feature with its local `semanticSearch` feature and the existing `workflowLibrary` discovery layer.

The core idea is to treat each workflow as a routeable object with a small manifest of names, aliases, tags, and example phrases, then route a user utterance through a hybrid pipeline that prefers exact and explainable matches first, and falls back to semantic retrieval only when needed.

## Motivation

Workflows are becoming a primary interaction surface, but users do not naturally think in exact workflow names. They say things like:

- draw the auth flow
- show me the deployment status workflow
- help me plan a task for this repo
- make a diagram of the login system

A good workflow system should accept those natural phrases and reliably map them to the right workflow without requiring an LLM roundtrip or a cloud dependency for every request.

Luca already appears to provide the key building blocks:

- `nlp.parse()`, `nlp.analyze()`, and `nlp.understand()` for extracting verbs, nouns, subjects, tokens, and entities
- `semanticSearch.search()`, `vectorSearch()`, and `hybridSearch()` for local retrieval over indexed workflow descriptions
- `workflowLibrary` for discovering workflows and running them

That makes an offline workflow router feel like a composition opportunity more than a greenfield invention.

## Proposed Shape

Each workflow would expose or derive a routing manifest something like:

```ts
type RouteableWorkflow = {
  id: string
  name: string
  summary: string
  tags: string[]
  aliases: string[]
  phrases: string[]
  verbs: string[]
  nouns: string[]
  examples: string[]
}
```

The router would build a synthetic search document per workflow containing:

- workflow name
- summary or ABOUT content
- aliases
- tags
- example phrases
- canonical verbs and nouns

Those synthetic documents would be indexed locally with `semanticSearch.indexDocuments()`.

## Routing Strategy

The likely best approach is a multi-stage hybrid router.

### 1. Workflow discovery and manifest building

At startup or on demand:

- load workflows from `workflowLibrary`
- derive routing metadata from each workflow's ABOUT docs or manifest
- build a normalized in-memory dictionary for exact matching
- build or refresh a local semantic index for all workflows

### 2. Cheap NLP normalization

On each user request:

- call `nlp.understand(input)`
- extract `intent`, `target`, `subject`, tokens, and entities
- normalize the utterance into a few routing query forms

This step gives the router structured hints such as:

- intent: draw
- target: diagram
- subject: auth flow

### 3. Deterministic lexical scoring

Before semantic retrieval, score workflows with cheap local rules such as:

- exact workflow name match
- exact alias match
- exact phrase match
- tag match
- intent-to-verb match
- target-to-noun match

This stage should be preferred when confidence is high because it is:

- extremely fast
- easy to debug
- predictable
- likely best for explicit commands

### 4. Semantic fallback or reranking

If deterministic scoring does not produce a confident result, query the local semantic index with:

- `semanticSearch.search()` for keyword-heavy routing
- `semanticSearch.hybridSearch()` for combined lexical and vector ranking

Semantic retrieval would help with paraphrases and near-matches such as:

- make a picture of the login architecture
- map out how auth works
- sketch the payment flow

### 5. Confidence thresholds and clarification

The router should not force a result every time. It should return one of three modes:

- high confidence: route immediately
- medium confidence: ask a clarification question with top candidates
- low confidence: fall back to a general assistant or workflow search UI

## Why This Seems Strong

This design has a few advantages over a pure embedding-only router.

### Explainability

Exact alias and phrase matches can be surfaced directly in diagnostics, which is important for tuning and user trust.

### Speed

Many requests can terminate in the in-memory lexical phase without needing semantic retrieval.

### Robustness to paraphrase

When exact matching fails, the local semantic index can still recover likely workflows from examples and summaries.

### Offline operation

As long as the local search index and embedding support are available, routing can remain entirely on-device.

## A Luca-Native Feature Shape

A dedicated feature could make this reusable:

```ts
container.feature('workflowRouter')
```

It might expose methods like:

- `rebuildIndex()`
- `route(text)`
- `inspect(text)`
- `suggest(text)`
- `watchAndReindex()`

This would mirror the spirit of `voiceRouter.inspect()` by making routing observable and debuggable rather than opaque.

## Example Route Result

A useful return shape might be:

```ts
{
  input: "draw the auth flow",
  parsed: {
    intent: "draw",
    target: "flow",
    subject: "auth"
  },
  topDeterministicMatches: [
    { workflow: "draw-diagram", score: 92, reason: "alias + verb match" }
  ],
  topSemanticMatches: [
    { workflow: "draw-diagram", score: 0.88 },
    { workflow: "architecture-review", score: 0.51 }
  ],
  finalChoice: "draw-diagram",
  confidence: "high"
}
```

## Open Questions

- Should routing metadata live in each workflow's `ABOUT.md`, a separate manifest, or be inferred automatically?
- Should semantic indexing happen eagerly at startup or lazily on first route request?
- Should this router be workflow-specific, or generalized into a broader "thing router" for commands, assistants, prompts, and workflows?
- What local embedding provider and model make the best tradeoff between startup cost and quality?
- How should the system watch for workflow changes and reindex incrementally?
- What confidence thresholds produce the best UX without being too eager or too timid?

## Why This Is Parked

The idea seems very aligned with the existing Luca feature set, but it is not yet clear whether the immediate need is:

- workflow-specific routing
- a broader command router
- voice-first routing
- assistant-first workflow suggestion

It is also likely worth first standardizing how workflows expose summary, aliases, tags, and example phrases before building a dedicated router on top.

For now, this looks like a strong composition idea that should remain parked until the workflow metadata shape is more settled or a concrete UX path demands it.
