import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import {
  getCategories,
  getEvents,
  getGoals,
  getIncomeSources,
  getInstallments,
  getTransactions,
} from '@/lib/data'

type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
}

export const getRequiredUser = cache(async (): Promise<SessionUser> => {
  const session = await auth()
  const user = session?.user

  if (!user?.id) {
    redirect('/login')
  }

  return user as SessionUser
})

export const getCachedTransactions = cache(async (userId: string) => getTransactions(userId))
export const getCachedEvents = cache(async (userId: string) => getEvents(userId))
export const getCachedCategories = cache(async (userId: string) => getCategories(userId))
export const getCachedIncomeSources = cache(async (userId: string) => getIncomeSources(userId))
export const getCachedGoals = cache(async (userId: string) => getGoals(userId))
export const getCachedInstallments = cache(async (userId: string) => getInstallments(userId))
