import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { getTransactions } from '@/lib/data'
import { buildTransactionStatements } from '@/app/api/transactions/shared'

export async function GET() {
  try {
    const userId = await requireUserId()
    const transactions = await getTransactions(userId)
    return NextResponse.json({ transactions })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel carregar as transacoes.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()

    const payload = {
      description: String(body.description || '').trim(),
      value: Number(body.value || 0),
      type: String(body.type || 'expense'),
      category: String(body.category || 'Outros'),
      recMode: String(body.rec_mode || 'once'),
      date: String(body.date || ''),
      totalParcelas: body.total_parcelas ? Number(body.total_parcelas) : null,
      diaVenc: body.dia_venc ? Number(body.dia_venc) : null,
      durMonths: body.dur_months ? Number(body.dur_months) : null,
    }

    if (!payload.description || !payload.value || !payload.date) {
      return NextResponse.json({ error: 'Preencha descricao, valor e data.' }, { status: 400 })
    }

    const transactionId = crypto.randomUUID()
    await sql.transaction(buildTransactionStatements(userId, transactionId, payload))

    const transactions = await getTransactions(userId)
    return NextResponse.json({ transactions })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel salvar a transacao.' }, { status: 500 })
  }
}
