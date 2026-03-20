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

Feature are composable like legos and can be shared across multiple commands / or servers.  You can check the [Features Folder](../../features/) for some examples, or view the Luca frameworks own internal [source code](https://github.com/soederpop/luca/tree/main/src/node/features) to see what they look like.

Commands live in the `commands/` folder and can be called with the `luca` CLI. 