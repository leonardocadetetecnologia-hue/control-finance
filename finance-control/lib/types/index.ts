export type TransactionType = 'income' | 'expense'
export type RecMode = 'once' | 'installment' | 'monthly'
export type EventRepeat = 'once' | 'monthly' | 'yearly'
export type CategoryType = 'income' | 'expense' | 'both'

export interface Category {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  type: CategoryType
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  description: string
  value: number
  type: TransactionType
  category: string
  rec_mode: RecMode
  date: string
  total_parcelas?: number
  dia_venc?: number
  dur_months?: number
  created_at: string
  installments?: Installment[]
}

export interface Installment {
  id: string
  transaction_id: string
  user_id: string
  n: number
  date: string
  value: number
  paid: boolean
  rolled_over: number
}

export interface CalendarEvent {
  id: string
  user_id: string
  transaction_id?: string
  installment_n?: number
  description: string
  value: number
  type: TransactionType
  repeat: EventRepeat
  day?: number
  date?: string
  category?: string
}

export interface IncomeSource {
  id: string
  user_id: string
  name: string
  value: number
  day: number
  source_type: string
  start_date: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  emoji: string
  current_value: number
  target_value: number
}

export interface Metrics {
  balance: number
  income: number
  expenses: number
  toReceive: number
  toPay: number
}
