import type { CalendarEvent, Installment, Metrics, Transaction, TransactionType } from '@/lib/types'
import { addMonths, todayISO } from '@/lib/utils/format'

export interface ExpandedFinanceRow {
  date: string
  description: string
  category: string
  type: TransactionType
  value: number
  status: string
  recMode: string
  transactionId?: string
}

export interface ReminderItem {
  id: string
  label: string
  date: string
  value: number
  kind: 'expense' | 'reminder'
}

function monthId(year: number, month: number) {
  return year * 12 + month
}

function isoDateForMonth(year: number, month: number, day: number) {
  return new Date(year, month, Math.min(day, 28)).toISOString().split('T')[0]
}

function parseMonthId(date: string) {
  const d = new Date(`${date}T12:00:00`)
  return monthId(d.getFullYear(), d.getMonth())
}

function getDueDay(transaction: Transaction) {
  return transaction.dia_venc || new Date(`${transaction.date}T12:00:00`).getDate()
}

export function getMonthlyOccurrenceDate(transaction: Transaction, year: number, month: number) {
  return isoDateForMonth(year, month, getDueDay(transaction))
}

export function monthlyTransactionOccursInMonth(transaction: Transaction, year: number, month: number) {
  if (transaction.rec_mode !== 'monthly') return false

  const startId = parseMonthId(transaction.date)
  const targetId = monthId(year, month)
  if (targetId < startId) return false

  if (!transaction.dur_months) return true

  return targetId <= startId + transaction.dur_months - 1
}

