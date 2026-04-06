# Running the Agentic Loop

The `Agentic Loop` refers to a server side process that is safe to leave running 24/7 and setup through `launchctl` on your mac.

If you're just testing it out, though, you can start this process by running the following command from this folder:

```sh
luca main
```

This will spawn a process that can drive assistants like claude code, codex, or our own [Internal Assistants](./creating-your-own-assistant.md) on a permanent loop.

During this loop, a feature called [The Task Scheduler](../../features/task-scheduler) `luca describe taskScheduler` sees to it that:

- [Plays](../plays) get run on whatever schedule you define in their YAML frontmatter's `schedule` property. (every-ten-minutes, every-half-hour, daily, etc.  See [The Content Model](../models.ts) for all of the options).  run meaning, a coding assistant is given that prompt and told to do work.
- [Tasks](../tasks) get run by whatever assistant you define in the YAML frontmatter (claude, codex, chiefOfStaff) whenever they are discovered.  They only get run once.
- [The Project Builder](../../features/project-builder.ts) looks for [Project Documents](../projects) which have a `status: approved` and builds those projects

## Agentic Loop Subsystems

- The `luca main` process also spawns a few other services that make the full system work.
- The [Voice Service](../../features/voice-service.ts) listens for wake words and routes them to voice-enabled assistants based on their `voice.yaml` aliases

- The [Presenter](../../features/presenter.ts) gives assistants the ability to display web pages, or terminal processes to you

- The [Project Builder](../../features/project-builder.ts) coordinates claude code builds across multiple dependent plans.  You can run `luca project-builder project-slug` for any [Project Document](../projects) where `status=approved` in the YAML frontmatter

## Interacting with the Main Process

Ideally you're running `luca main` in a terminal and forgetting about it.

You can run `luca main` in another terminal and get a dashboard view that monitors it's status.

You can run `luca main --pause` or `luca main --resume` to shut everything down.  ( This is useful when `luca main` is managed by launchctl )

You can run `luca main --console` to run arbitrary code in the main process.

## When the process is up and running

Your main job is to record ideas, and work with your chief of staff to usher them through to built products.  The chief will know what to do.




