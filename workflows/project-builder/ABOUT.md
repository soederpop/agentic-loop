---
title: Project Builder
description: Build projects by executing their plans with real-time progress tracking and an AI chat assistant
port: 9320
tags:
  - build
  - projects
  - assistant
  - chat
---

# Project Builder

An interactive build session for a project. Shows the project overview and all its plans with real-time build progress, then lets you chat with any available assistant about the project while building. Select a project, pick an assistant, run the build, and watch plans execute live.

## When to use

Use this when the user wants to actually build a project — execute its plans, monitor progress, and have an assistant available for questions or guidance during the build.

## Trigger signals

- "Build [project name]"
- "Run the plans for [project name]"
- "Execute [project name]"
- "Start building [project name]"
- "I want to build [project name] with the project builder"

## When NOT to use

- If the user wants to review a project without building — use **Project Reviewer** instead
- If the user wants a quick status overview — use **Status Briefing** instead
- If the user hasn't created any projects yet — there's nothing to build
