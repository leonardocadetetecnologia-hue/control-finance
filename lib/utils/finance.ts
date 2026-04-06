import type {
  CalendarEvent,
  CashflowSettlement,
  IncomeSource,
  Installment,
  Metrics,
  Transaction,
  TransactionType,
} from '@/lib/types'
import { todayISO } from '@/lib/utils/format'

export interface ExpandedFinanceRow {
  date: string
  description: string
  category: string
  type: TransactionType
  value: number
  status: string
  recMode: string
  transactionId?: string
  sourceId?: string
  installmentId?: string
  settled?: boolean
  settlementId?: string
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

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function isoDateForMonth(year: number, month: number, day: number) {
  return new Date(year, month, Math.min(day, daysInMonth(year, month)), 12).toISOString().split('T')[0]
}

function parseMonthId(date: string) {
  const d = new Date(`${date}T12:00:00`)
  return monthId(d.getFullYear(), d.getMonth())
}

function getDueDay(transaction: Transaction) {
  return transaction.dia_venc || new Date(`${transaction.date}T12:00:00`).getDate()
}

function buildSettlementLookup(settlements: CashflowSettlement[]) {
  const map = new Map<string, CashflowSettlement>()

  settlements.forEach((settlement) => {
    if (settlement.transaction_id) {
      map.set(`tx:${settlement.transaction_id}:${settlement.occurrence_date}`, settlement)
    }
    if (settlement.income_source_id) {
      map.set(`income:${settlement.income_source_id}:${settlement.occurrence_date}`, settlement)
    }
  })

  return map
}

function getSettlementStatus(type: TransactionType, date: string, settled: boolean, today: string) {
  if (settled) return type === 'income' ? 'Recebido' : 'Quitado'
  if (date < today) return type === 'income' ? 'A receber' : 'Em aberto'
  return type === 'income' ? 'Previsto' : 'Agendado'
}

export function getMonthlyOccurrenceDate(transaction: Transaction, year: number, month: number) {
  return isoDateForMonth(year, month, getDueDay(transaction))
}

export function getIncomeSourceOccurrenceDate(source: IncomeSource, year: number, month: number) {
  return isoDateForMonth(year, month, source.day)
}

export function incomeSourceOccursInMonth(source: IncomeSource, year: number, month: number) {
  const startId = parseMonthId(source.start_date)
  const targetId = monthId(year, month)
  return targetId >= startId
}

export function monthlyTransactionOccursInMonth(transaction: Transaction, year: number, month: number) {
  if (transaction.rec_mode !== 'monthly') return false

  const startId = parseMonthId(transaction.date)
  const targetId = monthId(year, month)
  if (targetId < startId) return false

  if (!transaction.dur_months) return true

  return targetId <= startId + transaction.dur_months - 1
}

export function expandIncomeSourcesForMonth(
  sources: IncomeSource[],
  year: number,
  month: number,
  settlements: CashflowSettlement[] = [],
) {
  const today = todayISO()
  const settlementLookup = buildSettlementLookup(settlements)

  return sources
    .filter(source => incomeSourceOccursInMonth(source, year, month))
    .map<ExpandedFinanceRow>((source) => {
      const occurrenceDate = getIncomeSourceOccurrenceDate(source, year, month)
      const settlement = settlementLookup.get(`income:${source.id}:${occurrenceDate}`)
      const settled = Boolean(settlement)

      return {
        date: occurrenceDate,
        description: source.name,
        category: source.source_type || 'Renda',
        type: 'income',
        value: source.value,
        status: getSettlementStatus('income', occurrenceDate, settled, today),
        recMode: 'Renda fixa',
        sourceId: source.id,
        settled,
        settlementId: settlement?.id,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function expandTransactionsForMonth(
  transactions: (Transaction & { installments?: Installment[] })[],
  year: number,
  month: number,
  settlements: CashflowSettlement[] = [],
) {
  const today = todayISO()
  const settlementLookup = buildSettlementLookup(settlements)
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
          status: installment.paid ? 'Quitado' : installment.date < today ? 'Em aberto' : 'Pendente',
          recMode: 'Parcelado',
          transactionId: transaction.id,
          installmentId: installment.id,
          settled: installment.paid,
        })
      })
      return
    }

    if (transaction.rec_mode === 'monthly') {
      if (!monthlyTransactionOccursInMonth(transaction, year, month)) return
      const occurrenceDate = getMonthlyOccurrenceDate(transaction, year, month)
      const settlement = settlementLookup.get(`tx:${transaction.id}:${occurrenceDate}`)
      const settled = Boolean(settlement)

      rows.push({
        date: occurrenceDate,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        value: transaction.value,
        status: getSettlementStatus(transaction.type, occurrenceDate, settled, today),
        recMode: transaction.dur_months ? 'Recorrente' : 'Recorrente sem fim',
        transactionId: transaction.id,
        settled,
        settlementId: settlement?.id,
      })
      return
    }

    const date = new Date(`${transaction.date}T12:00:00`)
    if (date.getFullYear() !== year || date.getMonth() !== month) return

    const settlement = settlementLookup.get(`tx:${transaction.id}:${transaction.date}`)
    const settled = Boolean(settlement)

