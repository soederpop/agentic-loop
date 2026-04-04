# Comms Workflow — Implementation Plan

## Context

The project has three communication channels (iMessage, Telegram, GWS) with existing features but no unified management UI. The `imsg` CLI is installed; GWS CLI and Telegram token are not set up yet. A stub `communications.ts` feature exists but isn't wired into assistant reactions. The user wants a single workflow UI to install, configure, test, and manage all channels plus configure how assistants react to incoming messages.

## Files to Create

```
workflows/comms/
  ABOUT.md              # workflow metadata
  hooks.ts              # Express API routes
  public/
    index.html          # single-file SPA
```

Also update: `config.example.yml` (add gws section, telegram detail, reactionRules)

## Architecture

### hooks.ts — API Endpoints

Follows the setup workflow pattern (`workflows/setup/hooks.ts`). Helpers: `execQuiet()`, `whichBin()`, `envKeyPresent()`, `readConfig()`, `writeConfig()`.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/channels/status` | All 3 channels: installed, configured, running, config, errors |
| `POST /api/channels/:channel/install` | Run install command (brew install imsg, npm i -g @googleworkspace/cli) |
| `PUT /api/config/channel/:channel` | Save channel config to config.yml |
| `POST /api/env` | Save env vars (.env) — allowlist: TELEGRAM_BOT_TOKEN |
| `POST /api/channels/:channel/test` | Test connectivity (imsg.chats, telegram.getMe, gws.checkAuth) |
| `POST /api/channels/:channel/test-send` | Send test message via channel |
| `GET /api/reaction-rules` | List all reaction rules from config.yml |
| `POST /api/reaction-rules` | Create new rule |
| `PUT /api/reaction-rules/:id` | Update rule |
| `DELETE /api/reaction-rules/:id` | Delete rule |
| `GET /api/assistants` | List available assistants (for rule assignment) |

Config read/write: Direct `yaml.parse` / `yaml.stringify` on `config.yml` via container fs/yaml features (same as preferences feature but with write support).

### public/index.html — UI Layout

5-tab SPA using the project's dark design system (--bg: #151520, --accent: #00fff7, monospace font):

1. **Overview** — 3 channel status cards (installed/configured/running dots), summary bar
2. **iMessage** — install status, config form (enabled toggle, trustedSenders list), test connection, send test
3. **Telegram** — token input, config form (enabled, trustedSenders, mode dropdown, polling options, webhook fields), test bot (getMe), send test
4. **Google Workspace** — install GWS CLI, auth setup, profile management, test auth, Gmail test
5. **Reactions** — rule list with enable/disable toggles, add/edit rule form (channel, assistant, filters, action type, prompt template)

Browser-side follows the setup workflow's Feature pattern: CommsApi (fetch wrapper), CommsStore (state), CommsApp (orchestrator), event-driven rendering.

### Reaction Rules Schema (in config.yml)

```yaml
reactionRules:
  - id: "uuid"
    name: "Chief handles trusted iMessage"
    channel: imsg
    assistant: chiefOfStaff
    enabled: true
    filters:
      trustedSendersOnly: true
      senderMatch: ""        # regex
      textMatch: ""          # regex
      commandPrefix: ""      # telegram commands
    action:
      type: auto-reply       # auto-reply | notify | log
      promptTemplate: "Message from {{sender}} on {{channel}}: {{text}}"
      maxResponseLength: 500
```

## Build Sequence (iterative delivery)

### Checkpoint 1: Skeleton + Overview
- ABOUT.md
- hooks.ts with `GET /api/channels/status` (checks imsg binary, telegram token, gws binary)
- index.html with tab nav + Overview tab showing 3 channel cards with live status

### Checkpoint 2: Channel Config Tabs
- iMessage tab: install check, config form, save to config.yml
- Telegram tab: token input, config form with all telegram options
- GWS tab: install check, auth status, profile selector

### Checkpoint 3: Test & Install Actions
- Install endpoints (auto-install where safe, instructions otherwise)
- Test connectivity endpoints per channel
- Test send functionality
- UI wiring for all action buttons

### Checkpoint 4: Reaction Rules
- Rules CRUD endpoints
- Assistants list endpoint
- Reactions tab UI: list, add, edit, delete, enable/disable

## Reference Files
- `workflows/setup/hooks.ts` — hooks pattern, helpers, env management
- `workflows/setup/public/index.html` — UI pattern, design system, Feature classes
- `features/communications.ts` — channel hub (access for status)
- `features/imsg.ts` — iMessage feature API
- `features/gws.ts` — GWS feature API
- `features/preferences.ts` — config.yml reading pattern
- `config.example.yml` — config schema to extend

## Verification
1. `luca serve --setup workflows/comms/luca.serve.ts --endpoints-dir workflows/comms/endpoints --staticDir workflows/comms/public --port 7700 --no-open --force` (or since this uses hooks.ts pattern, just navigate to the workflow via the workflow service)
2. Overview tab shows imsg as installed, telegram/gws as needing setup
3. iMessage config saves to config.yml and test returns chats
4. Telegram token saves to .env, test calls getMe successfully
5. Reaction rules CRUD works — rules persist in config.yml across page refreshes
