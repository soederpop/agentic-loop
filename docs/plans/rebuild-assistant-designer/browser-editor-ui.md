---
status: completed
project: rebuild-assistant-designer
---

# Browser Editor UI

Build the browser-based assistant designer interface that uses the backend API from stage 1. The goal is a split-pane editor where a user can select an assistant, view and edit its definition files, configure features and tools, and save changes back to disk.

This stage produces a usable browser UI for editing assistants — no live chat or hot reload yet, just the authoring and configuration experience.

### What to build

- **Assistant selector** — dropdown or sidebar listing all assistants from `/api/assistants`, with the ability to switch which assistant is in focus
- **File editor tabs** — tabs for each assistant file (CORE.md, tools.ts, hooks.ts, ABOUT.md, voice.yaml) loaded from the file read endpoint, editable with a code/text editor area, and saveable via the file write endpoint
- **Feature selector** — UI to browse available features from `/api/features` and toggle which ones the assistant uses, writing changes back to CORE.md or the appropriate config
- **Tool allowlist/denylist** — controls for specifying which tools are allowed or forbidden
- **Gallery edit entry** — if the assistant gallery workflow exists, add an "Edit" action that opens the designer focused on that assistant
- **Save and reload** — save button that writes files and triggers the reload endpoint so the assistant picks up changes

The UI should be built as a single-file `index.html` in the Luca browser container pattern (load from esm.sh, composable Features). It can either extend `public/web-chat/index.html` or live at a dedicated route like `/designer/`.

## References

- `public/web-chat/index.html` — existing browser UI patterns and websocket integration
- Backend API endpoints from stage 1
- [Implementation Guide](../../reports/rebuild-assistant-designer-implementation-guide.md)
- Luca browser container pattern (ApiClient → Store → App)

## Test plan

- Opening the designer URL in a browser shows the assistant selector populated with all discovered assistants
- Selecting an assistant loads its files into editor tabs
- Editing a file and clicking save writes the changes to disk (verified by reading the file on disk)
- The feature selector shows available Luca features and reflects the current assistant's configuration
- Tool allowlist/denylist controls update the assistant definition when saved
- The reload button triggers assistant reload and the UI confirms success
- Switching assistants clears the editor and loads the new assistant's files
- The gallery edit action (if gallery workflow exists) navigates to the designer with the correct assistant pre-selected
