import { createClient } from '@/lib/supabase/server'
import HistoryClient from '@/components/history/HistoryClient'

export default async function HistoryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: transactions }, { data: installments }, { data: categories }] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', user!.id).order('date', { ascending: false }),
    supabase.from('installments').select('*').eq('user_id', user!.id).order('date', { ascending: true }),
    supabase.from('categories').select('name, emoji, color').eq('user_id', user!.id),
  ])

  return (
    <HistoryClient
      transactions={transactions || []}
      installments={installments || []}
      categories={categories || []}
    />
  )
}
