import GoalsClient from '@/components/goals/GoalsClient'
import { getCachedGoals, getRequiredUser } from '@/lib/server-data'

export default async function GoalsPage() {
  const user = await getRequiredUser()
  const userId = user.id

  const goals = await getCachedGoals(userId)

  return <GoalsClient initialGoals={goals} />
}
