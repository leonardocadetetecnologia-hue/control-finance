'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { CalendarEvent, Metrics, Transaction } from '@/lib/types'
import { buildMetrics, buildUpcomingReminders } from '@/lib/utils/finance'
import { formatBRL, formatDateShort, MONTHS } from '@/lib/utils/format'

interface AppCtx {
  month: number
  year: number
  setMonth: (month: number) => void
  setYear: (year: number) => void
  hidden: boolean
  toggleHidden: () => void
}

const AppContext = createContext<AppCtx>({} as AppCtx)
export const useApp = () => useContext(AppContext)

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/calendar', label: 'Calendario' },
  { href: '/transactions', label: 'Transacoes' },
  { href: '/transactions?type=expense', label: 'Despesas' },
  { href: '/income', label: 'Minha Renda' },
  { href: '/goals', label: 'Metas' },
  { href: '/categories', label: 'Categorias' },
  { href: '/history', label: 'Historico' },
]

export default function DashboardShell({
  children,
  user,
  transactions,
  events,
}: {
  children: React.ReactNode
  user: { email?: string | null }
  transactions: Transaction[]
  events: CalendarEvent[]
}) {
  const now = new Date()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [hidden, setHidden] = useState(false)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('fx_theme') || 'dark'
    const savedHidden = localStorage.getItem('fx_hidden') === 'true'
    setTheme(savedTheme)
    setHidden(savedHidden)
    document.documentElement.setAttribute('data-theme', savedTheme)
    document.body.classList.toggle('vals-hidden', savedHidden)
  }, [])

  function changeTheme(nextTheme: string) {
    setTheme(nextTheme)
    localStorage.setItem('fx_theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  function toggleHidden() {
    const nextHidden = !hidden
    setHidden(nextHidden)
    localStorage.setItem('fx_hidden', String(nextHidden))
    document.body.classList.toggle('vals-hidden', nextHidden)
  }

  function changeMonth(delta: number) {
    let nextMonth = month + delta
    let nextYear = year
    if (nextMonth > 11) {
      nextMonth = 0
      nextYear += 1
    }
    if (nextMonth < 0) {
      nextMonth = 11
      nextYear -= 1
    }
    setMonth(nextMonth)
    setYear(nextYear)
  }

  async function logout() {
    await signOut({ redirect: false })
    router.push('/login')
    router.refresh()
  }

  function openNewTransaction() {
    router.push('/transactions?new=1')
  }

  function openNewEvent() {
    router.push('/calendar?new=1')
  }

  const metrics = useMemo<Metrics>(() => buildMetrics(transactions, year, month), [transactions, year, month])
  const reminders = useMemo(() => buildUpcomingReminders(transactions, events, 4), [transactions, events])
  const expenseMode = pathname === '/transactions' && searchParams.get('type') === 'expense'

  return (
    <AppContext.Provider value={{ month, year, setMonth, setYear, hidden, toggleHidden }}>
      <div className="shell-page">
        <header className="shell-header">
          <div className="shell-topline">
            <div className="shell-brand">
              <div className="shell-brand-badge">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L7 2L12 7L7 12Z" fill="var(--accent-text)" />
                </svg>
              </div>
              <div>
                <div className="font-bebas shell-brand-title">Finance Control</div>
                <div className="shell-brand-subtitle">Desenvolvido por Leonardo Cadete</div>
              </div>
            </div>

            <div className="shell-actions">
              <button className="btn-primary shell-action-btn" onClick={openNewTransaction}>+ Transacao</button>
              <button className="btn-ghost shell-action-btn" onClick={openNewEvent}>+ Evento</button>
              <button className="shell-icon-btn" onClick={toggleHidden} title={hidden ? 'Mostrar valores' : 'Ocultar valores'}>
                {hidden ? 'Mostrar' : 'Ocultar'}
              </button>
              <div className="theme-switch">
                <button className={`theme-pill${theme === 'dark' ? ' active' : ''}`} onClick={() => changeTheme('dark')}>Escuro</button>
                <button className={`theme-pill${theme === 'light' ? ' active' : ''}`} onClick={() => changeTheme('light')}>Claro</button>
              </div>
              <button className="logout-btn" onClick={logout}>
                <span className="logout-avatar">{(user.email || 'U').slice(0, 1).toUpperCase()}</span>
                <span>Sair</span>
              </button>
            </div>
          </div>

          <div className="shell-summary-row">
            <div className="shell-metrics">
              {[
                { label: 'Saldo', value: metrics.balance, className: '' },
                { label: 'Receitas', value: metrics.income, className: 'positive' },
                { label: 'Despesas', value: metrics.expenses, className: 'negative' },
                { label: 'A receber', value: metrics.toReceive, className: 'positive' },
                { label: 'A pagar', value: metrics.toPay, className: 'warning' },
              ].map((item) => (
                <div key={item.label} className="metric-chip">
                  <div className="metric-label">{item.label}</div>
                  <div className={`metric-value hide-val ${item.className}`}>
                    <span>{formatBRL(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="shell-side-info">
              <div className="reminder-card">
                <div className="reminder-title">Proximas dividas</div>
                {reminders.length === 0 ? (
                  <div className="reminder-empty">Nenhum pagamento proximo.</div>
                ) : reminders.map((reminder) => (
                  <div key={reminder.id} className="reminder-row">
                    <div>
                      <div className="reminder-label">{reminder.label}</div>
                      <div className="reminder-date">{formatDateShort(reminder.date)}</div>
                    </div>
                    <div className="hide-val reminder-value">
                      <span>{reminder.value > 0 ? formatBRL(reminder.value) : 'Lembrete'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="month-control">
                <button className="shell-icon-btn" onClick={() => changeMonth(-1)}>{'<'}</button>
                <span>{MONTHS[month]} {year}</span>
                <button className="shell-icon-btn" onClick={() => changeMonth(1)}>{'>'}</button>
              </div>
            </div>
          </div>

          <nav className="shell-nav">
            {NAV.map((item) => {
              const isActive = item.href === '/transactions?type=expense'
                ? expenseMode
                : pathname === item.href

              return (
                <button
                  key={item.href}
                  className={`shell-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => router.push(item.href)}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </header>

        <main className="shell-main">
          {children}
        </main>
      </div>
    </AppContext.Provider>
  )
}
