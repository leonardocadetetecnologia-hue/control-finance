import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    const body = await request.json()

    const rows = await sql`
      update categories
      set name = ${String(body.name || '').trim()},
          emoji = ${String(body.emoji || '📦')},
          color = ${String(body.color || '#555555')},
          type = ${String(body.type || 'expense')}
      where id = ${params.id} and user_id = ${userId}
      returning id, user_id, name, emoji, color, type, created_at
    `

    if (!rows.length) {
      return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 })
    }

    return NextResponse.json(rows[0])
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Não foi possível atualizar a categoria.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId()
    await sql`
      delete from categories
      where id = ${params.id} and user_id = ${userId}
    `
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Não foi possível remover a categoria.' }, { status: 500 })
  }
}
