---
status: pending
project: rebuild-assistant-designer
---

# Backend API and Assistant File Endpoints

Expose the assistant filesystem through HTTP endpoints so that any client (browser UI, CLI, or script) can list assistants, read their metadata, read and write their definition files, and trigger reloads. This is the foundation that all later stages build on.

The deliverable at this stage is a set of REST endpoints added to `commands/web-chat.ts` plus a CLI or curl-based demo proving they work end to end. No browser UI changes yet — this stage is verifiable entirely from the terminal.

### What to build

- **GET /api/assistants** — list all discovered assistants with metadata (id, name, description, available files)
- **GET /api/assistants/:id** — full metadata for a single assistant including parsed CORE.md frontmatter, list of files (tools.ts, hooks.ts, voice.yaml, ABOUT.md, etc.)
- **GET /api/assistants/:id/files/:filename** — read the raw content of an assistant file
- **PUT /api/assistants/:id/files/:filename** — write content back to an assistant file on disk
- **POST /api/assistants/:id/reload** — trigger runtime reload of the assistant after edits
- **GET /api/assistants/:id/history** — list conversation history sessions for the assistant
- **GET /api/features** — list available Luca features that assistants can `use()`

All endpoints should use the existing assistants manager for discovery and the container's fs feature for file I/O. The reload endpoint should use the assistant runtime's existing reload capabilities.

## References

- `commands/web-chat.ts` — current HTTP/WebSocket composition point
- `features/chat-service.ts` — assistant session and runtime management
- `assistants/` — source of truth for disk-based assistants
- `assistants/chiefOfStaff/` — representative assistant folder structure
- [Implementation Guide](../../reports/rebuild-assistant-designer-implementation-guide.md)

## Test plan

- `curl GET /api/assistants` returns a JSON array of all discovered assistants with id and name
- `curl GET /api/assistants/chiefOfStaff` returns full metadata including file list
- `curl GET /api/assistants/chiefOfStaff/files/CORE.md` returns the raw markdown content
- `curl PUT /api/assistants/chiefOfStaff/files/ABOUT.md` with a body writes the file to disk and the change is visible via `cat`
- `curl POST /api/assistants/chiefOfStaff/reload` succeeds and subsequent chat messages use the updated assistant definition
- `curl GET /api/features` returns a list of available Luca framework features
- All endpoints return appropriate error codes for missing assistants or files (404)
- No existing web-chat functionality is broken by the additions
