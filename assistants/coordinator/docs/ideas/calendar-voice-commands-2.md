---
tags:
  - voice
  - calendar
  - google-workspace
  - progressive-enhancement
  - presenter
status: exploring
goal: user-experience-improvements
---

# Calendar Voice Commands

I want to be able to say "yo friday show me my calendar" and it should render a view and present it to me with today's calendar events.

We have the `gws` feature and the `googleCalendar` feature which could be used to fetch and display these.

## Why This Matters

Calendar is the quintessential voice command domain — quick, hands-free queries about your schedule while you're in the flow of building. This directly serves the **User Experience Improvements** goal: delightful, unsurprising, and useful for daily work without leaving the terminal.

It exercises progressive enhancement:
- **Voice**: "Hey Friday, show me my calendar"
- **Typed**: `luca yo friday show me my calendar`
- **Programmatic**: `container.feature('googleCalendar').getToday()`

## What Already Exists

Everything needed is already built. No new dependencies required.

### Google Calendar Feature

`container.feature('googleCalendar')` provides a full Calendar v3 API client:

| Method | What it does |
|---|---|
| `getToday(calendarId?)` | Today's events |
| `getUpcoming(days?, calendarId?)` | Next N days of events |
| `searchEvents(query, options?)` | Freetext search across summaries, descriptions, locations |
| `listCalendars()` | All accessible calendars |
| `listEvents(options)` | Events in a time range with filtering |
| `getEvent(eventId, calendarId?)` | Single event by ID |

Authentication handled by `googleAuth` feature (already wired up).

### Presenter Feature

The `presenter` feature runs a persistent HTTP + WebSocket server that can display rich HTML views in a window. This is how the calendar view gets rendered — the handler fetches events, builds an HTML calendar card, and presents it.

### Voice Handler Pattern

Handlers in `commands/voice/handlers/` auto-discover. Drop a file, it works. The pattern is proven across `console.ts`, `draw.ts`, `monitor.ts`, `terminal.ts`.

## Voice Command Examples

| Utterance | Handler action |
|---|---|
| "Show me my calendar" | `getToday()` → present HTML calendar view |
| "What's on my calendar today?" | `getToday()` → speak summary + present view |
| "What do I have tomorrow?" | `getUpcoming(1)` → filter to tomorrow → speak + present |
| "What's my week look like?" | `getUpcoming(7)` → present week view |
| "Do I have anything about standup?" | `searchEvents('standup')` → speak matches |
| "Am I free at 3?" | `getToday()` → check for conflicts at 3pm → speak yes/no |
| "What's my next meeting?" | `getToday()` → find next upcoming → speak |

## Architecture

```
User: "Hey Friday, show me my calendar"
       │
       ▼
┌─────────────────────────────┐
│  Voice Router               │
│  match(): text includes     │
│  calendar/schedule/meeting  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Calendar Handler           │
│  1. Parse intent            │
│     (show/today/tomorrow/   │
│      week/search/free)      │
│  2. googleCalendar.getX()   │
│  3. Build HTML calendar     │
│     view with events        │
│  4. presenter.present(html) │
│  5. speakPhrase(summary)    │
└──────────────┬──────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌─────────────┐ ┌─────────────┐
│  Presenter  │ │  TTS Output │
│  HTML view  │ │  "You have  │
│  in window  │ │  3 events   │
│             │ │  today..."  │
└─────────────┘ └─────────────┘
```

The handler lives in `commands/voice/handlers/apps/calendar.ts`.

For complex or ambiguous requests, the handler can fall through to the voice assistant (Friday) for conversational follow-up.

## Delivery Roadmap (Skateboard → Car)

### Skateboard: Today's Calendar — Spoken + Presented

- Single handler: `commands/voice/handlers/apps/calendar.ts`
- Matches: "calendar", "schedule", "meetings"
- Calls `getToday()`, formats events as a spoken summary via `ctx.speakPhrase()`
- Renders an HTML calendar card via the presenter feature and opens it in a window
- **Works immediately if Google auth is configured**

### Bicycle: Time-Aware Queries + Richer Views

- Parse "tomorrow", "this week", "next Monday" into date ranges
- "Am I free at [time]?" conflict detection
- "What's my next meeting?" — scans forward from now
- Week view in the presenter with day-by-day layout
- Dictionary entries in `dictionary.yml` for calendar terms

### Motorcycle: Search & Multi-Calendar

- "Do I have anything about [topic]?" → `searchEvents(query)`
- Multi-calendar support ("what's on the team calendar?")
- Richer presenter views with color-coded calendars

### Car: Calendar Write Operations

- "Schedule a meeting with [person] at [time]" → create event
- "Move my 3 o'clock to 4" → update event
- "Cancel my standup" → delete event
- Confirmation flow via voice before writes

## References

- Google Calendar feature: `luca describe googleCalendar`
- Presenter feature: `luca describe presenter`
- Voice handler guide: `docs/guides/creating-new-voice-command-handlers.md`
- Handler examples: `commands/voice/handlers/apps/console.ts`, `monitor.ts`
- Voice handler types: `commands/voice/types.ts`
- Voice router: `features/voice-router.ts`
- Google auth: `luca describe googleAuth`
