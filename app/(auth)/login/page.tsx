'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, birthDate }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Nao foi possivel criar a conta.')
        }

        setMode('login')
        setPassword(data.generatedPassword || '')
        setError(`Conta criada. Sua senha inicial e a data de nascimento: ${data.generatedPassword || ''}`)
      } else {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          throw new Error('E-mail ou senha invalidos.')
        }

        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px', justifyContent: 'center' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--accent)', clipPath: 'polygon(20% 0%,80% 0%,100% 20%,100% 80%,80% 100%,20% 100%,0% 80%,0% 20%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L7 2L12 7L7 12Z" fill="var(--accent-text)" />
            </svg>
          </div>
          <span className="font-bebas" style={{ fontSize: '26px', color: 'var(--text)' }}>
            Finance Control
          </span>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)', marginBottom: '4px' }}>
              {mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text3)' }}>Cadastro com nome, e-mail e data de nascimento.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {mode === 'signup' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>
                    Nome
                  </label>
                  <input
                    className="fi"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>
                    Data de nascimento
                  </label>
                  <input
                    className="fi"
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    required
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                    Sua senha inicial sera a data de nascimento no formato DDMMAAAA.
                  </p>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>
                E-mail
              </label>
              <input
                className="fi"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            {mode === 'login' && (
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>
                  Senha
                </label>
                <input
                  className="fi"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="DDMMAAAA"
                  required
                  minLength={8}
                />
              </div>
            )}

            {error && (
              <div style={{ fontSize: '12px', color: error.includes('Conta criada') ? 'var(--green)' : 'var(--red)', padding: '8px 12px', background: error.includes('Conta criada') ? 'rgba(0,150,74,0.08)' : 'rgba(217,0,32,0.08)', borderRadius: '7px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '10px', marginTop: '4px' }}
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '12px', color: 'var(--text3)' }}>
            {mode === 'login' ? (
              <>Nao tem conta?{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setMode('signup')}>
                  Criar agora
                </span>
              </>
            ) : (
              <>Ja tem conta?{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setMode('login')}>
                  Entrar
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
