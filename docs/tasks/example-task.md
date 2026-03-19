# Example Task

This task will be handed directly to your default coding assistant (claude) 

The assistant will follow the directions in here and execute whatever you tell it.

## Conditions

This block gives you an opportunity to abort the task being run if the below code block throws an error.

The coding assistant won't see this section.

```ts
if(1 > 0) {
    throw new Error(`All of our mathematic assumptions are now wrong, we should not be writing code.`)
}
```