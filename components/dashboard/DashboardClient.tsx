'use client'

import { useMemo } from 'react'
import { buildMonthRows } from '@/lib/utils/finance'
import { formatBRL, formatDate, MONTHS } from '@/lib/utils/format'
import { useApp } from '@/components/layout/DashboardShell'
import type { Category, Installment, Transaction } from '@/lib/types'

export default function DashboardClient({
  transactions,
  categories,
}: {
  transactions: (Transaction & { installments?: Installment[] })[]
  categories: Category[]
}) {
  const { month, year, incomeSources } = useApp()

  function getCategory(name: string) {
    return categories.find(category => category.name === name) || { emoji: '📦', color: '#555' }
  }

  const monthRows = useMemo(() => buildMonthRows(transactions, incomeSources, year, month), [transactions, incomeSources, year, month])
  const income = monthRows.filter(row => row.type === 'income').reduce((sum, row) => sum + row.value, 0)
  const expenses = monthRows.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.value, 0)

  const categoryTotals = Object.entries(monthRows
    .filter(row => row.type === 'expense')
    .reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + row.value
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  const recent = monthRows.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '18px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span className="font-bebas" style={{ fontSize: '20px', letterSpacing: '2px' }}>Resumo do mes</span>
            <span style={{ color: 'var(--text3)' }}>{MONTHS[month]} {year}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div className="card" style={{ padding: '16px', background: 'var(--bg4)' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Receitas</div>
              <div className="hide-val font-bebas" style={{ fontSize: '30px', color: 'var(--green)' }}><span>{formatBRL(income)}</span></div>
            </div>
            <div className="card" style={{ padding: '16px', background: 'var(--bg4)' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Despesas</div>
              <div className="hide-val font-bebas" style={{ fontSize: '30px', color: 'var(--red)' }}><span>{formatBRL(expenses)}</span></div>
            </div>
            <div className="card" style={{ padding: '16px', background: 'var(--bg4)' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Saldo</div>
              <div className="hide-val font-bebas" style={{ fontSize: '30px', color: income - expenses >= 0 ? 'var(--green)' : 'var(--red)' }}><span>{formatBRL(income - expenses)}</span></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontSize: '16px', fontWeight: 700 }}>Despesas por categoria</div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categoryTotals.length === 0 ? (
              <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '18px 0' }}>Nenhuma despesa neste mes.</div>
            ) : categoryTotals.map(([categoryName, value]) => {
              const category = getCategory(categoryName)
              return (
                <div key={categoryName} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: `${category.color}22`, border: `1px solid ${category.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{category.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{categoryName}</div>
                    <div className="hide-val" style={{ color: 'var(--text3)', marginTop: '2px' }}><span>{formatBRL(value)}</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span className="font-bebas" style={{ fontSize: '20px', letterSpacing: '2px' }}>Ultimos lancamentos do mes</span>
        <a href="/transactions" style={{ fontSize: '14px', color: 'var(--text3)', textDecoration: 'none' }}>Ver todas</a>
      </div>

      <div className="card">
        {recent.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>Nenhum lancamento neste mes.</div>
        ) : recent.map((row, index) => {
          const category = getCategory(row.category)
          return (
            <div key={`${row.date}-${row.description}-${index}`} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: index === recent.length - 1 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${category.color}22`, border: `1px solid ${category.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{category.emoji}</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{row.description}</div>
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{row.category} - {formatDate(row.date)}</div>
              </div>
              <div className="hide-val" style={{ fontSize: '16px', fontWeight: 700, color: row.type === 'income' ? 'var(--green)' : 'var(--text)' }}>
                <span>{row.type === 'income' ? '+' : '-'}{formatBRL(row.value)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
