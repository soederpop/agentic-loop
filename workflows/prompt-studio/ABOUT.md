---
title: Prompt Studio
description: Author, preview, and run prompt documents with notebook-style code block execution
tags:
  - prompts
  - authoring
  - notebook
---

# Prompt Studio

An interactive environment for authoring and running prompt documents (`docs/prompts/*.md`).

## What it does

- Browse and edit prompt documents
- Run TypeScript code blocks individually (notebook-style) via server-side VM
- Preview rendered markdown with block outputs
- Built-in REPL with full container access
- Edit frontmatter metadata (inputs, agentOptions, assistant)
- Execute prompts via `luca prompt` with streaming output

## When to use

- User says "I want to write a prompt" or "edit my prompts"
- User says "open the prompt editor" or "prompt studio"
- User wants to test code blocks in a prompt document
- User wants to preview what a prompt looks like before running it
- User wants to run a prompt and see streaming output

## When NOT to use

- User wants to review or edit projects (use project-builder)
- User wants to build a project (use project-builder)
- User is working on tasks or plays (different document types)
