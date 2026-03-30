import { auth } from '@/auth'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { getCategories, getTransactions } from '@/lib/data'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const [transactions, categories] = await Promise.all([
    getTransactions(userId),
    getCategories(userId),
  ])

  return (
    <DashboardClient
      transactions={transactions}
      categories={categories}
    />
  )
}
