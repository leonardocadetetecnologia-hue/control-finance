import HistoryClient from '@/components/history/HistoryClient'
import {
  getCachedCashflowSettlements,
  getCachedCategories,
  getCachedIncomeSources,
  getCachedInstallments,
  getCachedTransactions,
  getRequiredUser,
} from '@/lib/server-data'

export default async function HistoryPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const [transactions, installments, categories, incomeSources, cashflowSettlements] = await Promise.all([
    getCachedTransactions(userId),
    getCachedInstallments(userId),
    getCachedCategories(userId),
    getCachedIncomeSources(userId),
    getCachedCashflowSettlements(userId),
  ])

  return (
    <HistoryClient
      transactions={transactions}
      installments={installments}
      incomeSources={incomeSources}
      cashflowSettlements={cashflowSettlements}
      categories={categories.map(({ name, emoji, color }) => ({ name, emoji, color }))}
    />
  )
}
