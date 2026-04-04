# Demo Script

# Voice Mode Test

```ts
if(!process.env.ELEVENLABS_API_KEY) {
    ui.print.red(`There is no way this could even work. Get that added to our .env then re-run this script.`)
}
```

Let's test whether the voice system works.

Let's set things up

```ts
container.feature('assistantsManager').enable()
```

Now we can discover the available assistants in the project

```ts
await assistantsManager.discover()
```

There should be two

```ts
ui.print.green(`Assistants: ${assistantsManager.available.length}`)
```

We can create a voice chat with one of them:

```ts
const chief = container.feature('voiceChat', { assistant: 'chiefOfStaff' })
```

```ts
await assistantsManager.discover()
async function presenterPart(duration = 6000, cue = '') {
  ui.print.green('Speak your part')
  ui.print.yellow(cue, { indent: 2 })
  await container.sleep(duration)
}

const rocket = assistantsManager.create('rocket')

container.addContext({ presenterPart, rocket, chief })
```

## Start The Demo

```ts
await presenterPart(3000, "Come here chief.  Is this thing running?")

chief.speakPhrase('24 7 Jay money. Turning ideas into reality.  You know my gameplan.')

container.proc.spawnAndCapture('luca', ['workflow', 'run', 'ideas'])

await presenterPart(7000, "Good shit coach.  Hey I have a new idea.")

container.proc.spawnAndCapture('luca', ['workflow', 'run', 'capture'])

await chief.speakPhrase('Talk to me, lets see if this one lines up with the goals we set out or if you need to pop an addy. Stay locked [short comedic pause] the fuck [shorter pause] in.')

await presenterPart(8000, "Let me check out the assistant designer it was for that.")

container.proc.spawnAndCapture('luca', ['workflow', 'run', 'assistant-designer'])

await chief.speakPhrase('You know what I always say about these clankers bro.  Design em. Beat em dont treat em.')

await presenterPart(4000, "This shit is looking disorganized as hell.")

await rocket.ask('Please organize the windows so assistant manager is at the bottom, half height, full width, and the other two are split 70/30.  Capture can be smaller')

await chief.speakPhrase('There cupcake can you focus now')

await container.sleep(60000)
```

