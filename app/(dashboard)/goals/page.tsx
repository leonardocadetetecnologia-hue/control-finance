import { auth } from '@/auth'
import GoalsClient from '@/components/goals/GoalsClient'
import { getGoals } from '@/lib/data'
import { redirect } from 'next/navigation'

export default async function GoalsPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const goals = await getGoals(userId)

  return <GoalsClient initialGoals={goals} />
}
