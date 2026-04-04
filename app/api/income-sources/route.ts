import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { parseMoneyInput } from '@/lib/utils/money'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const value = parseMoneyInput(body.value)

    const sourceId = crypto.randomUUID()
    const name = String(body.name || '').trim()
    const day = Number(body.day || 1)
    const sourceType = String(body.source_type || 'Outros')
    const startDate = String(body.start_date || new Date().toISOString().split('T')[0])

    if (!name || !Number.isFinite(value) || value <= 0 || !Number.isInteger(day) || day < 1 || day > 31) {
      return NextResponse.json({ error: 'Preencha nome, valor valido e dia de recebimento.' }, { status: 400 })
    }

    await sql`
      insert into income_sources (id, user_id, name, value, day, source_type, start_date)
      values (
        ${sourceId},
        ${userId},
        ${name},
        ${value},
        ${day},
        ${sourceType},
        ${startDate}
      )
    `

    return NextResponse.json({
      id: sourceId,
      user_id: userId,
      name,
      value,
      day,
      source_type: sourceType,
      start_date: startDate,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel salvar a fonte de renda.' }, { status: 500 })
  }
}
