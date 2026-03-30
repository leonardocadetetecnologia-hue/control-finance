export function buildGCalUrl(params: {
  title: string
  date: string
  description: string
  recurrence?: 'MONTHLY' | 'YEARLY'
}): string {
  const dt = params.date.replace(/-/g, '')
  const title = encodeURIComponent(params.title)
  const details = encodeURIComponent(params.description)
  const recur = params.recurrence
    ? `&recur=RRULE%3AFREQ%3D${params.recurrence}`
    : ''
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dt}T090000Z/${dt}T100000Z&details=${details}${recur}`
}
