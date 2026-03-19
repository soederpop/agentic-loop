# Runnable Markdown

The `luca` CLI allows you to run markdown blocks as long as they're tagged with `ts` in the language.

```ts
const banner = ui.banner('LUCA', { 
    font: 'Puffy', 
    colors: ['red','white','blue'] 
})

ui.print(banner)
```

What is kind of cool is ( so long as there's no top-level-await in the block ) the context will preserve:

```ts
if(typeof banner === 'undefined') { 
    ui.print.red('uh oh, something broke.')
}
```

You can skip blocks too with the skip tag in the language of the fenced block

```ts skip
console.log('Not gonna say anything')
```

Did you hear something? No. 

Something even cooler is the ability to render React blocks.  This makes luca kind of like a poor man's MDX.  I just define some Blocks in the markdown by creating an h2 `## Blocks` section with a fenced codeblock that uses `tsx`. The `ink.components` and `ink.React` globals are injected into the scope.

## Blocks

```tsx
const { Box, Text } = ink.components
const React = ink.React

function Greeting({ name, role }) {
  return (
    <Box borderStyle="round" padding={1}>
      <Text color="green" bold>Hello {name}!</Text>
      <Text dimColor> ({role})</Text>
    </Box>
  )
}
```

## Rendering React Blocks

Then I can use the Blocks in code. 

```ts
await render('Greeting', { name: 'Jon', role: 'Humble Servant' })
```


