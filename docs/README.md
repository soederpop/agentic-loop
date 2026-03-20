# Models

## Overview

These models are used to define structure to various documents which are used as content, AI context, and to power automated workflows.

Every subfolder (e.g. `goals`, `ideas`, `tasks`) tells you what structure the documents inside of it will need to follow in terms of the YAML frontmatter (e.g. for tags, status tracking ) and section headings.  ( Certain ## H2 Headings the document expects you to use )

## Summary

```
Collection: /Users/jonathansoeder/@agentic-loop/docs
Root: /Users/jonathansoeder/@agentic-loop/docs
Items: 14

  Model: Goal
    Prefix: goals
    Meta: horizon(enum(`short`, `medium`, `long`))
    Sections: successCriteria, motivation
    Relationships: (none)
    Documents: 0

  Model: Idea
    Prefix: ideas
    Meta: goal(string), tags(string[]), status(enum(`spark`, `exploring`, `ready`, `parked`, `promoted`))
    Sections: (none)
    Relationships: goal
    Documents: 1
    IDs: ideas/web-based-assistant-chat-application

  Model: Memory
    Prefix: memories
    Meta: (none)
    Sections: (none)
    Relationships: (none)
    Documents: 4
    IDs: memories/README, memories/USER, memories/TODO, memories/SELF

  Model: Plan
    Prefix: plans
    Meta: status(enum(`approved`, `pending`, `rejected`, `completed`, `building`, `in_progress`)), project(string), costUsd(number), turns(number), toolCalls(number), completedAt(string)
    Sections: references, verification
    Relationships: project
    Documents: 0

  Model: Play
    Prefix: plays
    Meta: agent(string), tags(string[]), schedule(string), lastRanAt(number), running(boolean)
    Sections: conditions
    Relationships: (none)
    Documents: 2
    IDs: plays/begin-exploring-one-of-the-spark-ideas, plays/turn-one-of-my-ideas-into-a-project-plan

  Model: Project
    Prefix: projects
    Meta: status(enum(`draft`, `approved`, `building`, `in_progress`, `completed`, `failed`, `reviewing`)), goal(string)
    Sections: overview, execution
    Relationships: goal, plans
    Documents: 0

  Model: Prompt
    Prefix: prompts
    Meta: tags(string[]), repeatable(boolean), lastRanAt(number), inputs(record<string, object>)
    Sections: (none)
    Relationships: (none)
    Documents: 0

  Model: Report
    Prefix: reports
    Meta: goal(string), tags(string[])
    Sections: (none)
    Relationships: (none)
    Documents: 1
    IDs: reports/onboarding-troubleshooting-log

  Model: Task
    Prefix: tasks
    Meta: agent(enum(`claude`, `codex`)), createdBy(string), tags(string[]), completedAt(string), lastRanAt(number), running(boolean)
    Sections: conditions
    Relationships: (none)
    Documents: 0

  Model: Base
    Prefix: 
    Meta: (none)
    Sections: (none)
    Relationships: (none)
    Documents: 4
    IDs: VISION, README, TABLE-OF-CONTENTS, assistant-README
```
