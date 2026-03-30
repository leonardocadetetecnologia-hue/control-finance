import { createClient } from '@/lib/supabase/server'
import CategoriesClient from '@/components/categories/CategoriesClient'

export default async function CategoriesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', user!.id).order('name'),
    supabase.from('transactions').select('id, category').eq('user_id', user!.id),
  ])

  return (
    <CategoriesClient
      initialCategories={categories || []}
      transactions={transactions || []}
    />
  )
}
