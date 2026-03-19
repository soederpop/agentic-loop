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
const voiceChat = container.feature('voiceChat', { assistant: 'chiefOfStaff' })
```

And use that to speak an arbitrary phrase:

```ts
await voiceChat.speakPhrase('What is good [emphatic]MY BOY we are ready to get [zany]loopy')

const answer = await ui.askQuestion('Did you hear anything? yes or no').then(r => r.question)

if (answer === 'yes') {
    await voiceChat.speakPhrase(`Just delightful my boy just [rhythmic exaggerated whisper] dee light ful`)
} else {
    ui.print.red('Past this to claude he will figure it out')
}

```

## Transcription

There are numerous TTS mechanisms available, the whisper mlx one is by far the best:

```ts
const listener = container.feature('voiceListener')
const testVoice = await ui.askQuestion('Ready to test voice?').then(r => r.question)

if (testVoice !== 'yes') {
    ui.print.yellow('Ok maybe later')
} else {
    const transcription = await listener.listen({ silenceTimeout: 7000 })
    console.log("You said: " + transcription)
}
```


