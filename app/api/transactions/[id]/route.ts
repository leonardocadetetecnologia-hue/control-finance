import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { buildTransactionChildStatements } from '@/app/api/transactions/shared'
import { parseMoneyInput } from '@/lib/utils/money'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const parsedValue = parseMoneyInput(body.value)

    const payload = {
      description: String(body.description || '').trim(),
      value: parsedValue,
      type: String(body.type || 'expense'),
      category: String(body.category || 'Outros'),
      recMode: String(body.rec_mode || 'once'),
      date: String(body.date || ''),
      totalParcelas: body.total_parcelas ? Number(body.total_parcelas) : null,
      diaVenc: body.dia_venc ? Number(body.dia_venc) : null,
      durMonths: body.dur_months ? Number(body.dur_months) : null,
    }

    if (!payload.description || !Number.isFinite(payload.value) || payload.value <= 0 || !payload.date) {
      return NextResponse.json({ error: 'Preencha descricao, valor e data.' }, { status: 400 })
    }

    const existing = await sql`
      select id
      from transactions
      where id = ${params.id} and user_id = ${userId}
      limit 1
    ` as { id: string }[]

    if (!existing.length) {
      return NextResponse.json({ error: 'Transacao nao encontrada.' }, { status: 404 })
    }

    await sql.transaction([
      sql`delete from events where transaction_id = ${params.id} and user_id = ${userId}`,
      sql`delete from installments where transaction_id = ${params.id} and user_id = ${userId}`,
      sql`
        update transactions
        set
          description = ${payload.description},
          value = ${payload.value},
          type = ${payload.type},
          category = ${payload.category},
          rec_mode = ${payload.recMode},
          date = ${payload.date},
          total_parcelas = ${payload.totalParcelas},
          dia_venc = ${payload.diaVenc},
          dur_months = ${payload.durMonths}
        where id = ${params.id} and user_id = ${userId}
      `,
      ...buildTransactionChildStatements(userId, params.id, payload),
    ])

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel atualizar a transacao.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    await sql.transaction([
      sql`delete from events where transaction_id = ${params.id} and user_id = ${userId}`,
      sql`delete from installments where transaction_id = ${params.id} and user_id = ${userId}`,
      sql`delete from transactions where id = ${params.id} and user_id = ${userId}`,
    ])

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel excluir a transacao.' }, { status: 500 })
  }
}
