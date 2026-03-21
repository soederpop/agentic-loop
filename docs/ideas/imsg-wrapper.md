---
status: parked
---

# imsg Wrapper

We could develop a new feature which lets us control the `imsg` CLI with code.

It could be a part of a general `communications` feature which abstracts telegram, imsg, gmail, etc.  ( Longer term, not in the scope of this idea ) and provides a unified interface for communicating with an assistant.

## potential use case

The chief of staff could be setup to monitor my imessage system, and specifically react to imessages following certain rules (e.g. only when I text myself something)

The chief COULD use another imessage account but that would require being logged in as another user and I'm not sure how that will work, so out of scope for now.

## imsg cli details
There is a CLI `imsg`, here are some of its help

```
imsg 0.5.0
Send and read iMessage / SMS from the terminal

Usage:
  imsg <command> [options]

Commands:
  chats	List recent conversations
  history	Show recent messages for a chat
  watch	Stream incoming messages
  send	Send a message (text and/or attachment)
  react	Send a tapback reaction to the most recent message
  rpc	Run JSON-RPC over stdin/stdout

Run 'imsg <command> --help' for details.

❯ imsg chats --help
imsg chats
List recent conversations

Usage:
  imsg chats [options]

Options:
  --db <value>  Path to chat.db (defaults to ~/Library/Messages/chat.db)
  --limit <value>       Number of chats to list
  --log-level, --logLevel <value>       Set log level (trace|verbose|debug|info|warning|error|critical)
  -v, --verbose Enable verbose logging
  --json, -j, --json-output, --jsonOutput       Emit machine-readable JSON output

Examples:
  imsg chats --limit 5
  imsg chats --limit 5 --json
  
❯ imsg history --help
imsg history
Show recent messages for a chat

Usage:
  imsg history [options]

Options:
  --db <value>  Path to chat.db (defaults to ~/Library/Messages/chat.db)
  --chat-id <value>     chat rowid from 'imsg chats'
  --limit <value>       Number of messages to show
  --participants <value>        filter by participant handles
  --start <value>       ISO8601 start (inclusive)
  --end <value> ISO8601 end (exclusive)
  --log-level, --logLevel <value>       Set log level (trace|verbose|debug|info|warning|error|critical)
  --attachments include attachment metadata
  -v, --verbose Enable verbose logging
  --json, -j, --json-output, --jsonOutput       Emit machine-readable JSON output

Examples:
  imsg history --chat-id 1 --limit 10 --attachments
  imsg history --chat-id 1 --start 2025-01-01T00:00:00Z --json

> imsg watch --help

imsg watch
Stream incoming messages

Usage:
  imsg watch [options]

Options:
  --db <value>	Path to chat.db (defaults to ~/Library/Messages/chat.db)
  --chat-id <value>	limit to chat rowid
  --debounce <value>	debounce interval for filesystem events (e.g. 250ms)
  --since-rowid <value>	start watching after this rowid
  --participants <value>	filter by participant handles
  --start <value>	ISO8601 start (inclusive)
  --end <value>	ISO8601 end (exclusive)
  --log-level, --logLevel <value>	Set log level (trace|verbose|debug|info|warning|error|critical)
  --attachments	include attachment metadata
  --reactions	include reaction events (tapback add/remove) in the stream
  -v, --verbose	Enable verbose logging
  --json, -j, --json-output, --jsonOutput	Emit machine-readable JSON output

Examples:
  imsg watch --chat-id 1 --attachments --debounce 250ms
  imsg watch --chat-id 1 --participants +15551234567

```