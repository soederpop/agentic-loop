---
goal: user-experience-improvements
tags:
  - window-manager
  - workflows
  - screenshots
  - screen-recording
  - excalidraw
  - docs
  - authoring
  - ux
status: exploring
---

# Window Managed Visual Workflow Authoring

We now have a new window-manager assistant, the ability to screenshot windows and record videos, and a desire to make all the spawned windows across assistants and workflows appear in useful, organized layouts instead of forcing manual rearrangement. On top of that, there is a specific authoring workflow idea: draw something in Excalidraw, write a doc that references the drawing, and have the system automatically embed that drawing as a PNG or similar rendered asset.

## Motivation

As the Agentic Loop gets more visual and more multi-window, the desktop experience itself becomes part of the product. Right now, every extra window, browser tab, workflow UI, or helper app can increase friction if it appears in the wrong place or requires manual cleanup. A smarter layout system would make active work feel intentional instead of chaotic.

There is also a strong content-authoring opportunity here. If we can connect visual creation tools like Excalidraw to docs authoring, screenshots, and maybe video capture, we can create richer specs, tutorials, and plans with much less manual asset wrangling.

This helps with:
- **User Experience Improvements**: cleaner window layouts, less friction, more visual clarity
- **Adoption and demos**: the system looks more polished and easier to understand when windows open in predictable places and docs can include visuals automatically
- **Documentation velocity**: diagrams, screenshots, and recordings become first-class parts of the workflow

## Raw Shape Of The Idea

A possible combined system could include:

- **Window-manager-aware assistants/workflows**
  - when a workflow opens browser windows, terminals, editors, or helper apps, they are placed into a predefined layout automatically
  - layouts could be task-specific (coding, reviewing plans, dashboard monitoring, voice command debugging, doc writing)

- **Window capture primitives**
  - assistants can screenshot a target window or region
  - assistants can record short videos or walkthrough clips of a workflow/session
  - captures can be referenced from docs or reports

- **Visual doc authoring flow**
  - create or edit a diagram in Excalidraw
  - reference the diagram from a markdown doc
  - system exports/renders the drawing to PNG (or SVG) automatically
  - resulting asset gets embedded or linked in the rendered doc without manual export steps

- **Reusable authoring workflow**
  - maybe a workflow specifically for writing tutorials/specs/reports with attached diagrams, screenshots, and videos
  - could eventually support “capture current layout,” annotate, and insert into docs

## Questions To Explore Tomorrow

- How should assistants declare desired window layouts when launching tools or workflows?
- Should layouts be predefined templates, dynamic rules, or both?
- What is the API for screenshotting/recording a specific window?
- How do docs reference visual assets — special syntax, frontmatter, shortcode, or plain markdown image links?
- What is the best integration point for Excalidraw export: file watcher, workflow action, doc renderer hook, or assistant tool?
- Should this become one project, or split into:
  - window layout orchestration
  - visual capture tools
  - visual doc authoring / Excalidraw embedding
- What is the thinnest useful version we can build first?

## What Success Might Look Like

- Spawned windows open in sane, predictable layouts for common workflows
- Assistants can intentionally arrange the desktop for the task at hand
- Screenshots and recordings are easy to capture and reuse
- Docs can reference drawings and have them auto-render into embedded assets
- Specs, reports, and tutorials become much richer and easier to produce
