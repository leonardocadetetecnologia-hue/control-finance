import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/layout/DashboardShell'
import { getEvents, getTransactions } from '@/lib/data'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user
  if (!user) redirect('/login')

  const userId = user.id
  const [transactions, events] = await Promise.all([
    getTransactions(userId),
    getEvents(userId),
  ])

  return (
    <DashboardShell user={user} transactions={transactions} events={events}>
      {children}
    </DashboardShell>
  )
}
