import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase.from('transactions').select('*, installments(*)').eq('user_id', user!.id).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').eq('user_id', user!.id),
  ])

  return (
    <DashboardClient
      transactions={transactions || []}
      categories={categories || []}
    />
  )
}
