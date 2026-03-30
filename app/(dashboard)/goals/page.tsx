import { createClient } from '@/lib/supabase/server'
import GoalsClient from '@/components/goals/GoalsClient'

export default async function GoalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return <GoalsClient initialGoals={goals || []} />
}
