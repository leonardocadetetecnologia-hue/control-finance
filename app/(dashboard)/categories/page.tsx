import CategoriesClient from '@/components/categories/CategoriesClient'
import { getCachedCategories, getCachedTransactions, getRequiredUser } from '@/lib/server-data'

export default async function CategoriesPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const [categories, transactions] = await Promise.all([
    getCachedCategories(userId),
    getCachedTransactions(userId),
  ])

  return (
    <CategoriesClient
      initialCategories={categories}
      transactions={transactions.map((transaction) => ({ id: transaction.id, category: transaction.category }))}
    />
  )
}
