import { auth } from '@/auth'
import CategoriesClient from '@/components/categories/CategoriesClient'
import { getCategories, getTransactions } from '@/lib/data'
import { redirect } from 'next/navigation'

export default async function CategoriesPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const [categories, transactions] = await Promise.all([
    getCategories(userId),
    getTransactions(userId),
  ])

  return (
    <CategoriesClient
      initialCategories={categories}
      transactions={transactions.map((transaction) => ({ id: transaction.id, category: transaction.category }))}
    />
  )
}
