---
inputs:
    subject:
        description: What is the subject of the tutorial you want written
assistant: codingAssistant
agentOptions:
    model: gpt-5.4
---
# Write a code tutorial 

You can find the source for the Luca Framework code in:

```ts
console.log(container.paths.resolve('node_modules','@soederpop','luca','src'))
```

In there you will find a docs folder that has examples, tutorials, and api docs, but please treat the source as the real source of truth.  Sometimes docs get outdated.

You will find the source for Contentbase in the following folder:

```ts
console.log(container.paths.resolve('node_modules','contentbase'))
```

Same rules apply: the docs might help, the code should be the source of truth.

## A Note about Contentbase / Luca integration

The `NodeContainer` in luca comes with a `container.docs` property that is an instance of its contentDb feature.  This is a wrapper around a contentbase collection.  `container.docs.collection` is the contentbase Collection class.

## My Question:

```ts
if(!INPUTS.subject?.length > 5) {
    console.log('DO NOT EVEN BOTHER DOING THE TUTORIAL, THE USER HAS NOT PROVIDED A QUESTION')
    process.exit(1)
}

console.log(INPUTS.subject)
```

## Tutorial Requirements

The tutorial should be written and stored in the following folder:

```ts
console.log(container.paths.resolve('docs','demos'))
```

It should be written as a runnable markdown document.  You can see an example of one of those here:

```ts
console.log(
    container.paths.resolve('RUNME.md')
)
```

In one of these documents, the fenced codeblocks that are tagged with the `ts` language will be run.

Context / scope is preserved between blocks provided that block doesn't use a top level await.

You can use `container.state.set('whatever')` to pass state between blocks if you must.

The `container` object ( an instance of the AGIContainer ) will be available in the scope of each block.

I should be able to run your tutorial using `luca run docs/demos/whatever` and get a sort of interactive example of how to use the thing




