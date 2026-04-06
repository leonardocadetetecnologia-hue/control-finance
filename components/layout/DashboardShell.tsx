'use client'

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { apiRequest } from '@/lib/api'
import type { CalendarEvent, CashflowSettlement, IncomeSource, Metrics, Transaction } from '@/lib/types'
import { buildMetrics, buildMonthRows, type ExpandedFinanceRow, buildUpcomingReminders } from '@/lib/utils/finance'
import { formatBRL, formatDate, formatDateShort, MONTHS, todayISO } from '@/lib/utils/format'
import { formatMoneyInput, parseMoneyInput, sanitizeMoneyDraft } from '@/lib/utils/money'

interface AppCtx {
  month: number
  year: number
  setMonth: (month: number) => void
  setYear: (year: number) => void
  hidden: boolean
  toggleHidden: () => void
  theme: string
  setTheme: (theme: string) => void
  incomeSources: IncomeSource[]
  cashflowSettlements: CashflowSettlement[]
}

const AppContext = createContext<AppCtx>({
  month: 0,
  year: 0,
  setMonth: () => {},
  setYear: () => {},
  hidden: false,
  toggleHidden: () => {},
  theme: 'dark',
  setTheme: () => {},
  incomeSources: [],
  cashflowSettlements: [],
})
export const useApp = () => useContext(AppContext)

const THEMES = [
  { id: 'dark', label: 'Finance Dark' },
  { id: 'light', label: 'Finance Light' },
  { id: 'company', label: 'The7 Company' },
  { id: 'elementor-2026', label: 'Elementor 2026' },
  { id: 'portfolio', label: 'Portfolio One Page' },
]

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

const PREFETCH_ROUTES = [
  ...NAV.map(item => item.href),
  '/transactions?new=1',
  '/calendar?new=1',
]

type MetricDetailKey = 'income' | 'expense' | 'toReceive' | 'toPay'

