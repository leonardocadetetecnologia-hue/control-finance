import TransactionsClient from '@/components/transactions/TransactionsClient'
import { getCachedCategories, getCachedTransactions, getRequiredUser } from '@/lib/server-data'

export default async function TransactionsPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const [transactions, categories] = await Promise.all([
    getCachedTransactions(userId),
    getCachedCategories(userId),
  ])

  return (
    <TransactionsClient
      initialTransactions={transactions}
      categories={categories}
    />
  )
}
