import container from '@soederpop/luca/agi'

const { ui } = container

await container.docs.load()

const projects = await container.docs.queries.projects.fetchAll()

for(let project of projects) {
	const plans = await project.relationships.plans.fetchAll()

	if (plans.length === 0) {
		ui.print.yellow(`Project ${project.title} has 0 plans`)
	} else {
		ui.print.green(`Project ${project.title} has some plans!`)
	}
}

