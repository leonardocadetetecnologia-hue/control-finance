import { auth } from '@/auth'
import HistoryClient from '@/components/history/HistoryClient'
import { getCategories, getInstallments, getTransactions } from '@/lib/data'
import { redirect } from 'next/navigation'

export default async function HistoryPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const [transactions, installments, categories] = await Promise.all([
    getTransactions(userId),
    getInstallments(userId),
    getCategories(userId),
  ])

  return (
    <HistoryClient
      transactions={transactions}
      installments={installments}
      categories={categories.map(({ name, emoji, color }) => ({ name, emoji, color }))}
    />
  )
}
