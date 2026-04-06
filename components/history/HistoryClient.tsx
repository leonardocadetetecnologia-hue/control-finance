'use client'

import { useMemo, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { exportCSV, exportJSON, exportXLSX } from '@/lib/utils/export'
import { buildPendingDebitRows, buildTimelineRows, type ExpandedFinanceRow } from '@/lib/utils/finance'
import { formatBRL, formatDate, MONTHS, todayISO } from '@/lib/utils/format'
import { useApp } from '@/components/layout/DashboardShell'
import type { CashflowSettlement, Category, IncomeSource, Installment, Transaction } from '@/lib/types'

function toast(message: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = 'OK ' + message
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

export default function HistoryClient({
  transactions,
  installments,
  incomeSources,
  cashflowSettlements,
  categories,
}: {
  transactions: Transaction[]
  installments: Installment[]
  incomeSources: IncomeSource[]
  cashflowSettlements: CashflowSettlement[]
  categories: Pick<Category, 'name' | 'emoji' | 'color'>[]
}) {
  const { month, year } = useApp()
  const [srch, setSrch] = useState('')
  const [ftype, setFtype] = useState<'all' | 'income' | 'expense'>('all')
  const [fcat, setFcat] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [selectedYear, setSelectedYear] = useState(year)
  const [transactionsState] = useState(transactions)
  const [incomeSourcesState] = useState(incomeSources)
  const [installmentsState, setInstallmentsState] = useState(installments)
  const [settlementsState, setSettlementsState] = useState(cashflowSettlements)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const rangeStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
  const rangeEnd = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0]

  function getCat(name: string) {
    return categories.find(category => category.name === name) || { emoji: 'R$', color: '#555' }
  }

  const transactionsWithInstallments = useMemo(() => (
    transactionsState.map((transaction) => ({
      ...transaction,
      installments: installmentsState.filter((installment) => installment.transaction_id === transaction.id),
    }))
  ), [transactionsState, installmentsState])

  const rows = useMemo(() => buildTimelineRows(
    transactionsWithInstallments,
    incomeSourcesState,
    settlementsState,
    rangeStart,
    rangeEnd,
  ), [transactionsWithInstallments, incomeSourcesState, settlementsState, rangeStart, rangeEnd])

  const filtered = useMemo(() => rows.filter(row =>
    (!srch || row.description.toLowerCase().includes(srch.toLowerCase()) || row.category.toLowerCase().includes(srch.toLowerCase())) &&
    (ftype === 'all' || row.type === ftype) &&
    (fcat === 'all' || row.category === fcat),
  ), [rows, srch, ftype, fcat])

  const pendingDebits = useMemo(() => buildPendingDebitRows(
    transactionsWithInstallments,
    settlementsState,
    todayISO(),
  ), [transactionsWithInstallments, settlementsState])

  const totalIncome = filtered.filter(row => row.type === 'income').reduce((sum, row) => sum + row.value, 0)
  const totalExpense = filtered.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.value, 0)

  async function toggleSettlement(row: ExpandedFinanceRow) {
    const rowKey = `${row.installmentId || row.transactionId || row.sourceId}-${row.date}`
    setBusyKey(rowKey)

    try {
      if (row.installmentId) {
        await apiRequest(`/api/installments/${row.installmentId}`, {
          method: 'PATCH',
          body: JSON.stringify({ paid: !row.settled }),
        })

        setInstallmentsState(prev => prev.map((installment) => (
          installment.id === row.installmentId
            ? { ...installment, paid: !row.settled }
            : installment
        )))
        toast(row.settled ? 'Quitacao desfeita' : 'Lancamento quitado')
        return
      }

      const response = await apiRequest<{ ok: true; settled: boolean; id?: string }>('/api/cashflow-settlements', {
        method: 'PATCH',
        body: JSON.stringify({
          transaction_id: row.transactionId,
          income_source_id: row.sourceId,
          occurrence_date: row.date,
          settled: !row.settled,
        }),
      })

      setSettlementsState((prev) => {
        const withoutCurrent = prev.filter((settlement) => !(
          settlement.occurrence_date === row.date
          && settlement.transaction_id === row.transactionId
          && settlement.income_source_id === row.sourceId
        ))

        if (!response.settled) {
          return withoutCurrent
        }

        return [
          ...withoutCurrent,
          {
            id: response.id || crypto.randomUUID(),
            user_id: '',
            transaction_id: row.transactionId,
            income_source_id: row.sourceId,
            occurrence_date: row.date,
            settled_at: new Date().toISOString(),
          },
        ]
      })

      toast(row.settled ? 'Quitacao desfeita' : (row.type === 'income' ? 'Recebimento confirmado' : 'Lancamento quitado'))
    } catch (error: any) {
      alert(error.message)
    } finally {
      setBusyKey(null)
    }
  }

  function renderTimelineRow(row: ExpandedFinanceRow, index: number, emphasis = false) {
    const category = getCat(row.category)
    const rowKey = `${row.installmentId || row.transactionId || row.sourceId}-${row.date}`
    const isBusy = busyKey === rowKey

    return (
      <div key={`${rowKey}-${index}`} className={`timeline-item${emphasis ? ' urgent' : ''}`}>
        <div
          className={`timeline-dot ${row.type}`}
          style={{ background: row.type === 'income' ? 'var(--green)' : 'var(--red)' }}
        />
        <div className="timeline-date">{formatDate(row.date)}</div>
        <div className="timeline-card card">
          <div className="timeline-card-top">
            <div style={{ minWidth: 0 }}>
              <div className="timeline-title">{row.description}</div>
              <div className="timeline-meta">
                {category.emoji} {row.category} - {row.recMode}
              </div>
            </div>
            <div className="hide-val timeline-value" style={{ color: row.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
              <span>{row.type === 'income' ? '+' : '-'}{formatBRL(row.value)}</span>
            </div>
          </div>

          <div className="timeline-card-bottom">
            <div className="timeline-status-wrap">
              <span className={row.type === 'income' ? 'badge-income' : 'badge-expense'}>
                {row.type === 'income' ? 'Credito' : 'Debito'}
              </span>
              <span className={`timeline-status-badge ${row.settled ? 'settled' : 'pending'}`}>
                {row.status}
              </span>
            </div>
            <div className="timeline-actions">
              <button className="btn-ghost" disabled={isBusy} onClick={() => toggleSettlement(row)}>
                {isBusy ? 'Salvando...' : row.settled ? 'Desfazer quitacao' : row.type === 'income' ? 'Marcar como recebido' : 'Marcar como quitado'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h1 className="font-bebas" style={{ fontSize: '28px', letterSpacing: '2px', color: 'var(--text)' }}>Timeline financeira</h1>
          <div style={{ color: 'var(--text3)', marginTop: '4px' }}>Acompanhe os lancamentos, marque quitacao e acompanhe debitos pendentes.</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => exportCSV(filtered, `timeline-financeira-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}.csv`)}>CSV</button>
          <button className="btn-ghost" onClick={() => exportJSON(filtered)}>JSON</button>
          <button className="btn-primary" onClick={() => exportXLSX(filtered)}>Excel</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Mes selecionado</div>
          <div className="font-bebas" style={{ fontSize: '28px' }}>{MONTHS[selectedMonth]} {selectedYear}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Creditos na timeline</div>
          <div className="hide-val font-bebas" style={{ fontSize: '28px', color: 'var(--green)' }}><span>{formatBRL(totalIncome)}</span></div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Debitos na timeline</div>
          <div className="hide-val font-bebas" style={{ fontSize: '28px', color: 'var(--red)' }}><span>{formatBRL(totalExpense)}</span></div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Pendencias de debito</div>
          <div className="font-bebas" style={{ fontSize: '28px', color: pendingDebits.length ? 'var(--orange)' : 'var(--green)' }}>{pendingDebits.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select className="fi" style={{ maxWidth: '180px' }} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
          {MONTHS.map((label, index) => <option key={label} value={index}>{label}</option>)}
        </select>
        <input className="fi" style={{ maxWidth: '120px' }} type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value) || year)} />
        <input className="fi" style={{ maxWidth: '230px' }} placeholder="Buscar descricao ou categoria..." value={srch} onChange={e => setSrch(e.target.value)} />
        <select className="fi" style={{ maxWidth: '150px' }} value={ftype} onChange={e => setFtype(e.target.value as 'all' | 'income' | 'expense')}>
          <option value="all">Todos</option>
          <option value="income">Creditos</option>
          <option value="expense">Debitos</option>
        </select>
        <select className="fi" style={{ maxWidth: '190px' }} value={fcat} onChange={e => setFcat(e.target.value)}>
          <option value="all">Todas categorias</option>
          {categories.map(category => (
            <option key={category.name} value={category.name}>{category.emoji} {category.name}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: '18px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div>
            <div className="font-bebas" style={{ fontSize: '22px' }}>Pendencias de debito</div>
            <div style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '4px' }}>Lancamentos de despesa vencidos e ainda nao quitados.</div>
          </div>
        </div>

        {pendingDebits.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '18px 0' }}>Nenhuma pendencia de debito no momento.</div>
        ) : (
          <div className="timeline-list">
            {pendingDebits.map((row, index) => renderTimelineRow(row, index, true))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div>
            <div className="font-bebas" style={{ fontSize: '22px' }}>Timeline de lancamentos</div>
            <div style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '4px' }}>Clique em um lancamento para marcar como quitado ou desfazer a quitacao.</div>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '13px' }}>{filtered.length} item(ns) exibido(s)</div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '22px 0' }}>Nenhum lancamento encontrado neste periodo.</div>
        ) : (
          <div className="timeline-list">
            {filtered.map((row, index) => renderTimelineRow(row, index))}
          </div>
        )}
      </div>
    </div>
  )
}
