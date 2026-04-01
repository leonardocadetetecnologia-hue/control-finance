'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { exportCSV } from '@/lib/utils/export'
import { expandTransactionsForMonth } from '@/lib/utils/finance'
import { formatBRL, formatDate, todayISO } from '@/lib/utils/format'
import { useApp } from '@/components/layout/DashboardShell'
import type { Category, Installment, Transaction } from '@/lib/types'

type TransactionRecord = Transaction & { installments?: Installment[] }

function toast(msg: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = 'OK ' + msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

function countMonthsInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  return Math.max(1, months)
}

export default function TransactionsClient({
  initialTransactions,
  categories,
}: {
  initialTransactions: TransactionRecord[]
  categories: Category[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { month, year } = useApp()

  const [txs, setTxs] = useState(initialTransactions)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [srch, setSrch] = useState('')
  const [ftype, setFtype] = useState<'all' | 'income' | 'expense'>('all')
  const [frecur, setFrecur] = useState<'all' | 'once' | 'installment' | 'monthly'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [txType, setTxType] = useState<'income' | 'expense'>('expense')
  const [recMode, setRecMode] = useState<'once' | 'installment' | 'monthly'>('once')
  const [desc, setDesc] = useState('')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayISO())
  const [cat, setCat] = useState('')
  const [parcelas, setParcelas] = useState('12')
  const [diaVenc, setDiaVenc] = useState('')
  const [endMode, setEndMode] = useState<'end' | 'no_end'>('end')
  const [endDate, setEndDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const expCats = categories.filter(category => category.type === 'expense' || category.type === 'both')
  const incCats = categories.filter(category => category.type === 'income' || category.type === 'both')
  const curCats = txType === 'income' ? incCats : expCats

  useEffect(() => {
    const typeFilter = searchParams.get('type')
    if (typeFilter === 'income' || typeFilter === 'expense') {
      setFtype(typeFilter)
    } else {
      setFtype('all')
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    openNew()
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('new')
    router.replace(nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname)
  }, [pathname, router, searchParams])

  const filtered = useMemo(() => txs.filter(transaction =>
    (!srch || transaction.description.toLowerCase().includes(srch.toLowerCase()) || transaction.category.toLowerCase().includes(srch.toLowerCase())) &&
    (ftype === 'all' || transaction.type === ftype) &&
    (frecur === 'all' || transaction.rec_mode === frecur),
  ), [txs, srch, ftype, frecur])

  const monthRows = useMemo(
    () => expandTransactionsForMonth(txs, year, month),
    [txs, year, month],
  )

  function openNew() {
    setEditingId(null)
    setShowModal(true)
    setExpandedId(null)
    setTxType(searchParams.get('type') === 'income' ? 'income' : 'expense')
    setRecMode('once')
    setDesc('')
    setValue('')
    setDate(todayISO())
    setCat('')
    setParcelas('12')
    setDiaVenc('')
    setEndMode('end')
    setEndDate(todayISO())
  }

  function openEdit(transaction: TransactionRecord) {
    setEditingId(transaction.id)
    setShowModal(true)
    setTxType(transaction.type)
    setRecMode(transaction.rec_mode)
    setDesc(transaction.description)
    setValue(String(transaction.value))
    setDate(transaction.date)
    setCat(transaction.category)
    setParcelas(String(transaction.total_parcelas || 12))
    setDiaVenc(transaction.dia_venc ? String(transaction.dia_venc) : '')
    if (transaction.rec_mode === 'monthly' && transaction.dur_months) {
      setEndMode('end')
      const end = new Date(`${transaction.date}T12:00:00`)
      end.setMonth(end.getMonth() + transaction.dur_months - 1)
      setEndDate(end.toISOString().split('T')[0])
    } else {
      setEndMode('no_end')
      setEndDate(transaction.date)
    }
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
  }

  async function reloadTransactions() {
    const response = await apiRequest<{ transactions: TransactionRecord[] }>('/api/transactions', {
      method: 'GET',
    })
    setTxs(response.transactions || [])
  }

  async function save() {
    const totalValue = parseFloat(value)
    if (!desc || isNaN(totalValue) || totalValue <= 0 || !date) {
      alert('Preencha descricao, valor e data inicial.')
      return
    }

    if (recMode === 'installment' && Number(parcelas) < 2) {
      alert('Informe pelo menos 2 parcelas.')
      return
    }

    const category = cat || curCats[0]?.name || 'Outros'
    const payload: any = {
      description: desc,
      value: totalValue,
      type: txType,
      category,
      rec_mode: recMode,
      date,
    }

    if (recMode === 'installment') {
      payload.total_parcelas = Number(parcelas)
      payload.dia_venc = diaVenc ? Number(diaVenc) : null
    }

    if (recMode === 'monthly') {
      payload.dia_venc = diaVenc ? Number(diaVenc) : new Date(`${date}T12:00:00`).getDate()
      payload.dur_months = endMode === 'end' ? countMonthsInclusive(date, endDate) : null
    }

    setSaving(true)
    try {
      if (editingId) {
        await apiRequest<{ ok: true }>(`/api/transactions/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast('Transacao atualizada')
        await reloadTransactions()
      } else {
        const response = await apiRequest<{ transactions: TransactionRecord[] }>('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setTxs(response.transactions || [])
        toast(recMode === 'monthly' ? 'Recorrencia criada' : 'Transacao criada')
        closeModal()
        setSaving(false)
        return
      }

      closeModal()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function delTx(id: string) {
    if (!confirm('Excluir esta transacao e todos os lancamentos vinculados?')) return
    await apiRequest<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' })
    setTxs(prev => prev.filter(transaction => transaction.id !== id))
    toast('Transacao removida')
  }

  async function markPaid(txId: string, installmentId: string, currentValue: boolean) {
    await apiRequest(`/api/installments/${installmentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ paid: !currentValue }),
    })
    setTxs(prev => prev.map(transaction => (
      transaction.id !== txId
        ? transaction
        : {
            ...transaction,
            installments: (transaction.installments || []).map(installment => (
              installment.id === installmentId
                ? { ...installment, paid: !currentValue }
                : installment
            )),
          }
    )))
  }

  function exportMonthCsv() {
    exportCSV(
      monthRows.map(row => ({
        ...row,
      })),
      `finance-control-${year}-${String(month + 1).padStart(2, '0')}.csv`,
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
        <h1 className="font-bebas" style={{ fontSize: '28px', letterSpacing: '2px', color: 'var(--text)' }}>Transacoes</h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={exportMonthCsv}>Exportar CSV do mes</button>
          <button className="btn-primary" onClick={openNew}>+ Nova transacao</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Lancamentos no mes</div>
          <div className="font-bebas" style={{ fontSize: '32px' }}>{monthRows.length}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Receitas no mes</div>
          <div className="hide-val font-bebas" style={{ fontSize: '32px', color: 'var(--green)' }}>
            <span>{formatBRL(monthRows.filter(row => row.type === 'income').reduce((sum, row) => sum + row.value, 0))}</span>
          </div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Despesas no mes</div>
          <div className="hide-val font-bebas" style={{ fontSize: '32px', color: 'var(--red)' }}>
            <span>{formatBRL(monthRows.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.value, 0))}</span>
          </div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: '6px' }}>Recorrencias</div>
          <div className="font-bebas" style={{ fontSize: '32px' }}>{txs.filter(item => item.rec_mode === 'monthly').length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input className="fi" style={{ maxWidth: '230px' }} placeholder="Buscar descricao ou categoria..." value={srch} onChange={e => setSrch(e.target.value)} />
        <select className="fi" style={{ maxWidth: '150px' }} value={ftype} onChange={e => setFtype(e.target.value as any)}>
          <option value="all">Todos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select className="fi" style={{ maxWidth: '170px' }} value={frecur} onChange={e => setFrecur(e.target.value as any)}>
          <option value="all">Todas recorrencias</option>
          <option value="once">Avulso</option>
          <option value="installment">Parcelado</option>
          <option value="monthly">Recorrente</option>
        </select>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text3)' }}>Nenhuma transacao encontrada.</div>
        ) : filtered.map((transaction) => {
          const paidInstallments = (transaction.installments || []).filter(installment => installment.paid).length
          const totalInstallments = transaction.installments?.length || 0
          const isExpanded = expandedId === transaction.id

          return (
            <div key={transaction.id} style={{ borderBottom: '1px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '14px', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '16px' }}>{transaction.description}</strong>
                    <span className={transaction.type === 'income' ? 'badge-income' : 'badge-expense'}>
                      {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                    {transaction.rec_mode === 'monthly' && <span className="badge-income">Recorrente</span>}
                    {transaction.rec_mode === 'installment' && <span className="badge-expense">Parcelado</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', color: 'var(--text2)', fontSize: '14px' }}>
                    <span>{transaction.category}</span>
                    <span>Inicio: {formatDate(transaction.date)}</span>
                    <span className="hide-val">{formatBRL(transaction.value)}</span>
                    {transaction.rec_mode === 'monthly' && (
                      <span>{transaction.dur_months ? `Ate ${transaction.dur_months} mes(es)` : 'Sem data de termino'}</span>
                    )}
                    {transaction.rec_mode === 'installment' && (
                      <span>{paidInstallments}/{totalInstallments} parcelas pagas</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {transaction.installments && transaction.installments.length > 0 && (
                    <button className="btn-ghost" onClick={() => setExpandedId(isExpanded ? null : transaction.id)}>
                      {isExpanded ? 'Ocultar parcelas' : 'Ver parcelas'}
                    </button>
                  )}
                  <button className="btn-ghost" onClick={() => openEdit(transaction)}>Alterar</button>
                  <button className="btn-primary" onClick={() => delTx(transaction.id)}>Excluir</button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: '14px', background: 'var(--bg4)', borderRadius: '14px', padding: '12px 14px' }}>
                  {(transaction.installments || []).length === 0 ? (
                    <div style={{ color: 'var(--text3)' }}>Este lancamento nao possui parcelas.</div>
                  ) : (transaction.installments || []).map(installment => (
                    <div key={installment.id} className="inst-row">
                      <div className={`inst-num ${installment.paid ? 'paid' : installment.date < todayISO() ? 'overdue' : ''}`}>{installment.n}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Vencimento {formatDate(installment.date)}</div>
                        <div className="hide-val" style={{ color: 'var(--text2)' }}><span>{formatBRL(installment.value)}</span></div>
                      </div>
                      <span className={`inst-status ${installment.paid ? 'paid' : installment.date < todayISO() ? 'overdue' : 'pending'}`}>
                        {installment.paid ? 'Paga' : installment.date < todayISO() ? 'Vencida' : 'Pendente'}
                      </span>
                      <button className="btn-ghost" onClick={() => markPaid(transaction.id, installment.id, installment.paid)}>
                        {installment.paid ? 'Desfazer' : 'Marcar como paga'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) closeModal() }}>
          <div className="modal-box">
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '24px' }}>{editingId ? 'Alterar transacao' : 'Nova transacao'}</span>
              <button className="btn-ghost" onClick={closeModal}>Fechar</button>
            </div>

            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className={txType === 'income' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTxType('income')}>Receita</button>
                <button className={txType === 'expense' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTxType('expense')}>Despesa</button>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Descricao</label>
                <input className="fi" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Aluguel, cartao, salario..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Valor</label>
                  <input className="fi" type="number" step="0.01" min="0" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Data de inicio</label>
                  <input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Categoria</label>
                  <select className="fi" value={cat} onChange={e => setCat(e.target.value)}>
                    <option value="">Escolher automaticamente</option>
                    {curCats.map(category => (
                      <option key={category.id} value={category.name}>{category.emoji} {category.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Tipo de lancamento</label>
                  <select className="fi" value={recMode} onChange={e => setRecMode(e.target.value as any)}>
                    <option value="once">Avulso</option>
                    <option value="installment">Parcelado</option>
                    <option value="monthly">Recorrente</option>
                  </select>
                </div>
              </div>

              {recMode === 'installment' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Numero de parcelas</label>
                    <input className="fi" type="number" min="2" max="360" value={parcelas} onChange={e => setParcelas(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Dia do vencimento</label>
                    <input className="fi" type="number" min="1" max="31" value={diaVenc} onChange={e => setDiaVenc(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              )}

              {recMode === 'monthly' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Dia recorrente</label>
                      <input className="fi" type="number" min="1" max="31" value={diaVenc} onChange={e => setDiaVenc(e.target.value)} placeholder="Ex: 5" />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Fim da recorrencia</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button className={endMode === 'end' ? 'btn-primary' : 'btn-ghost'} onClick={() => setEndMode('end')}>Com termino</button>
                        <button className={endMode === 'no_end' ? 'btn-primary' : 'btn-ghost'} onClick={() => setEndMode('no_end')}>Sem termino</button>
                      </div>
                    </div>
                  </div>

                  {endMode === 'end' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Data de termino</label>
                      <input className="fi" type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Criar lancamento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
