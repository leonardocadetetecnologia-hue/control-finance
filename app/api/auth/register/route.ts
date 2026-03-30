import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { createDefaultCategories } from '@/lib/defaults'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim() || email.split('@')[0]

    if (!email || !password) {
      return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const existing = await sql`
      select id
      from users
      where email = ${email}
      limit 1
    ` as { id: string }[]

    if (existing.length) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    const userId = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, 10)
    const defaultCategories = createDefaultCategories(userId)

    await sql.transaction([
      sql`
        insert into users (id, email, password_hash, name)
        values (${userId}, ${email}, ${passwordHash}, ${name})
      `,
      ...defaultCategories.map((category) => sql`
        insert into categories (id, user_id, name, emoji, color, type)
        values (${category.id}, ${category.user_id}, ${category.name}, ${category.emoji}, ${category.color}, ${category.type})
      `),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Não foi possível criar a conta.' }, { status: 500 })
  }
}
