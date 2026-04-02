import DashboardClient from '@/components/dashboard/DashboardClient'
import { getCachedCategories, getCachedTransactions, getRequiredUser } from '@/lib/server-data'

export default async function DashboardPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const [transactions, categories] = await Promise.all([
    getCachedTransactions(userId),
    getCachedCategories(userId),
  ])

  return (
    <DashboardClient
      transactions={transactions}
      categories={categories}
    />
  )
}