export function expandTransactionsForMonth(transactions: (Transaction & { installments?: Installment[] })[], year: number, month: number) {
  const today = todayISO()
  const rows: ExpandedFinanceRow[] = []

  transactions.forEach((transaction) => {
    if (transaction.rec_mode === 'installment') {
      ;(transaction.installments || []).forEach((installment) => {
        const due = new Date(`${installment.date}T12:00:00`)
        if (due.getFullYear() !== year || due.getMonth() !== month) return

        rows.push({
          date: installment.date,
          description: `${transaction.description} (${installment.n}/${transaction.total_parcelas || 1})`,
          category: transaction.category,
          type: transaction.type,
          value: installment.value,
          status: installment.paid ? 'Paga' : installment.date < today ? 'Vencida' : 'Pendente',
          recMode: 'Parcelado',
          transactionId: transaction.id,
        })
      })
      return
    }

    if (transaction.rec_mode === 'monthly') {
      if (!monthlyTransactionOccursInMonth(transaction, year, month)) return
      const occurrenceDate = getMonthlyOccurrenceDate(transaction, year, month)
      rows.push({
        date: occurrenceDate,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        value: transaction.value,
        status: occurrenceDate < today ? 'Recorrente' : 'Agendada',
        recMode: transaction.dur_months ? 'Recorrente' : 'Recorrente sem fim',
        transactionId: transaction.id,
      })
      return
    }

    const date = new Date(`${transaction.date}T12:00:00`)
    if (date.getFullYear() !== year || date.getMonth() !== month) return

    rows.push({
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      type: transaction.type,
      value: transaction.value,
      status: transaction.date < today ? 'Confirmada' : 'Agendada',
      recMode: 'Avulso',
      transactionId: transaction.id,
    })
  })

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export function expandTransactionsForRange(
  transactions: (Transaction & { installments?: Installment[] })[],
  from: string,
  to: string,
) {
  const start = parseMonthId(from)
  const end = parseMonthId(to)
  const rows: ExpandedFinanceRow[] = []

  transactions.forEach((transaction) => {
    if (transaction.rec_mode === 'installment') {
      ;(transaction.installments || []).forEach((installment) => {
        if (installment.date < from || installment.date > to) return
        rows.push({
          date: installment.date,
          description: `${transaction.description} (${installment.n}/${transaction.total_parcelas || 1})`,
          category: transaction.category,
          type: transaction.type,
          value: installment.value,
          status: installment.paid ? 'Paga' : installment.date < todayISO() ? 'Vencida' : 'Pendente',
          recMode: 'Parcelado',
          transactionId: transaction.id,
        })
      })
      return
    }

    if (transaction.rec_mode === 'monthly') {
      const transactionStart = parseMonthId(transaction.date)
      const transactionEnd = transaction.dur_months ? transactionStart + transaction.dur_months - 1 : end
      const rangeStart = Math.max(start, transactionStart)
      const rangeEnd = Math.min(end, transactionEnd)
      if (rangeStart > rangeEnd) return

      for (let current = rangeStart; current <= rangeEnd; current += 1) {
        const yearValue = Math.floor(current / 12)
        const monthValue = current % 12
        rows.push({
          date: getMonthlyOccurrenceDate(transaction, yearValue, monthValue),
          description: transaction.description,
          category: transaction.category,
          type: transaction.type,
          value: transaction.value,
          status: 'Recorrente',
          recMode: transaction.dur_months ? 'Recorrente' : 'Recorrente sem fim',
          transactionId: transaction.id,
        })
      }
      return
    }

    if (transaction.date >= from && transaction.date <= to) {
      rows.push({
        date: transaction.date,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        value: transaction.value,
        status: 'Confirmada',
        recMode: 'Avulso',
        transactionId: transaction.id,
      })
    }
  })

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export function buildMetrics(transactions: (Transaction & { installments?: Installment[] })[], year: number, month: number): Metrics {
  const rows = expandTransactionsForMonth(transactions, year, month)
  const today = todayISO()
  const income = rows.filter(row => row.type === 'income').reduce((sum, row) => sum + row.value, 0)
  const expenses = rows.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.value, 0)
  const toReceive = rows.filter(row => row.type === 'income' && row.date >= today).reduce((sum, row) => sum + row.value, 0)
  const toPay = rows.filter(row => row.type === 'expense' && row.date >= today && row.status !== 'Paga').reduce((sum, row) => sum + row.value, 0)

  return {
    balance: income - expenses,
    income,
    expenses,
    toReceive,
    toPay,
  }
}

function nextOccurrenceFromDay(day: number, today: string) {
  const todayDate = new Date(`${today}T12:00:00`)
  const candidate = new Date(todayDate.getFullYear(), todayDate.getMonth(), Math.min(day, 28))
  if (candidate.toISOString().split('T')[0] < today) {
    return addMonths(candidate.toISOString().split('T')[0], 1)
  }
  return candidate.toISOString().split('T')[0]
}

export function buildUpcomingReminders(
  transactions: (Transaction & { installments?: Installment[] })[],
  events: CalendarEvent[],
  limit = 4,
) {
  const today = todayISO()
  const reminders: ReminderItem[] = []

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense') return

    if (transaction.rec_mode === 'installment') {
      ;(transaction.installments || [])
        .filter(installment => !installment.paid)
        .forEach((installment) => {
          reminders.push({
            id: installment.id,
            label: `${transaction.description} ${installment.n}/${transaction.total_parcelas || 1}`,
            date: installment.date,
            value: installment.value,
            kind: 'expense',
          })
        })
      return
    }

    if (transaction.rec_mode === 'monthly') {
      const nextDate = nextOccurrenceFromDay(getDueDay(transaction), today)
      reminders.push({
        id: transaction.id,
        label: transaction.description,
        date: nextDate,
        value: transaction.value,
        kind: 'expense',
      })
      return
    }

    if (transaction.date >= today) {
      reminders.push({
        id: transaction.id,
        label: transaction.description,
        date: transaction.date,
        value: transaction.value,
        kind: 'expense',
      })
    }
  })

  events
    .filter(event => !event.transaction_id)
    .forEach((event) => {
      const kind = (event.category || '').startsWith('REMINDER_') ? 'reminder' : event.type === 'expense' ? 'expense' : null
      if (!kind) return

      const eventDate = event.repeat === 'monthly'
        ? nextOccurrenceFromDay(event.day || 1, today)
        : event.date

      if (!eventDate || eventDate < today) return

      reminders.push({
        id: event.id,
        label: (event.category || '').startsWith('REMINDER_')
          ? ((event.category || '').replace('REMINDER_', '').replace(/_/g, ' ') || event.description)
          : event.description,
        date: eventDate,
        value: Number(event.value || 0),
        kind,
      })
    })

  return reminders
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}
