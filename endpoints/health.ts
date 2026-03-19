/**
 * Health check endpoint.
 * Accessible at GET /api/health when you run `luca serve`.
 */
export const path = '/api/health'
export const description = 'Health check endpoint'
export const tags = ['health']

export async function get(_params: any, ctx: any) {
  return {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  }
}
