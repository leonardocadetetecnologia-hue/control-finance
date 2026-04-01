import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { parseMoneyInput } from '@/lib/utils/money'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const rawCurrent = String(body.current_value ?? '').trim()
    const currentValue = rawCurrent ? parseMoneyInput(body.current_value) : 0
    const targetValue = parseMoneyInput(body.target_value)

    if (!String(body.name || '').trim() || !Number.isFinite(targetValue) || targetValue <= 0) {
      return NextResponse.json({ error: 'Preencha nome e valor alvo valido.' }, { status: 400 })
    }

    if (rawCurrent && (!Number.isFinite(currentValue) || currentValue < 0)) {
      return NextResponse.json({ error: 'Informe um valor atual valido.' }, { status: 400 })
    }

    const [goal] = await sql`
      insert into goals (id, user_id, name, emoji, current_value, target_value)
      values (
        ${crypto.randomUUID()},
        ${userId},
        ${String(body.name || '').trim()},
        ${String(body.emoji || '💰')},
        ${currentValue},
        ${targetValue}
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
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel salvar a meta.' }, { status: 500 })
  }
}
