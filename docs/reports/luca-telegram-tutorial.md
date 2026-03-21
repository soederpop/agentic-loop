# Luca Telegram feature: receive messages and emit events

This tutorial explains how to use Luca’s built-in **Telegram** feature (powered by [grammY](https://grammy.dev/)) with your bot token, and how to **emit events whenever Telegram receives a message**.

Source of truth in this repo:

- `node_modules/@soederpop/luca/src/node/features/telegram.ts`

## What the Telegram feature is

Luca implements a feature called `telegram`:

- It wraps a grammY `Bot` instance.
- It can run in **polling** mode (default) or **webhook** mode.
- It exposes helper methods:
  - `tg.command(name, handler)` – registers a Telegram command and also emits a Luca event.
  - `tg.handle(filter, handler)` – register a grammY update handler (for any update type).
  - `tg.use(middleware)` – add grammY middleware.
  - `tg.start()` / `tg.stop()` – start/stop receiving updates.

It also emits these **feature events** (on Luca’s feature event bus):

- `started` – when the bot starts (payload: `{ mode }`)
- `stopped`
- `error` – when grammY throws
- `command` – emitted when a registered command triggers (payload: `[name, ctx]`)
- `webhook_ready` – when webhook is registered (payload: `[fullUrl]`)

## 1) Minimal setup (polling)

Polling is easiest: no public URL required.

```ts
// somewhere in your node entrypoint where you have a container
const tg = container.feature('telegram', {
  token: process.env.TELEGRAM_BOT_TOKEN, // or omit if env var is set
  mode: 'polling',
  autoStart: true,
  // optional tuning:
  // pollingTimeout: 1,
  // allowedUpdates: ['message', 'callback_query'],
})

// optional: react to lifecycle
// (Feature base class typically provides .on(event, handler))
// tg.on('started', ({ mode }) => console.log('tg started', mode))
// tg.on('error', (err) => console.error('tg error', err))
```

Notes:

- The token is read from `options.token` or `process.env.TELEGRAM_BOT_TOKEN`.
- `autoStart: true` calls `tg.start()` during `enable()`.

## 2) Emit an event for every incoming message

The Telegram feature provides `tg.handle(filter, handler)` which is a thin wrapper over `bot.on(filter, handler)`.

To catch every message update, use grammY’s `"message"` filter. If you only want text messages, use `"message:text"`.

### A) Emit to Luca’s **Telegram feature** event bus

The `TelegramEventsSchema` only declares a few event names (including `command`). If you want to keep everything “inside” the telegram feature, you can emit a generic event name and payload.

Whether this is type-safe depends on how strict your Feature base class is at runtime, but the mechanism is:

```ts
const tg = container.feature('telegram', { autoStart: true })

// Emit a custom event whenever any message is received
// (event name is up to you)
tg.handle('message', (ctx) => {
  tg.emit('telegram_message', {
    chatId: ctx.chat?.id,
    fromId: ctx.from?.id,
    message: ctx.message,
    update: ctx.update,
  })
})

// Elsewhere:
// tg.on('telegram_message', (payload) => { ... })
```

If you want to stay strictly within declared events, you can use the built-in `command` event (see next section), or emit via your own application-level bus if your app has one.

### B) Use the built-in `command` event (already implemented)

`tg.command(name, handler)` automatically emits a Luca event named `command`.

```ts
const tg = container.feature('telegram', { autoStart: true })

tg.command('start', async (ctx) => {
  await ctx.reply('Hello!')
})

// somewhere else
// tg.on('command', (name, ctx) => { ... })
```

That only fires for commands you register.

## 3) Common message filters you can use

Because `handle()` maps to grammY’s `bot.on()`, you can use any grammY filter query.

Examples:

```ts
// only text messages
// (ctx.message.text is defined)
tg.handle('message:text', (ctx) => {
  // ...
})

// photos
tg.handle('message:photo', (ctx) => {
  // ...
})

// callback button presses
tg.handle('callback_query:data', (ctx) => {
  // ...
})
```

## 4) Webhook mode (optional)

Webhook mode is useful when you deploy to a public server.

### How Luca sets up webhooks

From `telegram.ts`, `setupWebhook()`:

- Creates/uses an Express server via `container.server('express', { port })`.
- Mounts grammY’s `webhookCallback(this.bot, 'express')` at `webhookPath` (default: `/telegram/webhook`).
- Starts the Express server if it isn’t listening.
- Calls Telegram `setWebhook(fullUrl)`.

### Example

```ts
const tg = container.feature('telegram', {
  token: process.env.TELEGRAM_BOT_TOKEN,
  mode: 'webhook',
  webhookUrl: 'https://your-public-domain.com',
  webhookPath: '/telegram/webhook', // default
  webhookPort: 3000,                // optional; Luca may find an open port otherwise
  autoStart: true,
})

// Handle messages as usual
// (webhook only changes how updates arrive)
tg.handle('message', (ctx) => {
  tg.emit('telegram_message', ctx.update)
})
```

When webhook setup completes, Luca emits:

- `webhook_ready` with the full webhook URL.

## 5) Practical “event bridge” pattern

If your goal is “treat Telegram messages as app events”, use a small adapter:

```ts
type TelegramMessageEvent = {
  chatId?: number
  fromId?: number
  text?: string
  raw: any
}

const tg = container.feature('telegram', { autoStart: true })

// Example: normalize everything into one event payload
function toEvent(ctx: any): TelegramMessageEvent {
  return {
    chatId: ctx.chat?.id,
    fromId: ctx.from?.id,
    text: ctx.message?.text,
    raw: ctx.update,
  }
}

tg.handle('message', (ctx) => {
  tg.emit('telegram.message', toEvent(ctx))
})

// tg.on('telegram.message', (evt) => { ... })
```

## Troubleshooting

- **Token missing**: Luca throws: `Telegram bot token required. Set options.token or TELEGRAM_BOT_TOKEN env var.`
- **Nothing received in polling**: ensure your process stays alive; polling uses an internal loop.
- **Webhook not receiving**:
  - `webhookUrl` must be a public HTTPS URL.
  - your server must be reachable from the internet.
  - Telegram must be able to POST to `webhookUrl + webhookPath`.

## References in the Luca code

- Telegram feature implementation: `node_modules/@soederpop/luca/src/node/features/telegram.ts`
- It’s imported into the node container: `node_modules/@soederpop/luca/src/node/container.ts` (imports `./features/telegram`)
