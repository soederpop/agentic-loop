export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  // The dashboard HTML connects directly to the luca main WebSocket.
  // We just pass through the WS port so the frontend knows where to connect.
  const wsPort = parseInt(process.env.LUCA_MAIN_PORT || '4410', 10)
  app.locals.wsPort = wsPort

  console.log(`[dashboard] serving dashboard UI — ws://localhost:${wsPort}`)
}
