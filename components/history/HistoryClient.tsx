'use client'

import { useMemo, useState } from 'react'
import { exportCSV, exportJSON, exportXLSX, type ExportRow } from '@/lib/utils/export'
import { expandTransactionsForRange } from '@/lib/utils/finance'
import { formatBRL, formatDate, MONTHS } from '@/lib/utils/format'
import { useApp } from '@/components/layout/DashboardShell'
import type { Category, Installment, Transaction } from '@/lib/types'

export default function HistoryClient({
  transactions,
  installments,
  categories,
}: {
  transactions: Transaction[]
  installments: Installment[]
  categories: Pick<Category, 'name' | 'emoji' | 'color'>[]
}) {
  const { month, year } = useApp()
  const [srch, setSrch] = useState('')
  const [ftype, setFtype] = useState('all')
  const [fcat, setFcat] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [selectedYear, setSelectedYear] = useState(year)

  const rangeStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
  const rangeEnd = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0]

  function getCat(name: string) {
    return categories.find(category => category.name === name) || { emoji: '📦', color: '#555' }
  }

  const rows = useMemo<ExportRow[]>(() => {
    return expandTransactionsForRange(
      transactions.map(transaction => ({
        ...transaction,
        installments: installments.filter(installment => installment.transaction_id === transaction.id),
      })),
      rangeStart,
      rangeEnd,
    )
  }, [transactions, installments, rangeStart, rangeEnd])

  const filtered = useMemo(() => rows.filter(row =>
    (!srch || row.description.toLowerCase().includes(srch.toLowerCase()) || row.category.toLowerCase().includes(srch.toLowerCase())) &&
    (ftype === 'all' || row.type === ftype) &&
    (fcat === 'all' || row.category === fcat),
  ), [rows, srch, ftype, fcat])

  const totalIncome = filtered.filter(row => row.type === 'income').reduce((sum, row) => sum + row.value, 0)
  const totalExpense = filtered.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.value, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h1 className="font-bebas" style={{ fontSize: '28px', letterSpacing: '2px', color: 'var(--text)' }}>Historico mensal</h1>
          <div style={{ color: 'var(--text3)', marginTop: '4px' }}>Exporte receitas e despesas do mes em CSV, JSON ou Excel.</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => exportCSV(filtered, `finance-control-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}.csv`)}>CSV</button>
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
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Receitas</div>
          <div className="hide-val font-bebas" style={{ fontSize: '28px', color: 'var(--green)' }}><span>{formatBRL(totalIncome)}</span></div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Despesas</div>
          <div className="hide-val font-bebas" style={{ fontSize: '28px', color: 'var(--red)' }}><span>{formatBRL(totalExpense)}</span></div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Saldo</div>
          <div className="hide-val font-bebas" style={{ fontSize: '28px', color: totalIncome - totalExpense >= 0 ? 'var(--green)' : 'var(--red)' }}>
            <span>{formatBRL(totalIncome - totalExpense)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select className="fi" style={{ maxWidth: '180px' }} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
          {MONTHS.map((label, index) => <option key={label} value={index}>{label}</option>)}
        </select>
        <input className="fi" style={{ maxWidth: '120px' }} type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value) || year)} />
        <input className="fi" style={{ maxWidth: '230px' }} placeholder="Buscar descricao ou categoria..." value={srch} onChange={e => setSrch(e.target.value)} />
        <select className="fi" style={{ maxWidth: '150px' }} value={ftype} onChange={e => setFtype(e.target.value)}>
          <option value="all">Todos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select className="fi" style={{ maxWidth: '190px' }} value={fcat} onChange={e => setFcat(e.target.value)}>
          <option value="all">Todas categorias</option>
          {categories.map(category => (
            <option key={category.name} value={category.name}>{category.emoji} {category.name}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg4)' }}>
                {['Data', 'Descricao', 'Categoria', 'Tipo', 'Valor', 'Status', 'Recorrencia'].map(header => (
                  <th key={header} style={{ padding: '12px 14px', textAlign: header === 'Valor' ? 'right' : 'left', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--text3)' }}>Nenhum lancamento encontrado neste periodo.</td>
                </tr>
              ) : filtered.map((row, index) => {
                const category = getCat(row.category)
                return (
                  <tr key={`${row.date}-${row.description}-${index}`} className="hist-row">
                    <td className="hist-td">{formatDate(row.date)}</td>
                    <td className="hist-td">{row.description}</td>
                    <td className="hist-td">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: category.color, display: 'inline-block' }} />
                        {category.emoji} {row.category}
                      </span>
                    </td>
                    <td className="hist-td">
                      <span className={row.type === 'income' ? 'badge-income' : 'badge-expense'}>
                        {row.type === 'income' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td className="hist-td" style={{ textAlign: 'right' }}>
                      <span className="hide-val" style={{ fontWeight: 700, color: row.type === 'income' ? 'var(--green)' : 'var(--text)' }}>
                        <span>{row.type === 'income' ? '+' : '-'}{formatBRL(row.value)}</span>
                      </span>
                    </td>
                    <td className="hist-td">{row.status}</td>
                    <td className="hist-td">{row.recMode}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
