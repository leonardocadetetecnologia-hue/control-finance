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

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function addOneDay(date: string) {
  const nextDate = new Date(`${date}T12:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  return nextDate.toISOString().split('T')[0]
}

type CalendarExportItem = {
  id: string
  title: string
  date: string
  description: string
}

export function buildFinanceCalendarIcs(items: CalendarExportItem[], calendarName = 'Finance Control') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Finance Control//PT-BR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ]

  items.forEach((item) => {
    const date = item.date.replace(/-/g, '')
    const nextDate = addOneDay(item.date).replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@finance-control`,
      `SUMMARY:${escapeIcsText(item.title)}`,
      `DESCRIPTION:${escapeIcsText(item.description)}`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${nextDate}`,
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function downloadFinanceCalendarIcs(items: CalendarExportItem[], fileName: string) {
  const content = buildFinanceCalendarIcs(items)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
