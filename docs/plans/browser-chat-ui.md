---
status: pending
project: projects/web-based-chief-chat
---

# Browser Chat UI Page

Create a self-contained `public/chief-chat/index.html` page that provides a chat interface for the Chief of Staff assistant. No build step — plain HTML, CSS, and JS. Uses the Luca browser WebContainer (`window.luca`) for WebSocket communication with the server-side handler built in the previous plan.

### Approach

1. Create `public/chief-chat/index.html` as a single file with embedded CSS and JS
2. Match the existing design language: deep-blue (`#0c1220`) + gold (`#d4a73a`) palette, Bricolage Grotesque + Fragment Mono fonts (from the architecture dashboard in `public/index.html`)
3. Import the Luca browser container via `https://esm.sh/@soederpop/luca@0.0.11/src/browser.ts`
4. On load, generate or retrieve a `sessionId` from `localStorage`, connect via WebSocket, send `init` to hydrate the conversation
5. Render messages with basic markdown support (code blocks, bold, links at minimum)
6. Show tool calls in-flight with name and a spinner/indicator, then show completion
7. Provide a "Clear" button that sends `clear_thread`, clears `localStorage` sessionId, and resets the UI
8. Auto-scroll to latest message, support Enter to send and Shift+Enter for newlines

### Key constraints

- No build step, no framework — vanilla HTML/CSS/JS in a single file
- Must feel native to the existing dashboard aesthetic
- Tool call visibility is required (not optional)
- Thread persistence across page reloads via sessionId in localStorage

## References

- Idea doc: `docs/ideas/web-based-assistant-chat-application.md` — design language and UX requirements
- Existing dashboard: `public/index.html` — visual identity reference
- Luca browser container: `https://esm.sh/@soederpop/luca@0.0.11/src/browser.ts`
- Presenter feature: `features/presenter.ts` — reference for how the browser container is injected into HTML

## Test plan

- Open `http://localhost:3000/chief-chat` in a browser and verify the page loads with the correct styling
- Type a message and send — verify the assistant response streams in with visible text deltas
- Trigger a tool call (e.g. ask Chief about project status) — verify the tool call indicator appears and resolves
- Reload the page — verify the previous conversation reappears from thread hydration
- Click Clear — verify the conversation resets and a new sessionId is generated
- Verify Enter sends, Shift+Enter inserts a newline
