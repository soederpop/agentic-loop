export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  // The dashboard HTML connects directly to the luca main WebSocket.
  // Read port from instance registry, fall back to env var or default.
  const { readCurrentInstance } = await import('../../features/instance-registry')
  const instance = readCurrentInstance()
  const wsPort = instance?.ports.authority ?? parseInt(process.env.LUCA_MAIN_PORT || '4410', 10)
  app.locals.wsPort = wsPort

  console.log(`[dashboard] serving dashboard UI — ws://localhost:${wsPort}`)
}
