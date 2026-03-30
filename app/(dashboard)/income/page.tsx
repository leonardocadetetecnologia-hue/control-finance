import { auth } from '@/auth'
import IncomeClient from '@/components/income/IncomeClient'
import { getIncomeSources } from '@/lib/data'
import { redirect } from 'next/navigation'

export default async function IncomePage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const sources = await getIncomeSources(userId)

  return <IncomeClient initialSources={sources} />
}
