import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const category = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: String(body.name || '').trim(),
      emoji: String(body.emoji || '📦'),
      color: String(body.color || '#555555'),
      type: String(body.type || 'expense'),
    }

    if (!category.name) {
      return NextResponse.json({ error: 'Informe o nome da categoria.' }, { status: 400 })
    }

    const [created] = await sql`
      insert into categories (id, user_id, name, emoji, color, type)
      values (${category.id}, ${category.user_id}, ${category.name}, ${category.emoji}, ${category.color}, ${category.type})
      returning id, user_id, name, emoji, color, type, created_at
    `

    return NextResponse.json(created)
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    console.error(error)
    return NextResponse.json({ error: 'Não foi possível salvar a categoria.' }, { status: 500 })
  }
}
