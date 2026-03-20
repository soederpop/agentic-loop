export default function serverSetup(server: any) {
  const { container, start } = server
  const { ui, docs } = container

  const mgr = container.feature('assistantsManager')

  server.start = async function(...args) { 
	  // discover all of the available
	  await mgr.discover()
	  await docs.load()
	  ui.print.green(`Assistants manager and docs loaded`)
	  await start.call(server, ...args)
  }

  return server
}
