import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()

    const [goal] = await sql`
      insert into goals (id, user_id, name, emoji, current_value, target_value)
      values (
        ${crypto.randomUUID()},
        ${userId},
        ${String(body.name || '').trim()},
        ${String(body.emoji || '💰')},
        ${Number(body.current_value || 0)},
        ${Number(body.target_value || 0)}
      )
      returning id, user_id, name, emoji, current_value, target_value
    `

    return NextResponse.json({
      ...goal,
      current_value: Number(goal.current_value || 0),
      target_value: Number(goal.target_value || 0),
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Não foi possível salvar a meta.' }, { status: 500 })
  }
}
