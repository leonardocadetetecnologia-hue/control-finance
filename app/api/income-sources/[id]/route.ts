import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    const [source] = await sql`
      select id, name, value, day
      from income_sources
      where id = ${params.id} and user_id = ${userId}
      limit 1
    ` as { id: string; name: string; value: number | string; day: number }[]

    if (!source) {
      return NextResponse.json({ error: 'Fonte de renda nao encontrada.' }, { status: 404 })
    }

    await sql.transaction([
      sql`
        delete from events
        where
          user_id = ${userId}
          and transaction_id is null
          and type = 'income'
          and repeat = 'monthly'
          and category = 'Renda'
          and description = ${source.name}
          and day = ${source.day}
          and value = ${Number(source.value || 0)}
      `,
      sql`
        delete from income_sources
        where id = ${params.id} and user_id = ${userId}
      `,
    ])

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel remover a fonte de renda.' }, { status: 500 })
  }
}
