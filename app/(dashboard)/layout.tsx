import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user
  if (!user) redirect('/login')

  return <DashboardShell user={user}>{children}</DashboardShell>
}
