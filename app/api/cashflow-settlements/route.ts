import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const transactionId = body.transaction_id ? String(body.transaction_id) : null
    const incomeSourceId = body.income_source_id ? String(body.income_source_id) : null
    const occurrenceDate = String(body.occurrence_date || '')
    const settled = Boolean(body.settled)

    if (!occurrenceDate || (!transactionId && !incomeSourceId) || (transactionId && incomeSourceId)) {
      return NextResponse.json({ error: 'Informe o lancamento e a data da ocorrencia.' }, { status: 400 })
    }

    const ownerRows = transactionId
      ? await sql`
          select id
          from transactions
          where id = ${transactionId} and user_id = ${userId}
          limit 1
        `
      : await sql`
          select id
          from income_sources
          where id = ${incomeSourceId} and user_id = ${userId}
          limit 1
        `

    if (!ownerRows.length) {
      return NextResponse.json({ error: 'Lancamento nao encontrado.' }, { status: 404 })
    }

    const keyRows = transactionId
      ? await sql`
          select id
          from cashflow_settlements
          where user_id = ${userId} and transaction_id = ${transactionId} and occurrence_date = ${occurrenceDate}
          limit 1
        `
      : await sql`
          select id
          from cashflow_settlements
          where user_id = ${userId} and income_source_id = ${incomeSourceId} and occurrence_date = ${occurrenceDate}
          limit 1
        `

    if (!settled) {
      if (keyRows.length) {
        await sql`delete from cashflow_settlements where id = ${keyRows[0].id} and user_id = ${userId}`
      }

      return NextResponse.json({ ok: true, settled: false })
    }

    if (keyRows.length) {
      return NextResponse.json({ ok: true, settled: true, id: keyRows[0].id })
    }

    const settlementId = crypto.randomUUID()

    await sql`
      insert into cashflow_settlements (id, user_id, transaction_id, income_source_id, occurrence_date)
      values (${settlementId}, ${userId}, ${transactionId}, ${incomeSourceId}, ${occurrenceDate})
    `

    return NextResponse.json({ ok: true, settled: true, id: settlementId })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    if (String(error?.message || '').includes('cashflow_settlements')) {
      return NextResponse.json({ error: 'A atualizacao de quitacao ainda nao foi habilitada no banco. Rode o SQL da migracao no Neon.' }, { status: 503 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel atualizar a quitacao do lancamento.' }, { status: 500 })
  }
}
