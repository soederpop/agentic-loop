# Chief of Staff Todo List

These TODOs are things that can be picked up by a scheduled play for Chief.

The checklist below remains human-readable markdown, but future machine-actionable TODOs may include lightweight structured sub-bullets so Chief can safely process async follow-up commitments.

## Todos

- [X] Demonstrate the listTodos tool call for the assistant works and returns data
- [X] There is nothing to do but for you to show me you can mark this as complete

## Proposed Machine-Actionable TODO Shape

Use a normal checkbox item as the human-readable top line. If a TODO is meant to be processed by a play, it can include structured sub-bullets like these:

```md
- [ ] Follow up on report completion for datapimp provider SDK research
  - authorization: Jon explicitly asked Chief to email him when the report is complete
  - owner: chief
  - action-type: async-follow-up
  - target: reports/datapimp-luca-selector-api-and-provider-sdk-research
  - trigger: report status becomes complete
  - success: Jon receives a concise email summary with a link to the report
  - notify-on: success
  - notify-channel: email
  - thread: messages/example-thread
  - dedupe-key: report-complete-datapimp-provider-sdk-email
  - created-at: 2026-04-12T19:30:00Z
  - last-checked-at:
```

## Field Intent

These fields are not a formal schema yet, but they express the minimum shape needed for safe async follow-up:

- `authorization`: why Chief is allowed to act
- `owner`: which assistant is responsible
- `action-type`: what kind of follow-up this is
- `target`: the artifact, thread, or resource to inspect
- `trigger`: what condition makes the TODO actionable
- `success`: what counts as completion
- `notify-on`: whether to notify on success, failure, or both
- `notify-channel`: where the follow-up should go
- `thread`: optional related message thread for durable communication history
- `dedupe-key`: stable key to prevent duplicate sends
- `created-at`: when the TODO was created
- `last-checked-at`: most recent evaluation time

## Notes

- Keep top-level TODO text readable for humans first.
- Use structure only when a play needs to evaluate the item safely.
- `MessageThread` docs in `docs/messages/*.md` should hold communication history and posture.
- TODOs should hold operational commitments such as "check later and notify Jon when done."
- One-shot follow-up TODOs are the safest first version.
