# Workflow Design Specs

What is a workflow?

A Workflow is each of the things that live in the [Workflows Folder at the Project Root](../../workflows).

It is a server / ui combination whose purpose is to provide targeted UIs for manipulating our project docs and controlling the Agentic loop.

You can start a workflow manually by saying `luca workflow run project-reviewer` or `luca workflow list` to see all that are available.

A workflow is started by the `luca serve` command, and will evict any running workflows of the same name (We can design around this if need be)

## Worfklow Library Feature

The [Workflow Library](../../features/workflow-library.ts) is a feature that an can be passed to assistant.use().

This feature discovers all the workflows and provides an interface for learning about them.

## Workflow ABOUT.md Files

Every workflow should have an `ABOUT.md` file that is used to describe the workflow, and when it is appropriate to use, what a user might say to warrant triggering that workflow.

## Workflow Server Pattern

- Workflows use a `luca.serve.ts` to handle customizing the server before it starts.
- Workflows should generally be single page static html files 
- Workflows should load the @soederpop/luca browser container from 'esm.sh' and use client side features to do their thing


