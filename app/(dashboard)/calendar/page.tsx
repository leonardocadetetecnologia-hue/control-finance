import { auth } from '@/auth'
import CalendarClient from '@/components/calendar/CalendarClient'
import { getEvents } from '@/lib/data'
import { redirect } from 'next/navigation'

export default async function CalendarPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const events = await getEvents(userId)

  return <CalendarClient initialEvents={events} />
}
