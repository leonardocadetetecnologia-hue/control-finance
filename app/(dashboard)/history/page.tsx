import HistoryClient from '@/components/history/HistoryClient'
import { getCachedCategories, getCachedInstallments, getCachedTransactions, getRequiredUser } from '@/lib/server-data'

export default async function HistoryPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const [transactions, installments, categories] = await Promise.all([
    getCachedTransactions(userId),
    getCachedInstallments(userId),
    getCachedCategories(userId),
  ])

  return (
    <HistoryClient
      transactions={transactions}
      installments={installments}
      categories={categories.map(({ name, emoji, color }) => ({ name, emoji, color }))}
    />
  )
}
