import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

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
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Não foi possível remover o evento.' }, { status: 500 })
  }
}
