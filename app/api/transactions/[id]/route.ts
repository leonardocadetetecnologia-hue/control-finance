import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

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
