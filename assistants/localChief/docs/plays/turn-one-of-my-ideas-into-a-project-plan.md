---
agent: claude
schedule: every-ten-minutes
running: false
lastRanAt: 1775275538767
---

# Turn one of my ideas into a Project Plan

An idea goes from spark ( default, I just record it ), to something we're exploring, maybe with more content.

Eventually something we're exploring, I want to build, at this point the idea is meta.status = ready

I want you to take one of the ideas that are ready ( probably the easiest, quickest win ) and turn it into a project plan.

There will definitely be multiple, just pick one.  You'll have an opportunity to pick up another one during the next run of the agentic-loop.  Trust me that I will eventually be the bottleneck here.

Make sure you adhere to the structure for projects and plans.  Run `cnotes validate` to make sure you haven't introduced any errors.

You are running in a headless, agentic mode, so please don't ask me questions, we will get to review it in the next run of the agentic loop.

Commit your work, and only your work. No destructive git actions period.

## Example of a well structured project and plan

Syntactically, we need a couple of things to make the projects / plans relate to eachother, which helps them power the project builder UI

The marketing-website project document lives in the projects/marketing-website.md

```markdown
---
status: approved
goal: whatever-goal-it-aligns-to
---

# Marketing Website

Every project has a title, this is an executive summary level description of what it is.  Feel free to include whatever other sections are necessary, between here and the `## Execution section`

## Execution

This should have a markdown list with links to the individual plan documents.

- [Frontend](../plans/marketing-website/frontend.md)
- [Backend](../plans/marketing-website/backend.md)
```

Each plan lives in the `plans/:project-name/:slug.md` and should reference the project by its slug in its YAML frontmatter

```markdown
---
status: approved
project: marketing-website
---

# Plan Title

Describe this phase of the plan

## Resources

- list of whatver

## Validation

- How you will validate the plan is successful
- another test
- be thorough
```

This structure allows us to turn this project / plans into an multi-stage agent swarm which builds the project in stages, learns as it goes, and adjusts the plans.

## What goes into a good project / plan?

At each stage of the delivery, from plan 1, to plan 2, to plan 3, there should be some usable, demoable, thing of value.  Think of the analogy of building a car, wouldn't it be better to go from a skateboard to a scooter to a motorbike to a motorcyle to a car than from an idea to waiting the whole time until you have the whole car?

That is the key thing that should determine the boundaries between plans.

Even if the usable thing is a script / command based demo to prove that the lan worked.

## Only When

This play will only run when there are ideas in a ready status.

```ts
const docs = container.docs
await docs.load()
const readyIdeas = await docs.query(docs.models.Idea).where({ "meta.status": "ready" }).count()

if(readyIdeas === 0) {
    throw new Error('No ideas ready to promote')
}
```
