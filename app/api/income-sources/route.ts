import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()

    const sourceId = crypto.randomUUID()
    const eventId = crypto.randomUUID()

    await sql.transaction([
      sql`
        insert into income_sources (id, user_id, name, value, day, source_type, start_date)
        values (
          ${sourceId},
          ${userId},
          ${String(body.name || '').trim()},
          ${Number(body.value || 0)},
          ${Number(body.day || 1)},
          ${String(body.source_type || 'Outros')},
          ${String(body.start_date || new Date().toISOString().split('T')[0])}
        )
      `,
      sql`
        insert into events (id, user_id, description, value, type, repeat, day, category)
        values (
          ${eventId},
          ${userId},
          ${String(body.name || '').trim()},
          ${Number(body.value || 0)},
          'income',
          'monthly',
          ${Number(body.day || 1)},
          'Renda'
        )
      `,
    ])

    return NextResponse.json({
      id: sourceId,
      user_id: userId,
      name: String(body.name || '').trim(),
      value: Number(body.value || 0),
      day: Number(body.day || 1),
      source_type: String(body.source_type || 'Outros'),
      start_date: String(body.start_date || new Date().toISOString().split('T')[0]),
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel salvar a fonte de renda.' }, { status: 500 })
  }
}
