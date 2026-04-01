import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()

    const [event] = await sql`
      insert into events (id, user_id, description, value, type, repeat, day, date, category)
      values (
        ${crypto.randomUUID()},
        ${userId},
        ${String(body.description || '').trim()},
        ${Number(body.value || 0)},
        ${String(body.type || 'expense')},
        ${String(body.repeat || 'once')},
        ${body.day ? Number(body.day) : null},
        ${body.date ? String(body.date) : null},
        ${String(body.category || 'Outros')}
      )
      returning id, user_id, transaction_id, installment_n, description, value, type, repeat, day, date, category
    `

    return NextResponse.json({ ...event, value: Number(event.value || 0) })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel salvar o evento.' }, { status: 500 })
  }
}
