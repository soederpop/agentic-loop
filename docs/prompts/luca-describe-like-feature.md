---
tags: []
inputs: {}
---

# Luca Describe Like Feature

Copy the source code for the luca describe command from the framework in ~/@soederpop/luca/src/commands/describe

Make a local version called desc that does the exact same thing, we're eveentually going to put this into the luca framework itself

Take inspiration from some of the browser side repls in the workflows to get an idea what I'm after

I want this command to have a --ui flag, it is either true, light, or dark

if the user passes it, we spawn an express server that serves URLs that handle the various CLI args and renders the output as markdown.  Basically just like pretty, but you're using an express endpoint to serve an in memory html template with the commands output as the body, and where the urls match the things that could be described (e.g. features/node/diskCache containers/agi containers/node containers/web clients/elevenlabs) 

In addition to the documentation, there should be a repl.  If the feature is a node feature or node container, it uses the vm.  If the feature is a browser feature, or the browser container, it uses a repl where the vm is the one provided by the browser container ( use esm.sh for now )

## Desired UI

- Something with decent whitespace and typography 

