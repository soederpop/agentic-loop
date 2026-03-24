---
goal: user-experience-improvements
tags:
  - models
  - lm-studio
  - workflows
  - voice-commands
  - assistants
  - orchestration
  - local-models
status: exploring
---

# Unified Local Model And Workflow Orchestration

We now have a lot of strong building blocks that should work together as one coherent system: assistant APIs, workflows, voice commands, a workflow-library feature assistants can use, and newly added local models in LM Studio including a dedicated small tool-calling model and a stronger daily-driver model for coding. The idea is to wire these pieces together into a clear, unified flow so the system can route the right work to the right model and capability instead of feeling like a pile of separate powers.

## Motivation

The Agentic Loop is accumulating serious capability, but the experience risks becoming fragmented. We have multiple ways to trigger behavior, multiple model options, workflow infrastructure, and assistant-level APIs, but not yet a simple mental model for how they should fit together.

A coherent orchestration layer would help in a few ways:

- **Better UX**: the system should feel understandable, deliberate, and unsurprising. Users should know when a voice command becomes a workflow, when an assistant should call a tool, and when a local model should be used.
- **Better performance/cost/privacy tradeoffs**: a small local tool-calling model could handle structured routing and lightweight tool use, while a stronger local coding model could be used for deeper implementation or analysis work.
- **Better customization**: workflows and voice commands become reusable building blocks assistants can discover through a workflow-library capability, rather than custom one-off glue.
- **Better adoption**: a coherent architecture makes the system easier to explain, easier to demo, and easier for new users to trust.

## Raw Shape Of The Idea

A possible target state:

- **Voice commands** become a clean entry point for fast user intent capture
- **Assistants** act as orchestrators that can call tools, browse a workflow library, and decide whether the next step is a direct answer, a workflow launch, or a coding/task action
- **Workflows** provide durable UI and structured multi-step experiences
- **Workflow-library** gives assistants a discoverable catalog of available workflows and what each one is for
- **LM Studio local models** are assigned clear roles, for example:
  - a **small tool-calling model** for routing, classification, structured extraction, and lightweight agent/tool coordination
  - a **stronger daily-driver coding model** for implementation, debugging, and heavier reasoning/code generation
- **Model routing policy** decides which model to use based on task type, urgency, cost, privacy, and expected complexity

## Questions To Explore Tomorrow

- What is the cleanest end-to-end flow from voice command → assistant → workflow/tool/model selection?
- What should the workflow-library API/capability look like from an assistant's perspective?
- Which responsibilities belong to assistants vs workflows vs voice handlers?
- What exact roles should each LM Studio model play?
- When should the system prefer local models vs cloud models?
- Do we want a single orchestration layer/policy engine, or lightweight conventions between existing parts?
- What is the first thin slice that proves the architecture without overbuilding it?

## What Success Might Look Like

- A clear architecture doc or project that explains how assistants, workflows, voice commands, and local models fit together
- One or two concrete end-to-end flows implemented as exemplars
- A workflow-library capability assistants can reliably use
- Sensible model routing defaults for at least tool-calling vs coding tasks
- A system that feels more unified, explainable, and powerful than the sum of its parts
