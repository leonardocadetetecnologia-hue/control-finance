'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { MONTHS } from '@/lib/utils/format'

// ── Context ──────────────────────────────────────────
interface AppCtx {
  month: number; year: number
  setMonth: (m: number) => void; setYear: (y: number) => void
  hidden: boolean; toggleHidden: () => void
  theme: string; setTheme: (t: string) => void
  openTxModal: () => void; txModalOpen: boolean; closeTxModal: () => void
}
const Ctx = createContext<AppCtx>({} as AppCtx)
export const useApp = () => useContext(Ctx)

const NAV = [
  { href: '/',              label: 'Dashboard',    icon: 'grid' },
  { href: '/calendar',      label: 'Calendário',   icon: 'calendar' },
  { href: '/transactions',  label: 'Transações',   icon: 'list' },
  { href: '/income',        label: 'Minha Renda',  icon: 'user' },
  { href: '/goals',         label: 'Metas',        icon: 'target' },
  { href: '/cards',         label: 'Cartões',      icon: 'card' },
  { href: '/categories',    label: 'Categorias',   icon: 'tag' },
  { href: '/history',       label: 'Histórico',    icon: 'clock' },
]

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    grid: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>,
    calendar: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 1V3M11 1V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M1 6H15" stroke="currentColor" strokeWidth="1.3"/><circle cx="5" cy="10" r="1" fill="currentColor"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="11" cy="10" r="1" fill="currentColor"/></svg>,
    list: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 5H14M2 8H10M2 11H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
    user: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
    target: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg>,
    card: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 6H15" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="9" width="3" height="1.5" rx=".5" fill="currentColor"/></svg>,
    tag: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 4h3v3H2zM2 9h3v3H2zM7 4h3v3H7zM7 9h3v3H7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
    clock: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  }
  return <>{icons[name] || null}</>
}

