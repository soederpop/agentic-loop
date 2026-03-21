---
agent: claude
schedule: every-ten-minutes
lastRanAt: 1774068714774
durationMs: 322957
outputTokens: 517
running: false
---

# Begin Exploring on of my ideas

An idea goes from spark ( default, I just record it ), to something we're exploring, maybe with more content.

The process of exploring an idea would mean looking at what we've done recently, looking at the goals, other ideas to see if they related,
as well as doing dives into the codebases these ideas might effect, and coming up with a richer version of the idea with more resources, samples, examples, references, etc.  Make sure it aligns with my goals, we're never writing code just for its own sake.

There will definitely be multiple, just pick one.  You'll have an opportunity to pick up another one during the next run of the agentic-loop.  Trust me that I will eventually be the bottleneck here.

Commit your work, and only your work. No destructive git actions period.

Make sure you adhere to the structure for projects and plans.  Run `cnotes validate` to make sure you haven't introduced any errors.

## Only When

```ts
const docs = container.docs
await docs.load()
const readySparks = await docs.query(docs.models.Idea).where({ "meta.status": "spark" }).count()

if(readySparks === 0) {
    throw new Error('No ideas ready to explore')
}
```
