import CalendarClient from '@/components/calendar/CalendarClient'
import { getCachedEvents, getRequiredUser } from '@/lib/server-data'

export default async function CalendarPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const events = await getCachedEvents(userId)

  return <CalendarClient initialEvents={events} />
}
