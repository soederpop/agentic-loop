# Models

## Overview

These models are used to define structure to various documents which are used as content, AI context, and to power automated workflows.

Every subfolder (e.g. `goals`, `ideas`, `tasks`) tells you what structure the documents inside of it will need to follow in terms of the YAML frontmatter (e.g. for tags, status tracking ) and section headings.  ( Certain ## H2 Headings the document expects you to use )

## Summary

```
Collection: /Users/jonathansoeder/@agentic-loop/docs
Root: /Users/jonathansoeder/@agentic-loop/docs
Items: 24

  Model: Goal
    Description: A Goal has metadata (horizon) and sections (Success Criteria, Motivation).
    Path prefix: docs/goals/*.md
    Meta: horizon(enum(`short`, `medium`, `long`))
    Sections: successCriteria, motivation
    Relationships: (none)

  Model: Idea
    Description: An idea is something that is aligned to a Goal, and can eventually become a Project/Plans for our Agents to work on
    Path prefix: docs/ideas/*.md
    Meta: goal(string), tags(string[]), status(enum(`spark`, `exploring`, `ready`, `parked`, `promoted`))
    Sections: (none)
    Relationships: goal

  Model: Memory
    Description: Memories are used to control the chief of staff assistant's personality, knowledge of me, and its immediate todos
    Path prefix: docs/memories/*.md
    Meta: (none)
    Sections: (none)
    Relationships: (none)

  Model: Plan
    Description: Plans are literal claude code generated /plan documents with testing criteria, resources, etc.  They need to be approved to be picked up by the project builder
    Path prefix: plans/:project/:slug, plans/:slug
    Meta: status(enum(`approved`, `pending`, `rejected`, `completed`, `building`, `in_progress`)), project(string), costUsd(number), turns(number), toolCalls(number), completedAt(string)
    Sections: references, verification
    Relationships: project

  Model: Play
    Description: Plays are repeatable, schedulable prompts executed by the agentic loop on a defined schedule.
    Path prefix: docs/plays/*.md
    Meta: agent(string), tags(string[]), schedule(string), lastRanAt(number), running(boolean)
    Sections: conditions
    Relationships: (none)

  Model: Project
    Description: Projects are home documents for one or more plans that need to be sequentially carried out by one or more different agents with unique setups.
    Path prefix: docs/projects/*.md
    Meta: status(enum(`draft`, `approved`, `building`, `in_progress`, `completed`, `failed`, `reviewing`)), goal(string)
    Sections: overview, execution
    Relationships: goal, plans

  Model: Prompt
    Description: Prompts are reusable prompts that can be handled by coding assistants, or luca's assistants, through the `luca prompt` command.
    Path prefix: docs/prompts/*.md
    Meta: tags(string[]), repeatable(boolean), lastRanAt(number), inputs(record<string, object>)
    Sections: (none)
    Relationships: (none)

  Model: Report
    Description: Reports either I write, or the AI writes.  They're long form, detailed writeups usually
    Path prefix: docs/reports/*.md
    Meta: goal(string), tags(string[])
    Sections: (none)
    Relationships: (none)

  Model: Task
    Description: Tasks are one-off prompts for small changes, bugfixes, documentation, reports, etc. They run once and are marked completed.  The Conditions section is a special section used to short circuit the task being run.  You will almost never need this.
    Path prefix: docs/tasks/*.md
    Meta: agent(enum(`claude`, `codex`)), createdBy(string), tags(string[]), completedAt(string), lastRanAt(number), running(boolean)
    Sections: conditions
    Relationships: (none)

  Model: Base
    Description: A Base document.
    Path prefix: docs/*.md
    Meta: (none)
    Sections: (none)
    Relationships: (none)
```
