import { createClient } from '@/lib/supabase/server'
import TransactionsClient from '@/components/transactions/TransactionsClient'

export default async function TransactionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase.from('transactions').select('*, installments(*)').eq('user_id', user!.id).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').eq('user_id', user!.id),
  ])

  return (
    <TransactionsClient
      initialTransactions={transactions || []}
      categories={categories || []}
    />
  )
}
