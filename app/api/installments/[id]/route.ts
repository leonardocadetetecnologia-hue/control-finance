import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const paid = body.paid === undefined ? null : Boolean(body.paid)
    const date = body.date ? String(body.date) : null
    const rolledOver = body.rolled_over === undefined ? null : Number(body.rolled_over)

    const rows = await sql`
      update installments
      set paid = coalesce(${paid}, paid),
          date = coalesce(${date}, date),
          rolled_over = coalesce(${rolledOver}, rolled_over)
      where id = ${params.id} and user_id = ${userId}
      returning id, transaction_id, user_id, n, date, value, paid, rolled_over
    `

    if (!rows.length) {
      return NextResponse.json({ error: 'Parcela nao encontrada.' }, { status: 404 })
    }

    if (date && body.transaction_id && body.installment_n) {
      await sql`
        update events
        set date = ${date}
        where transaction_id = ${String(body.transaction_id)} and installment_n = ${Number(body.installment_n)} and user_id = ${userId}
      `
    }

    return NextResponse.json({
      ...rows[0],
      value: Number(rows[0].value || 0),
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel atualizar a parcela.' }, { status: 500 })
  }
}
