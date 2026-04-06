import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { normalizeDateOnly } from '@/lib/utils/format'
import { parseMoneyInput } from '@/lib/utils/money'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const rawValue = String(body.value ?? '').trim()
    const parsedValue = rawValue ? parseMoneyInput(body.value) : 0
    const repeat = String(body.repeat || 'once')
    const date = body.date ? String(body.date) : null
    const day = body.day ? Number(body.day) : null

    if (!String(body.description || '').trim()) {
      return NextResponse.json({ error: 'Informe a descricao do evento.' }, { status: 400 })
    }

    if (rawValue && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
      return NextResponse.json({ error: 'Informe um valor valido.' }, { status: 400 })
    }

    if ((repeat === 'once' || repeat === 'yearly') && !date) {
      return NextResponse.json({ error: 'Informe a data do evento.' }, { status: 400 })
    }

    if (repeat === 'monthly' && (!day || !Number.isInteger(day) || day < 1 || day > 31)) {
      return NextResponse.json({ error: 'Informe um dia valido para a recorrencia.' }, { status: 400 })
    }

    const [event] = await sql`
      update events
      set
        description = ${String(body.description || '').trim()},
        value = ${parsedValue},
        type = ${String(body.type || 'expense')},
        repeat = ${repeat},
        day = ${repeat === 'monthly' ? day : null},
        date = ${repeat === 'monthly' ? null : date},
        category = ${String(body.category || 'Outros')}
      where id = ${params.id} and user_id = ${userId} and transaction_id is null
      returning id, user_id, transaction_id, installment_n, description, value, type, repeat, day, date, category
    `

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado.' }, { status: 404 })
    }

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
    return NextResponse.json({ error: 'Nao foi possivel atualizar o evento.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    await sql`
      delete from events
      where id = ${params.id} and user_id = ${userId} and transaction_id is null
    `
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel remover o evento.' }, { status: 500 })
  }
}
