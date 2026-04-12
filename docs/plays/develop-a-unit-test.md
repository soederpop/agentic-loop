---
agent: lucaCoder
schedule: every-half-hour
running: false
lastRanAt: 1776027746574
---

# Develop a Unit Test

Use your luca-framework skill.  Find a feature in ~/@agentic-loop/features, develop a unit test file for that feature.  Don't talk to any remote APIs or make any LLM calls.

When all tests have features, edit this docs/plays/develop-a-unit-test-doc.md and change the heading below to be "Only When".  This will prevent you from endlessly trying to write more tests.  As of now we have none.

I want to use bun test.  You can use the same testing approach used by the Luca framework ~/@luca see `bun test` command.

## Use this when all tests have features

Remove the skip too.

```ts skip
throw new Error(`All features have unit tests`)
```
