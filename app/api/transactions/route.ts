import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { getTransactions } from '@/lib/data'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()

    const description = String(body.description || '').trim()
    const value = Number(body.value || 0)
    const type = String(body.type || 'expense')
    const category = String(body.category || 'Outros')
    const recMode = String(body.rec_mode || 'once')
    const date = String(body.date || '')
    const totalParcelas = body.total_parcelas ? Number(body.total_parcelas) : null
    const diaVenc = body.dia_venc ? Number(body.dia_venc) : null
    const durMonths = body.dur_months ? Number(body.dur_months) : null

    if (!description || !value || !date) {
      return NextResponse.json({ error: 'Preencha descriÃ§Ã£o, valor e data.' }, { status: 400 })
    }

    const transactionId = crypto.randomUUID()
    const statements = [
      sql`
        insert into transactions (id, user_id, description, value, type, category, rec_mode, date, total_parcelas, dia_venc, dur_months)
        values (${transactionId}, ${userId}, ${description}, ${value}, ${type}, ${category}, ${recMode}, ${date}, ${totalParcelas}, ${diaVenc}, ${durMonths})
      `,
    ]

    if (recMode === 'installment' && totalParcelas) {
      const perValue = value / totalParcelas
      const dueDay = diaVenc || new Date(`${date}T12:00`).getDate()

      for (let i = 0; i < totalParcelas; i += 1) {
        const baseDate = new Date(`${date}T12:00`)
        const installmentDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, dueDay)
        const isoDate = installmentDate.toISOString().split('T')[0]

        statements.push(
          sql`
            insert into installments (id, transaction_id, user_id, n, date, value, paid, rolled_over)
            values (${crypto.randomUUID()}, ${transactionId}, ${userId}, ${i + 1}, ${isoDate}, ${perValue}, false, 0)
          `,
          sql`
            insert into events (id, user_id, transaction_id, installment_n, description, value, type, repeat, day, date, category)
            values (${crypto.randomUUID()}, ${userId}, ${transactionId}, ${i + 1}, ${`${i + 1}/${totalParcelas} ${description}`}, ${perValue}, ${type}, 'once', ${dueDay}, ${isoDate}, ${category})
          `,
        )
      }
    } else if (recMode === 'monthly') {
      const dueDay = diaVenc || new Date(`${date}T12:00`).getDate()
      const months = durMonths || 12

      for (let i = 0; i < months; i += 1) {
        const baseDate = new Date(`${date}T12:00`)
        const eventDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, Math.min(dueDay, 28))
        const isoDate = eventDate.toISOString().split('T')[0]

        statements.push(sql`
          insert into events (id, user_id, transaction_id, description, value, type, repeat, day, date, category)
          values (${crypto.randomUUID()}, ${userId}, ${transactionId}, ${description}, ${value}, ${type}, 'once', ${eventDate.getDate()}, ${isoDate}, ${category})
        `)
      }
    } else {
      statements.push(sql`
        insert into events (id, user_id, transaction_id, description, value, type, repeat, day, date, category)
        values (${crypto.randomUUID()}, ${userId}, ${transactionId}, ${description}, ${value}, ${type}, 'once', ${new Date(`${date}T12:00`).getDate()}, ${date}, ${category})
      `)
    }

    await sql.transaction(statements)
    const transactions = await getTransactions(userId)
    return NextResponse.json({ transactions })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'NÃ£o autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'NÃ£o foi possÃ­vel salvar a transaÃ§Ã£o.' }, { status: 500 })
  }
}
