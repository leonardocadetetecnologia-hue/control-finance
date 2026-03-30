import { createClient } from '@/lib/supabase/server'
import IncomeClient from '@/components/income/IncomeClient'

export default async function IncomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sources } = await supabase
    .from('income_sources')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return <IncomeClient initialSources={sources || []} />
}
