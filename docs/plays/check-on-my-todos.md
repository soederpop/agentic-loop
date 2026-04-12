---
agent: chiefOfStaff
schedule: every-twenty-minutes
---

# Chief Of Staff's TODO List

Pick one of the unfinished TODO items on your list.  

Create a docs/tasks/whatever.md file that will accomplish that todo. 

Use whatever assistant is best suited for the task.  ( With the exception of Rocket, who doesn't work for you. )

## Only When

```ts
// this block is intended to short circut the loop and avoid an LLM call if there are no TODOs
const doc = await container.docs.parseMarkdownAtPath('docs/memories/TODO.md')
const todosSection = doc.querySection('TODOS') 

if (!todosSection) {
  throw new Error(`Something is off with the TODO.md in memories`)
}

const todoItems = todosSection.selectAll('listItem')
const totalTodoCount = todoItems.length
const completedTodoCount = todoItems.filter(i => i.checked).length

if ((totalTodoCount - completedTodoCount) === 0) {
  throw new Error(`All Todo items are completed`)
}
```

