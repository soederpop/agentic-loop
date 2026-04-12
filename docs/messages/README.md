# Message Threads

These docs represent durable assistant inbox threads.

- One markdown doc per thread
- Gmail prefers provider thread IDs when available
- Telegram and iMessage reuse the same doc when the same trusted sender messages again within one hour
- Rich state should live in the markdown body, not bloated frontmatter

This folder is backed by the `MessageThread` content model in `docs/models.ts`.
