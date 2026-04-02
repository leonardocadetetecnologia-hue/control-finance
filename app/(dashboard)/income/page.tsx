import IncomeClient from '@/components/income/IncomeClient'
import { getCachedIncomeSources, getRequiredUser } from '@/lib/server-data'

export default async function IncomePage() {
  const user = await getRequiredUser()
  const userId = user.id

  const sources = await getCachedIncomeSources(userId)

  return <IncomeClient initialSources={sources} />
}
