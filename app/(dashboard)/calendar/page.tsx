import CalendarClient from '@/components/calendar/CalendarClient'
import { getCachedEvents, getCachedTransactions, getRequiredUser } from '@/lib/server-data'

export default async function CalendarPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const [events, transactions] = await Promise.all([
    getCachedEvents(userId),
    getCachedTransactions(userId),
  ])

  return <CalendarClient initialEvents={events} initialTransactions={transactions} />
}
