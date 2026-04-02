import DashboardShell from '@/components/layout/DashboardShell'
import { getCachedEvents, getCachedTransactions, getRequiredUser } from '@/lib/server-data'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getRequiredUser()
  const userId = user.id
  const [transactions, events] = await Promise.all([
    getCachedTransactions(userId),
    getCachedEvents(userId),
  ])

  return (
    <DashboardShell user={user} transactions={transactions} events={events}>
      {children}
    </DashboardShell>
  )
}
