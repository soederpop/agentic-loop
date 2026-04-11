---
goal: user-experience-improvements
tags:
  - luca
  - assistants
  - ui
  - workflows
  - hot-reload
status: promoted
---

# Rebuild Assistant Designer

Rebuild the assistant designer around Luca's newer assistant APIs and authoring patterns, with a strong focus on assistants that live on disk and are edited on disk rather than constructed dynamically at runtime.

The designer should make it easy to configure the capabilities of a single assistant at a time while keeping live chat and REPL experiences hot reloadable. It should also connect cleanly to the assistant gallery workflow so an existing assistant can be opened directly for editing.

## Motivation

The Luca framework now supports assistant APIs and authoring patterns that are worth highlighting and taking advantage of in this repository.

Assistants can `use()` any feature in the Luca framework, or any framework exposing static tools, as well as the `container.describer` instance. That creates a strong opportunity for a richer assistant authoring UI that exposes these capabilities explicitly instead of hiding them behind handwritten code.

A redesigned assistant designer could provide:

- a dropdown or selector for available framework features
- controls for allowing only specific tools or explicitly forbidding tools
- UI for defining interceptors
- UI for writing custom tools and their Zod schemas
- UI for defining hooks

A lot can be borrowed from the current assistant designer, but the new version should be centered on assistants that exist on disk. The mental model should be about creating, editing, and managing persistent assistant files, not building assistants ad hoc in memory at runtime.

At the same time, the interactive experience still needs to feel live. Chat and REPL should be hot reloadable, and it should be possible to browse the conversation history for a given assistant.

The assistant gallery workflow should also include an edit action so a user can jump from browsing assistants into focused editing.

The designer itself should stay focused on one assistant at a time. There can be buttons or dropdowns to switch which assistant is being edited, but the workflow window should keep the main experience scoped to a single assistant in focus.

## Initial Shape

Potential core areas of the UI:

- assistant selection and swap controls
- feature selection
- tool allowlist / denylist controls
- interceptor editor
- custom tool editor with Zod schema support
- hooks editor
- live chat panel
- live REPL panel
- conversation history browser
- entry point from assistant gallery into focused editing

## Constraints And Direction

- The source of truth should be assistant definitions on disk.
- The UX should optimize for editing one assistant at a time.
- Runtime experimentation should support hot reload, especially for chat and REPL.
- The design should reuse strong ideas from the current assistant designer where appropriate, while dropping assumptions that revolve around runtime-only construction.
- This should be small and cohesive enough to execute through a single implementation plan.

## Implementation Guide

A repository-specific implementation guide has been prepared to teach the implementation assistant where to work and what to change:

- [Rebuild Assistant Designer Implementation Guide](../reports/rebuild-assistant-designer-implementation-guide.md)
