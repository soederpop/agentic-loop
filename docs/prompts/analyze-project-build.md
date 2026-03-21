# Analyze The Project Build 

Analyze the project build that ran recently for the following project:

```ts
console.log(container.argv.projectId)
```

The project's plans can be found at:

```ts
await container.docs.load()

const projects = await container.docs.queries.projects.fetchAll()
const plans = await container.docs.queries.plans.where("meta.project", container.argv.projectId).fetchAll()

for(let project of projects) {

}

```

