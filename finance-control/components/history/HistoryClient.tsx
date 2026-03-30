'use client'

import { useState, useMemo } from 'react'
import { formatBRL, formatDate, todayISO } from '@/lib/utils/format'
import { exportCSV, exportJSON, exportXLSX, type ExportRow } from '@/lib/utils/export'
import type { Transaction, Installment, Category } from '@/lib/types'

export default function HistoryClient({ transactions, installments, categories }: {
  transactions: Transaction[]
  installments: Installment[]
  categories: Pick<Category, 'name' | 'emoji' | 'color'>[]
}) {
  const [srch, setSrch] = useState('')
  const [ftype, setFtype] = useState('all')
  const [fcat, setFcat] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const PER = 20

  function getCat(name: string) { return categories.find(c => c.name === name) || { emoji: '📦', color: '#555' } }

  const allRows = useMemo((): ExportRow[] => {
    const rows: ExportRow[] = []
    const today2 = todayISO()
    transactions.forEach(t => {
      if (t.rec_mode === 'installment') {
        const insts = installments.filter(p => p.transaction_id === t.id)
        insts.forEach(p => {
          rows.push({
            date: p.date, description: `${t.description} (${p.n}/${t.total_parcelas})`,
            category: t.category, type: t.type, value: p.value,
            status: p.paid ? 'Paga' : p.date < today2 ? 'Vencida' : 'Pendente',
            recMode: `Parcela ${p.n}/${t.total_parcelas}`
          })
        })
      } else {
        rows.push({
          date: t.date, description: t.description,
          category: t.category, type: t.type, value: t.value,
          status: 'Confirmada',
          recMode: t.rec_mode === 'monthly' ? 'Mensal' : 'Avulso'
        })
      }
    })
    return rows
  }, [transactions, installments])

  const filtered = useMemo(() => allRows.filter(r =>
    (!srch || r.description.toLowerCase().includes(srch.toLowerCase()) || r.category.toLowerCase().includes(srch.toLowerCase())) &&
    (ftype === 'all' || r.type === ftype) &&
    (fcat === 'all' || r.category === fcat) &&
    (!from || r.date >= from) &&
    (!to   || r.date <= to)
  ).sort((a, b) => {
    const av = sort.col === 'value' ? a.value : sort.col === 'description' ? a.description : a.date
    const bv = sort.col === 'value' ? b.value : sort.col === 'description' ? b.description : b.date
    if (av < bv) return sort.dir === 'asc' ? -1 : 1
    if (av > bv) return sort.dir === 'asc' ? 1 : -1
    return 0
  }), [allRows, srch, ftype, fcat, from, to, sort])

  const totalInc  = filtered.filter(r => r.type === 'income').reduce((s, r) => s + r.value, 0)
  const totalExp  = filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.value, 0)
  const allInc    = allRows.filter(r => r.type === 'income').reduce((s, r) => s + r.value, 0)
  const allExp    = allRows.filter(r => r.type === 'expense').reduce((s, r) => s + r.value, 0)
  const pending   = allRows.filter(r => r.status === 'Pendente' || r.status === 'Vencida').reduce((s, r) => s + r.value, 0)
  const overdue   = allRows.filter(r => r.status === 'Vencida').length

  const pages = Math.ceil(filtered.length / PER) || 1
  const slice = filtered.slice((page - 1) * PER, page * PER)

  function toggleSort(col: string) {
    setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }
  function sortArrow(col: string) { return sort.col === col ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕' }

  function statusColor(s: string) {
    if (s === 'Paga' || s === 'Confirmada') return 'var(--green)'
    if (s === 'Vencida') return 'var(--red)'
    return 'var(--orange)'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)' }}>Histórico Completo</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => exportCSV(filtered)}>↓ CSV</button>
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => exportJSON(filtered)}>↓ JSON</button>
          <button className="btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => exportXLSX(filtered)}>↓ Excel</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { label: 'Total Receitas',     value: allInc,   color: 'var(--green)' },
          { label: 'Total Despesas',     value: allExp,   color: 'var(--red)' },
          { label: 'Pendente/Parcelas',  value: pending,  color: 'var(--orange)' },
          { label: 'Parcelas Vencidas',  value: overdue,  color: 'var(--red)', isCount: true },
        ].map((c, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '6px' }}>{c.label}</div>
            <div className="hide-val font-bebas" style={{ fontSize: '22px', letterSpacing: '.5px', color: c.color }}>
              <span>{c.isCount ? c.value + ' parc.' : formatBRL(c.value)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '9px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="fi" style={{ maxWidth: '210px' }} placeholder="Buscar..." value={srch} onChange={e => { setSrch(e.target.value); setPage(1) }} />
        <select className="fi" style={{ maxWidth: '130px' }} value={ftype} onChange={e => { setFtype(e.target.value); setPage(1) }}>
          <option value="all">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option>
        </select>
        <select className="fi" style={{ maxWidth: '160px' }} value={fcat} onChange={e => { setFcat(e.target.value); setPage(1) }}>
          <option value="all">Todas categorias</option>
          {categories.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
        </select>
        <input className="fi" style={{ maxWidth: '130px' }} type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} title="De" />
        <input className="fi" style={{ maxWidth: '130px' }} type="date" value={to}   onChange={e => { setTo(e.target.value); setPage(1) }} title="Até" />
        <button className="btn-ghost" style={{ fontSize: '12px', padding: '7px 12px' }} onClick={() => { setSrch(''); setFtype('all'); setFcat('all'); setFrom(''); setTo(''); setPage(1) }}>Limpar</button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', padding: '10px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{filtered.length} resultado(s)</span>
        <span style={{ fontSize: '12px', color: 'var(--green)' }}>Receitas: {formatBRL(totalInc)}</span>
        <span style={{ fontSize: '12px', color: 'var(--red)' }}>Despesas: {formatBRL(totalExp)}</span>
        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Saldo: <span style={{ color: totalInc - totalExp >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatBRL(totalInc - totalExp)}</span></span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg4)' }}>
                {[
                  { label: 'Data',      col: 'date' },
                  { label: 'Descrição', col: 'description' },
                  { label: 'Categoria', col: null },
                  { label: 'Tipo',      col: null },
                  { label: 'Valor',     col: 'value', right: true },
                  { label: 'Status',    col: null, center: true },
                ].map((h, i) => (
                  <th key={i} onClick={() => h.col && toggleSort(h.col)} style={{ padding: '10px 14px', textAlign: h.right ? 'right' : h.center ? 'center' : 'left', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', whiteSpace: 'nowrap', cursor: h.col ? 'pointer' : 'default', userSelect: 'none' }}>
                    {h.label}{h.col && sortArrow(h.col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>Nenhuma transação encontrada.</td></tr>
              ) : slice.map((r, i) => {
                const c = getCat(r.category)
                return (
                  <tr key={i} className="hist-row">
                    <td className="hist-td">{formatDate(r.date)}</td>
                    <td className="hist-td" style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</td>
                    <td className="hist-td">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: c.color, flexShrink: 0, display: 'inline-block' }} />
                        {c.emoji} {r.category}
                      </span>
                    </td>
                    <td className="hist-td"><span className={r.type === 'income' ? 'badge-income' : 'badge-expense'}>{r.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
                    <td className="hist-td" style={{ textAlign: 'right' }}>
                      <span className="hide-val" style={{ fontWeight: 600, color: r.type === 'income' ? 'var(--green)' : 'var(--text)' }}>
                        <span>{r.type === 'income' ? '+' : '-'}{formatBRL(r.value)}</span>
                      </span>
                    </td>
                    <td className="hist-td" style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: statusColor(r.status) }}>{r.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
            {(page - 1) * PER + 1}–{Math.min(page * PER, filtered.length)} de {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '4px 10px', border: '1px solid var(--border2)', borderRadius: '6px', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: '12px' }}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2).map((p, i, arr) => (
              <>
                {i > 0 && arr[i - 1] !== p - 1 && <span key={`e${i}`} style={{ color: 'var(--text3)', fontSize: '12px', padding: '0 4px' }}>…</span>}
                <button key={p} onClick={() => setPage(p)} style={{ padding: '4px 10px', border: '1px solid var(--border2)', borderRadius: '6px', background: p === page ? 'var(--accent)' : 'none', color: p === page ? 'var(--accent-text)' : 'var(--text2)', cursor: 'pointer', fontSize: '12px', fontWeight: p === page ? 600 : 400 }}>{p}</button>
              </>
            ))}
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} style={{ padding: '4px 10px', border: '1px solid var(--border2)', borderRadius: '6px', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: '12px' }}>›</button>
          </div>
        </div>
      </div>
    </div>
  )
}
