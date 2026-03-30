import type { CalendarEvent, Category, Goal, IncomeSource, Installment, Transaction } from '@/lib/types'
import { sql } from '@/lib/db'

type DbUser = {
  id: string
  email: string
  name: string | null
  password_hash: string
}

type DbCategory = Omit<Category, 'created_at'> & { created_at: string | Date }
type DbTransaction = Omit<Transaction, 'value' | 'created_at' | 'installments'> & { value: string | number; created_at: string | Date }
type DbInstallment = Omit<Installment, 'value'> & { value: string | number; created_at?: string | Date }
type DbEvent = Omit<CalendarEvent, 'value'> & { value: string | number; created_at?: string | Date }
type DbIncome = Omit<IncomeSource, 'value'> & { value: string | number; created_at?: string | Date }
type DbGoal = Omit<Goal, 'current_value' | 'target_value'> & { current_value: string | number; target_value: string | number; created_at?: string | Date }

function toIso(value: string | Date | undefined) {
  if (!value) return new Date().toISOString()
  return typeof value === 'string' ? value : value.toISOString()
}

function toNumber(value: string | number | undefined | null) {
  return Number(value || 0)
}

export async function getUserByEmail(email: string) {
  const rows = await sql`
    select id, email, name, password_hash
    from users
    where email = ${email}
    limit 1
  ` as DbUser[]
  return rows[0] || null
}

export async function getCategories(userId: string): Promise<Category[]> {
  const rows = await sql`
    select id, user_id, name, emoji, color, type, created_at
    from categories
    where user_id = ${userId}
    order by name asc
  ` as DbCategory[]

  return rows.map((row) => ({ ...row, created_at: toIso(row.created_at) }))
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const txRows = await sql`
    select id, user_id, description, value, type, category, rec_mode, date, total_parcelas, dia_venc, dur_months, created_at
    from transactions
    where user_id = ${userId}
    order by created_at desc
  ` as DbTransaction[]

  const installmentRows = await sql`
    select id, transaction_id, user_id, n, date, value, paid, rolled_over, created_at
    from installments
    where user_id = ${userId}
    order by n asc
  ` as DbInstallment[]

  const installmentsByTransaction = new Map<string, Installment[]>()
  installmentRows.forEach((row) => {
    const installment: Installment = {
      id: row.id,
      transaction_id: row.transaction_id,
      user_id: row.user_id,
      n: row.n,
      date: row.date,
      value: toNumber(row.value),
      paid: row.paid,
      rolled_over: row.rolled_over,
    }

    const current = installmentsByTransaction.get(row.transaction_id) || []
    current.push(installment)
    installmentsByTransaction.set(row.transaction_id, current)
  })

  return txRows.map((row) => ({
    ...row,
    value: toNumber(row.value),
    created_at: toIso(row.created_at),
    installments: installmentsByTransaction.get(row.id) || [],
  }))
}

export async function getEvents(userId: string): Promise<CalendarEvent[]> {
  const rows = await sql`
    select id, user_id, transaction_id, installment_n, description, value, type, repeat, day, date, category, created_at
    from events
    where user_id = ${userId}
    order by coalesce(date::text, lpad(coalesce(day, 1)::text, 2, '0')) asc
  ` as DbEvent[]

  return rows.map((row) => ({ ...row, value: toNumber(row.value) }))
}

export async function getIncomeSources(userId: string): Promise<IncomeSource[]> {
  const rows = await sql`
    select id, user_id, name, value, day, source_type, start_date, created_at
    from income_sources
    where user_id = ${userId}
    order by created_at desc
  ` as DbIncome[]

  return rows.map((row) => ({ ...row, value: toNumber(row.value) }))
}

export async function getGoals(userId: string): Promise<Goal[]> {
  const rows = await sql`
    select id, user_id, name, emoji, current_value, target_value, created_at
    from goals
    where user_id = ${userId}
    order by created_at desc
  ` as DbGoal[]

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    emoji: row.emoji,
    current_value: toNumber(row.current_value),
    target_value: toNumber(row.target_value),
  }))
}

export async function getInstallments(userId: string): Promise<Installment[]> {
  const rows = await sql`
    select id, transaction_id, user_id, n, date, value, paid, rolled_over, created_at
    from installments
    where user_id = ${userId}
    order by date asc
  ` as DbInstallment[]

  return rows.map((row) => ({
    id: row.id,
    transaction_id: row.transaction_id,
    user_id: row.user_id,
    n: row.n,
    date: row.date,
    value: toNumber(row.value),
    paid: row.paid,
    rolled_over: row.rolled_over,
  }))
}