export default function DashboardShell({
  children,
  user,
  transactions,
  events,
  incomeSources,
  cashflowSettlements,
}: {
  children: React.ReactNode
  user: { email?: string | null; name?: string | null }
  transactions: Transaction[]
  events: CalendarEvent[]
  incomeSources: IncomeSource[]
  cashflowSettlements: CashflowSettlement[]
}) {
  const now = new Date()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [hidden, setHidden] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [showIncomeOnboarding, setShowIncomeOnboarding] = useState(false)
  const [incomeValue, setIncomeValue] = useState('')
  const [incomeDay, setIncomeDay] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)
  const [metricDetail, setMetricDetail] = useState<MetricDetailKey | null>(null)
  const [refreshing, startRefresh] = useTransition()

  useEffect(() => {
    const savedTheme = localStorage.getItem('fx_theme') || 'dark'
    const savedHidden = localStorage.getItem('fx_hidden') === 'true'
    setTheme(savedTheme)
    setHidden(savedHidden)
    document.documentElement.setAttribute('data-theme', savedTheme)
    document.body.classList.toggle('vals-hidden', savedHidden)
  }, [])

  useEffect(() => {
    PREFETCH_ROUTES.forEach(route => router.prefetch(route))
  }, [router])

  useEffect(() => {
    const dismissedKey = `fc_income_onboarding_dismissed_${user.email || 'anon'}`
    const dismissed = localStorage.getItem(dismissedKey) === 'true'
    const hasRecurringIncome = transactions.some(transaction => transaction.type === 'income' && transaction.rec_mode === 'monthly')
    setShowIncomeOnboarding(!dismissed && incomeSources.length === 0 && !hasRecurringIncome)
  }, [incomeSources.length, transactions, user.email])

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

  function refreshFinancialData() {
    startRefresh(() => {
      router.refresh()
    })
  }

  function dismissIncomeOnboarding() {
    localStorage.setItem(`fc_income_onboarding_dismissed_${user.email || 'anon'}`, 'true')
    setShowIncomeOnboarding(false)
  }

  async function saveIncomeOnboarding() {
    const value = parseMoneyInput(incomeValue)
    const day = Number(incomeDay)

    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(day) || day < 1 || day > 31) {
      alert('Informe um valor valido em reais e um dia entre 1 e 31.')
      return
    }

    setSavingIncome(true)
    try {
      await apiRequest<IncomeSource>('/api/income-sources', {
        method: 'POST',
        body: JSON.stringify({
          name: user.name ? `Salario de ${user.name}` : 'Salario fixo',
          value,
          day,
          source_type: 'Salario CLT',
          start_date: todayISO(),
        }),
      })
      localStorage.setItem(`fc_income_onboarding_dismissed_${user.email || 'anon'}`, 'true')
      setShowIncomeOnboarding(false)
      setIncomeValue('')
      setIncomeDay('')
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSavingIncome(false)
    }
  }

  const monthRows = useMemo(() => buildMonthRows(transactions, incomeSources, year, month, cashflowSettlements), [transactions, incomeSources, year, month, cashflowSettlements])
  const metrics = useMemo<Metrics>(() => buildMetrics(transactions, year, month, incomeSources, cashflowSettlements), [transactions, year, month, incomeSources, cashflowSettlements])
  const reminders = useMemo(() => buildUpcomingReminders(transactions, events, 4), [transactions, events])
  const expenseMode = pathname === '/transactions' && searchParams.get('type') === 'expense'
  const today = todayISO()
  const metricDefinitions: Array<{
    label: string
    value: number
    className: string
    detailKey: MetricDetailKey | null
  }> = [
    { label: 'Saldo', value: metrics.balance, className: '', detailKey: null },
    { label: 'Receitas', value: metrics.income, className: 'positive', detailKey: 'income' },
    { label: 'Despesas', value: metrics.expenses, className: 'negative', detailKey: 'expense' },
    { label: 'A receber', value: metrics.toReceive, className: 'positive', detailKey: 'toReceive' },
    { label: 'A pagar', value: metrics.toPay, className: 'warning', detailKey: 'toPay' },
  ]

  const metricDetailConfig = useMemo(() => {
    const base = {
      income: {
        title: 'Receitas do mes',
        subtitle: 'Todos os creditos previstos ou recebidos no mes selecionado.',
        rows: monthRows.filter((row) => row.type === 'income'),
      },
      expense: {
        title: 'Despesas do mes',
        subtitle: 'Todos os debitos previstos ou confirmados no mes selecionado.',
        rows: monthRows.filter((row) => row.type === 'expense'),
      },
      toReceive: {
        title: 'Valores a receber',
        subtitle: 'Receitas futuras a partir de hoje dentro do mes selecionado.',
        rows: monthRows.filter((row) => row.type === 'income' && row.date >= today),
      },
      toPay: {
        title: 'Valores a pagar',
        subtitle: 'Debitos futuros a partir de hoje dentro do mes selecionado.',
        rows: monthRows.filter((row) => row.type === 'expense' && row.date >= today && row.status !== 'Paga'),
      },
    } satisfies Record<MetricDetailKey, { title: string; subtitle: string; rows: ExpandedFinanceRow[] }>

    return base
  }, [monthRows, today])

  const activeMetricDetail = metricDetail ? metricDetailConfig[metricDetail] : null

  return (
    <AppContext.Provider value={{ month, year, setMonth, setYear, hidden, toggleHidden, theme, setTheme: changeTheme, incomeSources, cashflowSettlements }}>
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
              <Link className="btn-primary shell-action-btn" href="/transactions?new=1" prefetch>+ Transacao</Link>
              <Link className="btn-ghost shell-action-btn" href="/calendar?new=1" prefetch>+ Evento</Link>
              <button className="btn-ghost shell-action-btn" onClick={refreshFinancialData} disabled={refreshing}>
                {refreshing ? 'Atualizando...' : 'Atualizar'}
              </button>
              <button className="shell-icon-btn" onClick={toggleHidden} title={hidden ? 'Mostrar valores' : 'Ocultar valores'}>
                {hidden ? 'Mostrar' : 'Ocultar'}
              </button>
              <div className="theme-switch">
                <div className="theme-switch-label">Tema</div>
                <select className="theme-select" value={theme} onChange={(event) => changeTheme(event.target.value)}>
                  {THEMES.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
              <button className="logout-btn" onClick={logout}>
                <span className="logout-avatar">{(user.email || 'U').slice(0, 1).toUpperCase()}</span>
                <span>Sair</span>
              </button>
            </div>
          </div>

          <div className="shell-summary-row">
            <div className="shell-metrics">
              {metricDefinitions.map((item) => {
                if (!item.detailKey) {
                  return (
                    <div key={item.label} className="metric-chip">
                      <div className="metric-label">{item.label}</div>
                      <div className={`metric-value hide-val ${item.className}`}>
                        <span>{formatBRL(item.value)}</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <button
                    key={item.label}
                    type="button"
                    className="metric-chip"
                    onClick={() => setMetricDetail(item.detailKey)}
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                    title={`Ver detalhes de ${item.label.toLowerCase()}`}
                  >
                    <div className="metric-label">{item.label}</div>
                    <div className={`metric-value hide-val ${item.className}`}>
                      <span>{formatBRL(item.value)}</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text3)' }}>Clique para detalhar</div>
                  </button>
                )
              })}
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
                <Link
                  key={item.href}
                  className={`shell-nav-item${isActive ? ' active' : ''}`}
                  href={item.href}
                  prefetch
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        <main className="shell-main">
          {children}
        </main>

        {showIncomeOnboarding && (
          <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) dismissIncomeOnboarding() }}>
            <div className="modal-box">
              <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="font-bebas" style={{ fontSize: '24px' }}>Antes de comecar</span>
                <button className="btn-ghost" onClick={dismissIncomeOnboarding}>Agora nao</button>
              </div>

              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ color: 'var(--text2)', lineHeight: 1.5 }}>
                  Informe sua renda fixa mensal e o dia em que costuma receber. Vamos usar isso para montar seu calendario financeiro automaticamente.
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Valor da renda fixa</label>
                  <input
                    className="fi"
                    inputMode="decimal"
                    value={incomeValue}
                    onChange={(event) => setIncomeValue(sanitizeMoneyDraft(event.target.value))}
                    onBlur={() => setIncomeValue((current) => formatMoneyInput(current))}
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Dia do recebimento</label>
                  <input
                    className="fi"
                    type="number"
                    min="1"
                    max="31"
                    value={incomeDay}
                    onChange={(event) => setIncomeDay(event.target.value)}
                    placeholder="Ex: 5"
                  />
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  Depois voce pode ajustar isso em Minha Renda.
                </div>
              </div>

              <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn-ghost" onClick={dismissIncomeOnboarding}>Pular por agora</button>
                <button className="btn-primary" onClick={saveIncomeOnboarding} disabled={savingIncome}>
                  {savingIncome ? 'Salvando...' : 'Salvar renda fixa'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeMetricDetail && (
          <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setMetricDetail(null) }}>
            <div className="modal-box" style={{ width: '760px' }}>
              <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div className="font-bebas" style={{ fontSize: '24px' }}>{activeMetricDetail.title}</div>
                  <div style={{ marginTop: '4px', color: 'var(--text3)', fontSize: '13px' }}>
                    {activeMetricDetail.subtitle} {MONTHS[month]} {year}.
                  </div>
                </div>
                <button className="btn-ghost" onClick={() => setMetricDetail(null)}>Fechar</button>
              </div>

              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '68vh', overflowY: 'auto' }}>
                {activeMetricDetail.rows.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)' }}>
                    Nenhum lancamento encontrado para este filtro.
                  </div>
                ) : activeMetricDetail.rows.map((row, index) => (
                  <div key={`${row.date}-${row.description}-${index}`} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{row.description}</div>
                        <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text2)' }}>
                          {row.category} - {row.recMode} - {row.status}
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text3)' }}>
                          Data: {formatDate(row.date)}
                        </div>
                      </div>
                      <div className="hide-val" style={{ fontSize: '16px', fontWeight: 700, color: row.type === 'income' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                        <span>{formatBRL(row.value)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppContext.Provider>
  )
}
