import { sql } from '@/lib/db'
import { normalizeDateOnly, parseDateAtNoon } from '@/lib/utils/format'

type TransactionPayload = {
  description: string
  value: number
  type: string
  category: string
  recMode: string
  date: string
  totalParcelas: number | null
  diaVenc: number | null
  durMonths: number | null
}

function monthlyEventDate(startDate: string, offset: number, dueDay: number) {
  const baseDate = parseDateAtNoon(startDate)
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth() + offset
  const lastDay = new Date(year, month + 1, 0).getDate()
  const eventDate = new Date(year, month, Math.min(dueDay, lastDay), 12)
  return eventDate.toISOString().split('T')[0]
}

function parcelDescription(description: string, current: number, total: number) {
  return `${description} - parcela ${String(current).padStart(2, '0')}/${String(total).padStart(2, '0')}`
}

export function buildTransactionStatements(userId: string, transactionId: string, payload: TransactionPayload) {
  const statements: any[] = [
    sql`
      insert into transactions (id, user_id, description, value, type, category, rec_mode, date, total_parcelas, dia_venc, dur_months)
      values (${transactionId}, ${userId}, ${payload.description}, ${payload.value}, ${payload.type}, ${payload.category}, ${payload.recMode}, ${payload.date}, ${payload.totalParcelas}, ${payload.diaVenc}, ${payload.durMonths})
    `,
  ]

  statements.push(...buildTransactionChildStatements(userId, transactionId, payload))
  return statements
}

export function buildTransactionChildStatements(userId: string, transactionId: string, payload: TransactionPayload) {
  const statements: any[] = []

  if (payload.recMode === 'installment' && payload.totalParcelas) {
    const perValue = payload.value / payload.totalParcelas
    const dueDay = payload.diaVenc || parseDateAtNoon(payload.date).getDate()

    for (let index = 0; index < payload.totalParcelas; index += 1) {
      const isoDate = monthlyEventDate(payload.date, index, dueDay)
      statements.push(
        sql`
          insert into installments (id, transaction_id, user_id, n, date, value, paid, rolled_over)
          values (${crypto.randomUUID()}, ${transactionId}, ${userId}, ${index + 1}, ${isoDate}, ${perValue}, false, 0)
        `,
        sql`
          insert into events (id, user_id, transaction_id, installment_n, description, value, type, repeat, day, date, category)
          values (${crypto.randomUUID()}, ${userId}, ${transactionId}, ${index + 1}, ${parcelDescription(payload.description, index + 1, payload.totalParcelas)}, ${perValue}, ${payload.type}, 'once', ${dueDay}, ${isoDate}, ${payload.category})
        `,
      )
    }
    return statements
  }

  if (payload.recMode === 'monthly') {
    const dueDay = payload.diaVenc || parseDateAtNoon(payload.date).getDate()

    if (payload.durMonths && payload.durMonths > 0) {
      for (let index = 0; index < payload.durMonths; index += 1) {
        const isoDate = monthlyEventDate(payload.date, index, dueDay)
        const description = payload.type === 'expense'
          ? parcelDescription(payload.description, index + 1, payload.durMonths)
          : payload.description
        statements.push(sql`
          insert into events (id, user_id, transaction_id, installment_n, description, value, type, repeat, day, date, category)
          values (${crypto.randomUUID()}, ${userId}, ${transactionId}, ${index + 1}, ${description}, ${payload.value}, ${payload.type}, 'once', ${dueDay}, ${isoDate}, ${payload.category})
        `)
      }
    } else {
      statements.push(sql`
        insert into events (id, user_id, transaction_id, description, value, type, repeat, day, date, category)
        values (${crypto.randomUUID()}, ${userId}, ${transactionId}, ${payload.description}, ${payload.value}, ${payload.type}, 'monthly', ${dueDay}, ${normalizeDateOnly(payload.date)}, ${payload.category})
      `)
    }
    return statements
  }

  statements.push(sql`
    insert into events (id, user_id, transaction_id, description, value, type, repeat, day, date, category)
    values (${crypto.randomUUID()}, ${userId}, ${transactionId}, ${payload.description}, ${payload.value}, ${payload.type}, 'once', ${parseDateAtNoon(payload.date).getDate()}, ${normalizeDateOnly(payload.date)}, ${payload.category})
  `)

  return statements
}