export default function DashboardShell({ children, user }: { children: React.ReactNode; user: { email?: string | null } }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [hidden, setHidden] = useState(false)
  const [theme, setThemeState] = useState('dark')
  const [txModalOpen, setTxModalOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    const saved = localStorage.getItem('fx_theme') || 'dark'
    const savedHidden = localStorage.getItem('fx_hidden') === 'true'
    setThemeState(saved)
    setHidden(savedHidden)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  function setTheme(t: string) {
    setThemeState(t)
    localStorage.setItem('fx_theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }

  function toggleHidden() {
    const next = !hidden
    setHidden(next)
    localStorage.setItem('fx_hidden', String(next))
    document.body.classList.toggle('vals-hidden', next)
  }

  function changeMonth(d: number) {
    let m = month + d, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  async function logout() {
    await signOut({ redirect: false })
    router.push('/login')
    router.refresh()
  }

  const userInitial = (user.email || 'U')[0].toUpperCase()

  return (
    <Ctx.Provider value={{ month, year, setMonth, setYear, hidden, toggleHidden, theme, setTheme, openTxModal: () => setTxModalOpen(true), txModalOpen, closeTxModal: () => setTxModalOpen(false) }}>
      <div className="app-grid">
        {/* ── TOPBAR ── */}
        <header style={{ gridColumn: '1/-1', gridRow: '1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', height: '58px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '26px', height: '26px', background: 'var(--accent)', clipPath: 'polygon(20% 0%,80% 0%,100% 20%,100% 80%,80% 100%,20% 100%,0% 80%,0% 20%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7L7 2L12 7L7 12Z" fill="var(--accent-text)"/></svg>
            </div>
            <span className="font-bebas" style={{ fontSize: '20px', color: 'var(--text)' }}>Finance Control</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <button className="btn-primary" style={{ padding: '6px 14px' }} onClick={() => setTxModalOpen(true)}>+ Transação</button>
            <button className="btn-ghost" style={{ padding: '6px 13px' }} onClick={() => router.push('/calendar')}>+ Evento</button>
            <button
              onClick={toggleHidden}
              title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
              style={{ width: '32px', height: '32px', background: 'none', border: `1px solid ${hidden ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hidden ? 'var(--accent)' : 'var(--text2)' }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                {hidden
                  ? <><path d="M2 2L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M7.5 3C4.5 3 2 5.5 1 7.5c.8 1.3 2 2.7 3.5 3.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5.8 11.5C6.3 11.8 6.9 12 7.5 12c3 0 5.5-2.5 6.5-4.5-.6-1-1.5-2.2-2.8-3" stroke="currentColor" strokeWidth="1.2"/></>
                  : <><path d="M7.5 3C4.5 3 2 5.5 1 7.5 2 9.5 4.5 12 7.5 12s5.5-2.5 6.5-4.5C13 5.5 10.5 3 7.5 3Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/></>
                }
              </svg>
            </button>
            <div style={{ width: '30px', height: '30px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }} onClick={logout} title="Sair">
              {userInitial}
            </div>
          </div>
        </header>

        {/* ── METRICS BAR ── */}
        <div style={{ gridColumn: '1/-1', gridRow: '2', display: 'flex', alignItems: 'center', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
          {[
            { label: 'Saldo',     id: 'mb-saldo',  color: 'var(--text)' },
            { label: 'Receitas',  id: 'mb-rec',    color: 'var(--green)' },
            { label: 'Despesas',  id: 'mb-desp',   color: 'var(--red)' },
            { label: 'A receber', id: 'mb-arec',   color: 'var(--cyan)' },
            { label: 'A pagar',   id: 'mb-apag',   color: 'var(--orange)' },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '100%', borderRight: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '1px' }}>{p.label}</div>
                <div id={p.id} className="mp-value hide-val" style={{ color: p.color }}>
                  <span>R$ 0</span>
                </div>
              </div>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0 16px' }}>
            <button onClick={() => changeMonth(-1)} style={{ width: '24px', height: '24px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px' }}>‹</button>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text2)', minWidth: '94px', textAlign: 'center' }}>{MONTHS[month]} {year}</span>
            <button onClick={() => changeMonth(1)} style={{ width: '24px', height: '24px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px' }}>›</button>
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <aside style={{ gridRow: '3', background: 'var(--bg2)', borderRight: '1px solid var(--border)', padding: '14px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0 10px', marginBottom: '5px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '2px', color: 'var(--text3)', padding: '0 10px', marginBottom: '5px', textTransform: 'uppercase' }}>Navegação</div>
            {NAV.map(item => (
              <div
                key={item.href}
                className={`nav-item${pathname === item.href ? ' active' : ''}`}
                onClick={() => router.push(item.href)}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '8px 10px' }} />

          {/* Theme Switcher */}
          <div style={{ padding: '10px 12px 5px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '2px', color: 'var(--text3)', padding: '0 2px', marginBottom: '8px', textTransform: 'uppercase', display: 'block' }}>Tema</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[{ key: 'dark', icon: '🌙', label: 'Escuro' }, { key: 'light', icon: '☀️', label: 'Claro' }].map(t => (
                <div
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  style={{ borderRadius: '9px', padding: '8px', cursor: 'pointer', border: `1px solid ${theme === t.key ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 500, color: theme === t.key ? 'var(--text)' : 'var(--text2)', transition: 'all 0.18s' }}
                >
                  <span style={{ fontSize: '11px' }}>{t.icon}</span>{t.label}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 'auto', padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-primary" style={{ width: '100%', padding: '9px' }} onClick={() => setTxModalOpen(true)}>
              + Nova Transação
            </button>
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>
              {user.email}
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ gridRow: '3', background: 'var(--bg)', overflowY: 'auto', padding: '22px' }}>
          {children}
        </main>
      </div>

      {/* Tx Modal placeholder — rendered by TransactionModal */}
      {txModalOpen && <div id="tx-modal-portal" />}
    </Ctx.Provider>
  )
}
