'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api'
import { formatBRL, formatDate, todayISO, addMonths } from '@/lib/utils/format'
import type { Transaction, Installment, Category } from '@/lib/types'

function toast(msg: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = 'OK ' + msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

export default function TransactionsClient({
  initialTransactions, categories
}: {
  initialTransactions: (Transaction & { installments?: Installment[] })[]
  categories: Category[]
}) {
  const [txs, setTxs] = useState(initialTransactions)
  const [showModal, setShowModal] = useState(false)
  const [srch, setSrch] = useState('')
  const [ftype, setFtype] = useState('all')
  const [frecur, setFrecur] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [txType, setTxType] = useState<'income' | 'expense'>('expense')
  const [recMode, setRecMode] = useState<'once' | 'installment' | 'monthly'>('once')
  const [desc, setDesc] = useState('')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayISO())
  const [cat, setCat] = useState('')
  const [parcelas, setParcelas] = useState('')
  const [diaVenc, setDiaVenc] = useState('')
  const [durMonths, setDurMonths] = useState('')
  const [saving, setSaving] = useState(false)

  const expCats = categories.filter(c => c.type === 'expense' || c.type === 'both')
  const incCats = categories.filter(c => c.type === 'income' || c.type === 'both')
  const curCats = txType === 'income' ? incCats : expCats

  const filtered = txs.filter(t =>
    (!srch || t.description.toLowerCase().includes(srch.toLowerCase()) || t.category.toLowerCase().includes(srch.toLowerCase())) &&
    (ftype === 'all' || t.type === ftype) &&
    (frecur === 'all' || t.rec_mode === frecur)
  )

  function getCat(name: string) {
    return categories.find(c => c.name === name) || { emoji: '📦', color: '#555' }
  }

  async function save() {
    const val = parseFloat(value)
    if (!desc || isNaN(val) || val <= 0 || !date) {
      alert('Preencha todos os campos.')
      return
    }
    setSaving(true)
    try {
      const category = cat || curCats[0]?.name || 'Outros'
      const txPayload: any = { description: desc, value: val, type: txType, category, rec_mode: recMode, date }
      if (recMode === 'installment') {
        txPayload.total_parcelas = parseInt(parcelas)
        txPayload.dia_venc = parseInt(diaVenc) || null
      }
      if (recMode === 'monthly') {
        txPayload.dia_venc = parseInt(diaVenc) || new Date(date + 'T12:00').getDate()
        if (durMonths) txPayload.dur_months = parseInt(durMonths)
      }

      const data = await apiRequest<{ transactions: (Transaction & { installments?: Installment[] })[] }>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(txPayload),
      })

      if (recMode === 'installment') {
        toast(`${parseInt(parcelas)} parcelas criadas no calendario`)
      } else if (recMode === 'monthly') {
        toast('Lancamento mensal criado')
      } else {
        toast('Transacao salva')
      }

      setTxs(data.transactions || [])
      setShowModal(false)
      resetForm()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setDesc('')
    setValue('')
    setDate(todayISO())
    setCat('')
    setParcelas('')
    setDiaVenc('')
    setDurMonths('')
    setRecMode('once')
    setTxType('expense')
  }

  async function markPaid(txId: string, instN: number) {
    const tx = txs.find(t => t.id === txId)
    if (!tx?.installments) return
    const inst = tx.installments.find(p => p.n === instN)
    if (!inst) return
    await apiRequest<Installment>(`/api/installments/${inst.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ paid: !inst.paid }),
    })
    setTxs(prev => prev.map(t => t.id !== txId ? t : { ...t, installments: t.installments?.map(p => p.n !== instN ? p : { ...p, paid: !p.paid }) }))
  }

  async function rollover(txId: string, instN: number) {
    const tx = txs.find(t => t.id === txId)
    if (!tx?.installments) return
    const inst = tx.installments.find(p => p.n === instN)
    if (!inst || inst.paid) return
    const newDate = addMonths(inst.date, 1)
    await apiRequest<Installment>(`/api/installments/${inst.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        date: newDate,
        rolled_over: (inst.rolled_over || 0) + 1,
        transaction_id: txId,
        installment_n: instN,
      }),
    })
    setTxs(prev => prev.map(t => t.id !== txId ? t : { ...t, installments: t.installments?.map(p => p.n !== instN ? p : { ...p, date: newDate, rolled_over: (p.rolled_over || 0) + 1 }) }))
    toast(`Parcela ${instN} adiada para ${new Date(newDate + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`)
  }

  async function rolloverAll(txId: string) {
    const tx = txs.find(t => t.id === txId)
    if (!tx?.installments) return
    const today2 = todayISO()
    const overdue = tx.installments.filter(p => !p.paid && p.date < today2)
    for (const p of overdue) await rollover(txId, p.n)
  }

  async function delTx(id: string) {
    if (!confirm('Excluir esta transacao e todas as parcelas?')) return
    await apiRequest<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' })
    setTxs(prev => prev.filter(t => t.id !== id))
    toast('Transacao excluida')
  }

  const today2 = todayISO()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)' }}>Transacoes & Parcelamentos</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>+ Nova</button>
      </div>

      <div style={{ display: 'flex', gap: '9px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input className="fi" style={{ maxWidth: '220px' }} placeholder="Buscar..." value={srch} onChange={e => setSrch(e.target.value)} />
        <select className="fi" style={{ maxWidth: '140px' }} value={ftype} onChange={e => setFtype(e.target.value)}>
          <option value="all">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option>
        </select>
        <select className="fi" style={{ maxWidth: '170px' }} value={frecur} onChange={e => setFrecur(e.target.value)}>
          <option value="all">Todos os tipos</option>
          <option value="once">Avulso</option>
          <option value="installment">Parcelado</option>
          <option value="monthly">Mensal fixo</option>
        </select>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>Nenhuma transacao encontrada.</div>
        ) : (
          filtered.map(t => {
            const c = getCat(t.category)
            const paidCount = t.installments?.filter(p => p.paid).length || 0
            const overdueCount = t.installments?.filter(p => !p.paid && p.date < today2).length || 0
            const isExpanded = expandedId === t.id

            return (
              <div key={t.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto auto', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', background: 'var(--bg4)', border: '1px solid var(--border)', flexShrink: 0 }}>{c.emoji}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '3px' }}>{t.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {t.rec_mode === 'installment' && <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(179,136,255,.12)', color: 'var(--purple)', padding: '2px 5px', borderRadius: '4px' }}>[PARC] {t.total_parcelas}x {formatBRL((t.value || 0) / (t.total_parcelas || 1))}</span>}
                      {t.rec_mode === 'monthly' && <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(0,229,255,.1)', color: 'var(--cyan)', padding: '2px 5px', borderRadius: '4px' }}>[MENSAL]{t.dur_months ? ` - ${t.dur_months}x` : ''}</span>}
                      {t.rec_mode === 'once' && <span style={{ fontSize: '9px', fontWeight: 700, background: 'var(--bg4)', color: 'var(--text3)', padding: '2px 5px', borderRadius: '4px' }}>Avulso</span>}
                      {t.installments && <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{paidCount}/{t.total_parcelas} pagas</span>}
                      {overdueCount > 0 && <span style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 600 }}>[ATENCAO] {overdueCount} vencida(s)</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="hide-val" style={{ fontSize: '13px', fontWeight: 600, color: t.type === 'income' ? 'var(--green)' : 'var(--text)' }}>
                      <span>{t.type === 'income' ? '+' : '-'}{formatBRL(t.value)}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{formatDate(t.date)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    {t.installments && (
                      <button onClick={() => setExpandedId(isExpanded ? null : t.id)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: isExpanded ? 'var(--purple)' : 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {isExpanded ? 'Fechar' : 'Ver parcelas'}
                      </button>
                    )}
                    <button onClick={() => delTx(t.id)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Excluir
                    </button>
                  </div>
                </div>

                {isExpanded && t.installments && (
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px 16px', marginBottom: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>
                        {t.total_parcelas} parcelas - {formatBRL(t.value / (t.total_parcelas || 1))} cada
                      </span>
                      {overdueCount > 0 && (
                        <button onClick={() => rolloverAll(t.id)} style={{ fontSize: '10px', padding: '2px 10px', border: '1px solid var(--orange)', borderRadius: '5px', background: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Adiar todas vencidas ({overdueCount})
                        </button>
                      )}
                    </div>
                    {t.installments.map(p => {
                      const isOverdue = !p.paid && p.date < today2
                      const status = p.paid ? 'paid' : isOverdue ? 'overdue' : 'pending'
                      const statusTxt = p.paid ? 'Paga' : isOverdue ? 'Vencida' : 'Pendente'
                      return (
                        <div key={p.n} className="inst-row">
                          <div className={`inst-num ${status}`}>{p.n}</div>
                          <div style={{ flex: 1, fontSize: '11px', color: 'var(--text2)' }}>
                            {new Date(p.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {(p.rolled_over || 0) > 0 && <span style={{ fontSize: '9px', background: 'rgba(255,145,0,.12)', color: 'var(--orange)', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px' }}>adiado {p.rolled_over}x</span>}
                          </div>
                          <div className="hide-val" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}><span>{formatBRL(p.value)}</span></div>
                          <span className={`inst-status ${status}`}>{statusTxt}</span>
                          {!p.paid ? (
                            <button onClick={() => markPaid(t.id, p.n)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border2)', borderRadius: '4px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}>Pagar</button>
                          ) : (
                            <button onClick={() => markPaid(t.id, p.n)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border)', borderRadius: '4px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}>Desfazer</button>
                          )}
                          {!p.paid && (
                            <button onClick={() => rollover(t.id, p.n)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border2)', borderRadius: '4px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: '4px' }}>Adiar</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetForm() } }}>
          <div className="modal-box" style={{ width: '480px' }}>
            <div style={{ padding: '17px 22px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
              <span className="font-bebas" style={{ fontSize: '19px', letterSpacing: '2px' }}>Nova Transacao</span>
              <button onClick={() => { setShowModal(false); resetForm() }} style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '11px' }}>X</button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', background: 'var(--bg4)', padding: '3px', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                {(['income', 'expense'] as const).map(tp => (
                  <div key={tp} onClick={() => setTxType(tp)} style={{ padding: '7px', textAlign: 'center', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: txType === tp ? (tp === 'income' ? 'rgba(0,150,74,.12)' : 'rgba(217,0,32,.1)') : 'transparent', color: txType === tp ? (tp === 'income' ? 'var(--green)' : 'var(--red)') : 'var(--text3)' }}>
                    {tp === 'income' ? 'Receita' : 'Despesa'}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Descricao</label>
                <input className="fi" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Cartao Nubank, Salario..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Valor total (R$)</label>
                  <input className="fi" type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Data</label>
                  <input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '6px' }}>Tipo de lancamento</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3px', background: 'var(--bg4)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {[{ key: 'once', l: 'Avulso', s: 'sem repeticao' }, { key: 'installment', l: 'Parcelado', s: 'N parcelas' }, { key: 'monthly', l: 'Mensal fixo', s: 'todo mes' }].map(r => (
                    <div key={r.key} onClick={() => setRecMode(r.key as any)} style={{ padding: '7px 4px', textAlign: 'center', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, lineHeight: 1.2, background: recMode === r.key ? 'var(--bg2)' : 'transparent', color: recMode === r.key ? 'var(--text)' : 'var(--text3)' }}>
                      {r.l}<br /><span style={{ fontSize: '9px', opacity: .6 }}>{r.s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {recMode === 'once' && (
                <div style={{ marginBottom: '13px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Categoria</label>
                  <select className="fi" value={cat} onChange={e => setCat(e.target.value)}>
                    {curCats.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
              )}

              {recMode === 'installment' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>No parcelas</label>
                    <input className="fi" type="number" min="2" max="360" value={parcelas} onChange={e => setParcelas(e.target.value)} placeholder="Ex: 12" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Dia venc.</label>
                    <input className="fi" type="number" min="1" max="31" value={diaVenc} onChange={e => setDiaVenc(e.target.value)} placeholder="Ex: 10" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Categoria</label>
                    <select className="fi" value={cat} onChange={e => setCat(e.target.value)}>
                      {curCats.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {recMode === 'monthly' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Dia do mes</label>
                      <input className="fi" type="number" min="1" max="31" value={diaVenc} onChange={e => setDiaVenc(e.target.value)} placeholder="Ex: 5" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Categoria</label>
                      <select className="fi" value={cat} onChange={e => setCat(e.target.value)}>
                        {curCats.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: '13px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Meses de duracao (opcional)</label>
                    <input className="fi" type="number" min="1" value={durMonths} onChange={e => setDurMonths(e.target.value)} placeholder="Deixe vazio = 12 meses" />
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '13px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => { setShowModal(false); resetForm() }}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
