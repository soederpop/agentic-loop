# Window Manager Layouts

The Agentic Loop ships with a native swift OSX App in [apps/presenter-windows](../../apps/presenter-windows).

The `luca main` process automatically launches this app, if it is built, and it runs in the background

The purpose of this app is to allow assistants to spawn browser windows, or terminal windows, and arrange them however they wish on the screen.

This is used to power back and forth sessions where the assistants wants you to look at something and provide input to them.

Or it powers the voice command launcher, when I say `luca yo friday open up the console` that potentially gets picked up by one of the [voice command handlers](./creating-new-voice-command-handlers.md) and reacts by opening a browser window or terminal with that particular command opened.

## Luca's `windowManager` feature

```ts
const windowManager = container.feature('windowManager')
console.log("Methods", Object.keys(windowManager.introspect().methods))
```


## You can spawn multiple windows with the spawnLayout feature

```ts
const layout = await windowManager.spawnLayout([{ url: "https://www.google.com", width: "50%", x: 0, y: 0, height: "100%" }])
console.log(layout)

await container.sleep(5000)

if (layout?.length > 0) {
    await layout[0].close()
}
```


