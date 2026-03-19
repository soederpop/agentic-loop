# Extending the Agentic Loop

This project is based on [The Luca Framework](https://github.com/soederpop/luca). 

With the [Luca Framework Skill](../../.claude/skills/luca-framework/SKILL.md) loaded, the coding assistants are extremely capable of building almost anything you throw at them without needing to download new dependnecies.  See [The Challenge Suite](https://github.com/soederpop/luca/tree/main/docs/challenges) for a growing list of evals that are used to dynamically improve the skill and ensure it can accomplish the goals faster and with smaller token budgets.

## Adding new features / commands

You can look at [any of the existing commands](../../commands/) for an example of the pattern.

You create one or more features that do things, and a command that spins them up

Run either of these commands to learn what those things mean

```shell
luca scaffold command --tutorial
luca scaffold feature --tutorial
```

Feature are composable like legos and can be shared across multiple commands / or servers

## Creating a new assistant

An assistant lives in the [assistants folder](../../assistants/) and is made up of a few parts:

- [CORE.md](../../assistants/chiefOfStaff/CORE.md) is the core system prompt
- [tools.ts](../../assistants/chiefOfStaff/tools.ts) are tools that the assistant can run
- [voice.yaml](../../assistants/chiefOfStaff/voice.yaml) a config file that governs its voice personality

The assistant's `tools.ts` file has access to the `container` in its scope, so it can use any of the features available to do things.

Use `luca console` to open up a REPL and explore what can be done.

Use `luca eval "code"` to test snippets yourself.

Tell your agent to do the above.



