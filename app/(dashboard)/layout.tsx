import DashboardShell from '@/components/layout/DashboardShell'
import { getCachedEvents, getCachedIncomeSources, getCachedTransactions, getRequiredUser } from '@/lib/server-data'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getRequiredUser()
  const userId = user.id
  const [transactions, events, incomeSources] = await Promise.all([
    getCachedTransactions(userId),
    getCachedEvents(userId),
    getCachedIncomeSources(userId),
  ])

  return (
    <DashboardShell user={user} transactions={transactions} events={events} incomeSources={incomeSources}>
      {children}
    </DashboardShell>
  )
}
