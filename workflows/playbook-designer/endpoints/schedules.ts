export const path = '/api/schedules'
export const description = 'List valid schedule options with their intervals'
export const tags = ['playbook-designer']

export async function get(_params: any, ctx: any) {
  const { scheduleMap } = ctx.request.app.locals

  const schedules = Object.entries(scheduleMap).map(([name, ms]) => ({
    name,
    intervalMs: ms,
    label: formatScheduleLabel(name),
  }))

  return { schedules }
}

function formatScheduleLabel(name: string): string {
  const labels: Record<string, string> = {
    'every-five-minutes': 'Every 5 Minutes',
    'every-ten-minutes': 'Every 10 Minutes',
    'every-half-hour': 'Every 30 Minutes',
    'hourly': 'Hourly',
    'daily': 'Daily',
    'beginning-of-day': 'Beginning of Day',
    'end-of-day': 'End of Day',
    'weekly': 'Weekly',
  }
  return labels[name] || name
}