    rows.push({
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      type: transaction.type,
      value: transaction.value,
      status: getSettlementStatus(transaction.type, transaction.date, settled, today),
      recMode: 'Avulso',
      transactionId: transaction.id,
      settled,
      settlementId: settlement?.id,
    })
  })

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export function expandIncomeSourcesForRange(
  sources: IncomeSource[],
  from: string,
  to: string,
  settlements: CashflowSettlement[] = [],
) {
  const start = parseMonthId(from)
  const end = parseMonthId(to)
  const today = todayISO()
  const settlementLookup = buildSettlementLookup(settlements)
  const rows: ExpandedFinanceRow[] = []

  sources.forEach((source) => {
    const sourceStart = parseMonthId(source.start_date)
    const rangeStart = Math.max(start, sourceStart)

    for (let current = rangeStart; current <= end; current += 1) {
      const yearValue = Math.floor(current / 12)
      const monthValue = current % 12
      const occurrenceDate = getIncomeSourceOccurrenceDate(source, yearValue, monthValue)
      if (occurrenceDate < from || occurrenceDate > to) continue

      const settlement = settlementLookup.get(`income:${source.id}:${occurrenceDate}`)
      const settled = Boolean(settlement)

      rows.push({
        date: occurrenceDate,
        description: source.name,
        category: source.source_type || 'Renda',
        type: 'income',
        value: source.value,
        status: getSettlementStatus('income', occurrenceDate, settled, today),
        recMode: 'Renda fixa',
        sourceId: source.id,
        settled,
        settlementId: settlement?.id,
      })
    }
  })

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export function expandTransactionsForRange(
  transactions: (Transaction & { installments?: Installment[] })[],
  from: string,
  to: string,
  settlements: CashflowSettlement[] = [],
) {
  const start = parseMonthId(from)
  const end = parseMonthId(to)
  const today = todayISO()
  const settlementLookup = buildSettlementLookup(settlements)
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
          status: installment.paid ? 'Quitado' : installment.date < today ? 'Em aberto' : 'Pendente',
          recMode: 'Parcelado',
          transactionId: transaction.id,
          installmentId: installment.id,
          settled: installment.paid,
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
        const occurrenceDate = getMonthlyOccurrenceDate(transaction, yearValue, monthValue)
        if (occurrenceDate < from || occurrenceDate > to) continue

        const settlement = settlementLookup.get(`tx:${transaction.id}:${occurrenceDate}`)
        const settled = Boolean(settlement)

        rows.push({
          date: occurrenceDate,
          description: transaction.description,
          category: transaction.category,
          type: transaction.type,
          value: transaction.value,
          status: getSettlementStatus(transaction.type, occurrenceDate, settled, today),
          recMode: transaction.dur_months ? 'Recorrente' : 'Recorrente sem fim',
          transactionId: transaction.id,
          settled,
          settlementId: settlement?.id,
        })
      }
      return
    }

    if (transaction.date >= from && transaction.date <= to) {
      const settlement = settlementLookup.get(`tx:${transaction.id}:${transaction.date}`)
      const settled = Boolean(settlement)

      rows.push({
        date: transaction.date,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        value: transaction.value,
        status: getSettlementStatus(transaction.type, transaction.date, settled, today),
        recMode: 'Avulso',
        transactionId: transaction.id,
        settled,
        settlementId: settlement?.id,
      })
    }
  })

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export function buildTimelineRows(
  transactions: (Transaction & { installments?: Installment[] })[],
  incomeSources: IncomeSource[],
  settlements: CashflowSettlement[],
  from: string,
  to: string,
) {
  return [
    ...expandTransactionsForRange(transactions, from, to, settlements),
    ...expandIncomeSourcesForRange(incomeSources, from, to, settlements),
  ].sort((a, b) => b.date.localeCompare(a.date))
}

export function buildMonthRows(
  transactions: (Transaction & { installments?: Installment[] })[],
  incomeSources: IncomeSource[],
  year: number,
  month: number,
  settlements: CashflowSettlement[] = [],
) {
  return [
    ...expandTransactionsForMonth(transactions, year, month, settlements),
    ...expandIncomeSourcesForMonth(incomeSources, year, month, settlements),
  ].sort((a, b) => a.date.localeCompare(b.date))
}

export function buildPendingDebitRows(
  transactions: (Transaction & { installments?: Installment[] })[],
  settlements: CashflowSettlement[],
  referenceDate = todayISO(),
) {
  if (transactions.length === 0) return [] as ExpandedFinanceRow[]

  const earliestDate = transactions.reduce((earliest, transaction) => {
    const installmentDates = (transaction.installments || []).map((installment) => installment.date)
    const transactionDates = [transaction.date, ...installmentDates]
    const transactionEarliest = transactionDates.sort()[0] || transaction.date
    return transactionEarliest < earliest ? transactionEarliest : earliest
  }, referenceDate)

  return expandTransactionsForRange(transactions, earliestDate, referenceDate, settlements)
    .filter((row) => row.type === 'expense' && !row.settled && row.date < referenceDate)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function buildMetrics(
  transactions: (Transaction & { installments?: Installment[] })[],
  year: number,
  month: number,
  incomeSources: IncomeSource[] = [],
  settlements: CashflowSettlement[] = [],
): Metrics {
  const rows = buildMonthRows(transactions, incomeSources, year, month, settlements)
  const today = todayISO()
  const income = rows.filter(row => row.type === 'income').reduce((sum, row) => sum + row.value, 0)
  const expenses = rows.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.value, 0)
  const toReceive = rows.filter(row => row.type === 'income' && row.date >= today && !row.settled).reduce((sum, row) => sum + row.value, 0)
  const toPay = rows.filter(row => row.type === 'expense' && row.date >= today && !row.settled).reduce((sum, row) => sum + row.value, 0)

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
  const buildDate = (year: number, month: number) =>
    new Date(year, month, Math.min(day, daysInMonth(year, month)), 12)

  const candidate = buildDate(todayDate.getFullYear(), todayDate.getMonth())
  if (candidate.toISOString().split('T')[0] < today) {
    return buildDate(todayDate.getFullYear(), todayDate.getMonth() + 1).toISOString().split('T')[0]
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
