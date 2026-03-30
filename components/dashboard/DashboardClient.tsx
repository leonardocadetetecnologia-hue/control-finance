'use client'

import { useMemo } from 'react'
import { formatBRL, formatDate, MONTHS } from '@/lib/utils/format'
import type { Transaction, Installment, Category } from '@/lib/types'

export default function DashboardClient({ transactions, categories }: {
  transactions: (Transaction & { installments?: Installment[] })[]
  categories: Category[]
}) {
  const now = new Date()
  const month = now.getMonth()
  const year  = now.getFullYear()

  function getCat(name: string) { return categories.find(c => c.name === name) || { emoji: '📦', color: '#555' } }

  const monthTx = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date + 'T12:00')
      return d.getMonth() === month && d.getFullYear() === year
    }), [transactions, month, year])

  const income   = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.value, 0)
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.value, 0)

  // Bar chart by week
  const dim = new Date(year, month + 1, 0).getDate()
  const weeks = Array.from({ length: Math.ceil(dim / 7) }, (_, w) => {
    const s0 = w * 7 + 1, e0 = Math.min(s0 + 6, dim)
    const wt = monthTx.filter(t => { const d = new Date(t.date + 'T12:00').getDate(); return d >= s0 && d <= e0 })
    return {
      label: `S${w + 1}`,
      inc:  wt.filter(t => t.type === 'income').reduce((s, t) => s + t.value, 0),
      exp:  wt.filter(t => t.type === 'expense' && t.rec_mode !== 'installment').reduce((s, t) => s + t.value, 0),
      inst: wt.filter(t => t.rec_mode === 'installment').reduce((s, t) => s + t.value, 0),
    }
  })
  const maxW = Math.max(1, ...weeks.flatMap(w => [w.inc, w.exp + w.inst]))

  // Category breakdown
  const catTotals: Record<string, number> = {}
  monthTx.filter(t => t.type === 'expense').forEach(t => catTotals[t.category] = (catTotals[t.category] || 0) + t.value)
  const catSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  const catTotal  = catSorted.reduce((s, [, v]) => s + v, 0)

  const recent = monthTx.slice(0, 5)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 316px', gap: '16px', marginBottom: '18px' }}>
        {/* Chart */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span className="font-bebas" style={{ fontSize: '16px', letterSpacing: '2px', color: 'var(--text)' }}>Fluxo do Mês</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{MONTHS[month]} {year}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '130px' }}>
            {weeks.map((w, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', gap: '3px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, background: 'var(--green)', borderRadius: '4px 4px 0 0', height: `${Math.max(3, Math.round((w.inc / maxW) * 120))}px`, opacity: .85 }} title={formatBRL(w.inc)} />
                <div style={{ flex: 1, background: 'var(--red)', borderRadius: '4px 4px 0 0', height: `${Math.max(3, Math.round((w.exp / maxW) * 120))}px`, opacity: .65 }} title={formatBRL(w.exp)} />
                <div style={{ flex: 1, background: 'var(--purple)', borderRadius: '4px 4px 0 0', height: `${Math.max(w.inst > 0 ? 3 : 0, Math.round((w.inst / maxW) * 120))}px`, opacity: .7 }} title={formatBRL(w.inst)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '2px', marginTop: '5px' }}>
            {weeks.map((w, i) => <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'var(--text3)' }}>{w.label}</div>)}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            {[{ c: 'var(--green)', l: 'Receitas' }, { c: 'var(--red)', l: 'Despesas', op: .7 }, { c: 'var(--purple)', l: 'Parcelas' }].map(x => (
              <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text2)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: x.c, opacity: x.op || 1 }} />{x.l}
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="card">
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Por Categoria</div>
          <div style={{ padding: '14px 16px' }}>
            {catSorted.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Nenhuma despesa ainda</div>
            ) : catSorted.map(([cat, val]) => {
              const c = getCat(cat)
              const pct = catTotal > 0 ? Math.round((val / catTotal) * 100) : 0
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '2px', flexShrink: 0, background: c.color }} />
                  <div style={{ flex: 1, fontSize: '12px', color: 'var(--text2)' }}>{cat}</div>
                  <div style={{ flex: 2, height: '3px', background: 'var(--bg4)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: c.color, borderRadius: '2px' }} />
                  </div>
                  <div className="hide-val" style={{ fontSize: '12px', fontWeight: 500, minWidth: '68px', textAlign: 'right', color: 'var(--text)' }}>
                    <span>{formatBRL(val)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span className="font-bebas" style={{ fontSize: '18px', letterSpacing: '2px', color: 'var(--text)' }}>Últimas Transações</span>
        <a href="/transactions" style={{ fontSize: '12px', color: 'var(--text3)', textDecoration: 'none' }}>Ver todas →</a>
      </div>
      <div className="card">
        {recent.length === 0 ? (
          <div style={{ padding: '22px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>Nenhuma transação este mês.</div>
        ) : recent.map(t => {
          const c = getCat(t.category)
          return (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', background: 'var(--bg4)', border: '1px solid var(--border)', flexShrink: 0 }}>{c.emoji}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{t.description}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{t.category}</div>
              </div>
              <div>
                <div className="hide-val" style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: t.type === 'income' ? 'var(--green)' : 'var(--text)' }}>
                  <span>{t.type === 'income' ? '+' : '-'}{formatBRL(t.value)}</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', textAlign: 'right' }}>{formatDate(t.date)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
