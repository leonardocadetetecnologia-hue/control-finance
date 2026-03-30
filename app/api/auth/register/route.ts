import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { createDefaultCategories } from '@/lib/defaults'

function birthDateToPassword(birthDate: string) {
  const [year, month, day] = birthDate.split('-')
  if (!year || !month || !day) {
    return null
  }

  return `${day}${month}${year}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim() || email.split('@')[0]
    const birthDate = String(body.birthDate || '').trim()
    const password = birthDateToPassword(birthDate)

    if (!email || !name || !birthDate || !password) {
      return NextResponse.json({ error: 'Informe nome, e-mail e data de nascimento.' }, { status: 400 })
    }

    const existing = await sql`
      select id
      from users
      where email = ${email}
      limit 1
    ` as { id: string }[]

    if (existing.length) {
      return NextResponse.json({ error: 'Este e-mail ja esta cadastrado.' }, { status: 409 })
    }

    const userId = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, 10)
    const defaultCategories = createDefaultCategories(userId)

    await sql.transaction([
      sql`
        insert into users (id, email, password_hash, name, birth_date)
        values (${userId}, ${email}, ${passwordHash}, ${name}, ${birthDate})
      `,
      ...defaultCategories.map((category) => sql`
        insert into categories (id, user_id, name, emoji, color, type)
        values (${category.id}, ${category.user_id}, ${category.name}, ${category.emoji}, ${category.color}, ${category.type})
      `),
    ])

    return NextResponse.json({ ok: true, generatedPassword: password })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Nao foi possivel criar a conta.' }, { status: 500 })
  }
}
