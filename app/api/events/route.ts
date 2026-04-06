import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { normalizeDateOnly } from '@/lib/utils/format'
import { parseMoneyInput } from '@/lib/utils/money'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const rawValue = String(body.value ?? '').trim()
    const parsedValue = rawValue ? parseMoneyInput(body.value) : 0

    if (rawValue && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
      return NextResponse.json({ error: 'Informe um valor valido.' }, { status: 400 })
    }

    const [event] = await sql`
      insert into events (id, user_id, description, value, type, repeat, day, date, category)
      values (
        ${crypto.randomUUID()},
        ${userId},
        ${String(body.description || '').trim()},
        ${parsedValue},
        ${String(body.type || 'expense')},
        ${String(body.repeat || 'once')},
        ${body.day ? Number(body.day) : null},
        ${body.date ? String(body.date) : null},
        ${String(body.category || 'Outros')}
      )
      returning id, user_id, transaction_id, installment_n, description, value, type, repeat, day, date, category
    `

    return NextResponse.json({
      ...event,
      date: event.date ? normalizeDateOnly(event.date) : undefined,
      value: Number(event.value || 0),
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel salvar o evento.' }, { status: 500 })
  }
}
