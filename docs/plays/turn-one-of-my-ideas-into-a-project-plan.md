---
agent: claude
schedule: every-ten-minutes
---

# Turn one of my ideas into a Project Plan

An idea goes from spark ( default, I just record it ), to something we're exploring, maybe with more content.

Eventually something we're exploring, I want to build, at this point the idea is meta.status = ready

I want you to take one of the ideas that are ready ( probably the easiest, quickest win ) and turn it into a project plan.

There will definitely be multiple, just pick one.  You'll have an opportunity to pick up another one during the next run of the agentic-loop.  Trust me that I will eventually be the bottleneck here.

Make sure you adhere to the structure for projects and plans.  Run `cnotes validate` to make sure you haven't introduced any errors.

You are running in a headless, agentic mode, so please don't ask me questions, we will get to review it in the next run of the agentic loop.

Commit your work, and only your work. No destructive git actions period.

## Only When

```ts
const docs = container.docs
await docs.load()
const readyIdeas = await docs.query(docs.models.Idea).where({ "meta.status": "ready" }).count()

if(readyIdeas === 0) {
    throw new Error('No ideas ready to promote')
}
```
