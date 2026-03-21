# I-Message Integration

If you have the `imsg` CLI installed, you can use the `imsg` feature.

```ts
const imsg = container.feature('imsg')
```

With the imsg feature, you can send, receive, list, etc all of the imessages for your currently logged in imessage user.

```ts
const { ui } = container

const response = await ui.askQuestion('Do you want to start listening for texts?').then(r => r.question)

let runWatchDemo = String(response).toLowerCase() === 'yes'

if (!runWatchDemo) {
  process.exit(0)
}
```

## Watching for Messages

When you call `imsg.watch()` it will emit `message` events.


```ts

imsg.on('message', (data) => {
  console.log('got a message', data)
})

imsg.watch()
```