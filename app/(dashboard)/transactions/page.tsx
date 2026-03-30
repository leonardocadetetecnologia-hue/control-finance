import { auth } from '@/auth'
import TransactionsClient from '@/components/transactions/TransactionsClient'
import { getCategories, getTransactions } from '@/lib/data'
import { redirect } from 'next/navigation'

export default async function TransactionsPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const [transactions, categories] = await Promise.all([
    getTransactions(userId),
    getCategories(userId),
  ])

  return (
    <TransactionsClient
      initialTransactions={transactions}
      categories={categories}
    />
  )
}
