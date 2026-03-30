'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatDate, todayISO, addMonths } from '@/lib/utils/format'
import type { Transaction, Installment, Category } from '@/lib/types'

const PALETTE = ['#00e676','#00e5ff','#e8ff00','#b388ff','#ff9100','#ff3d57','#f06292','#4db6ac','#64b5f6','#ffd54f','#a5d6a7','#ef9a9a','#80cbc4','#ce93d8','#ffcc02','#90caf9']

function toast(msg: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = '✓ ' + msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

export default function TransactionsClient({
  initialTransactions, categories
}: {
  initialTransactions: (Transaction & { installments?: Installment[] })[]
  categories: Category[]
}) {
  const supabase = createClient()
  const [txs, setTxs] = useState(initialTransactions)
  const [showModal, setShowModal] = useState(false)
  const [srch, setSrch] = useState('')
  const [ftype, setFtype] = useState('all')
  const [frecur, setFrecur] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [txType, setTxType] = useState<'income'|'expense'>('expense')
  const [recMode, setRecMode] = useState<'once'|'installment'|'monthly'>('once')
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

  function getCat(name: string) { return categories.find(c => c.name === name) || { emoji: '📦', color: '#555' } }

  async function save() {
    const val = parseFloat(value)
    if (!desc || isNaN(val) || val <= 0 || !date) { alert('Preencha todos os campos.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const category = cat || curCats[0]?.name || 'Outros'

      // Insert transaction
      const txPayload: any = {
        user_id: user!.id, description: desc, value: val,
        type: txType, category, rec_mode: recMode, date
      }
      if (recMode === 'installment') {
        const p = parseInt(parcelas)
        const d = parseInt(diaVenc) || null
        txPayload.total_parcelas = p
        txPayload.dia_venc = d
      }
      if (recMode === 'monthly') {
        txPayload.dia_venc = parseInt(diaVenc) || new Date(date + 'T12:00').getDate()
        if (durMonths) txPayload.dur_months = parseInt(durMonths)
      }

      const { data: tx, error } = await supabase.from('transactions').insert(txPayload).select().single()
      if (error) throw error

      // Insert installments + events
      if (recMode === 'installment') {
        const p = parseInt(parcelas)
        const perVal = val / p
        const d = parseInt(diaVenc) || new Date(date + 'T12:00').getDate()
        const instRows = [], evRows = []
        for (let i = 0; i < p; i++) {
          const instDate = new Date(new Date(date + 'T12:00').getFullYear(), new Date(date + 'T12:00').getMonth() + i, d)
          const ds = instDate.toISOString().split('T')[0]
          instRows.push({ transaction_id: tx.id, user_id: user!.id, n: i + 1, date: ds, value: perVal, paid: false, rolled_over: 0 })
          evRows.push({ user_id: user!.id, transaction_id: tx.id, installment_n: i + 1, description: `${i+1}/${p} ${desc}`, value: perVal, type: txType, repeat: 'once', day: d, date: ds, category })
        }
        await supabase.from('installments').insert(instRows)
        await supabase.from('events').insert(evRows)
        toast(`${p} parcelas criadas no calendário`)
      } else if (recMode === 'monthly') {
        const dia = parseInt(diaVenc) || new Date(date + 'T12:00').getDate()
        const total = parseInt(durMonths) || 12
        const evRows = []
        for (let i = 0; i < total; i++) {
          const d = new Date(new Date(date + 'T12:00').getFullYear(), new Date(date + 'T12:00').getMonth() + i, Math.min(dia, 28))
          evRows.push({ user_id: user!.id, transaction_id: tx.id, description: desc, value: val, type: txType, repeat: 'once', day: d.getDate(), date: d.toISOString().split('T')[0], category })
        }
        await supabase.from('events').insert(evRows)
        toast('Lançamento mensal criado')
      } else {
        await supabase.from('events').insert({ user_id: user!.id, transaction_id: tx.id, description: desc, value: val, type: txType, repeat: 'once', day: new Date(date+'T12:00').getDate(), date, category })
        toast('Transação salva')
      }

      // Reload
      const { data } = await supabase.from('transactions').select('*, installments(*)').eq('user_id', user!.id).order('created_at', { ascending: false })
      setTxs(data || [])
      setShowModal(false)
      resetForm()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setDesc(''); setValue(''); setDate(todayISO()); setCat(''); setParcelas(''); setDiaVenc(''); setDurMonths(''); setRecMode('once'); setTxType('expense')
  }

  async function markPaid(txId: string, instN: number) {
    const tx = txs.find(t => t.id === txId)
    if (!tx?.installments) return
    const inst = tx.installments.find(p => p.n === instN)
    if (!inst) return
    await supabase.from('installments').update({ paid: !inst.paid }).eq('id', inst.id)
    setTxs(prev => prev.map(t => t.id !== txId ? t : { ...t, installments: t.installments?.map(p => p.n !== instN ? p : { ...p, paid: !p.paid }) }))
  }

  async function rollover(txId: string, instN: number) {
    const tx = txs.find(t => t.id === txId)
    if (!tx?.installments) return
    const inst = tx.installments.find(p => p.n === instN)
    if (!inst || inst.paid) return
    const newDate = addMonths(inst.date, 1)
    await supabase.from('installments').update({ date: newDate, rolled_over: (inst.rolled_over || 0) + 1 }).eq('id', inst.id)
    await supabase.from('events').update({ date: newDate }).eq('transaction_id', txId).eq('installment_n', instN)
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
    if (!confirm('Excluir esta transação e todas as parcelas?')) return
    await supabase.from('events').delete().eq('transaction_id', id)
    await supabase.from('installments').delete().eq('transaction_id', id)
    await supabase.from('transactions').delete().eq('id', id)
    setTxs(prev => prev.filter(t => t.id !== id))
    toast('Transação excluída')
  }

  const today2 = todayISO()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)' }}>Transações & Parcelamentos</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>+ Nova</button>
      </div>

      {/* Filters */}
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

      {/* List */}
      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>Nenhuma transação encontrada.</div>
        ) : (
          filtered.map(t => {
            const c = getCat(t.category)
            const paidCount = t.installments?.filter(p => p.paid).length || 0
            const overdueCount = t.installments?.filter(p => !p.paid && p.date < today2).length || 0
            const isExpanded = expandedId === t.id

            return (
              <div key={t.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto auto', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s', cursor: 'default' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', background: 'var(--bg4)', border: '1px solid var(--border)', flexShrink: 0 }}>{c.emoji}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '3px' }}>{t.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {t.rec_mode === 'installment' && <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(179,136,255,.12)', color: 'var(--purple)', padding: '2px 5px', borderRadius: '4px' }}>📋 {t.total_parcelas}x {formatBRL((t.value||0) / (t.total_parcelas||1))}</span>}
                      {t.rec_mode === 'monthly'     && <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(0,229,255,.1)', color: 'var(--cyan)', padding: '2px 5px', borderRadius: '4px' }}>🔁 Mensal{t.dur_months ? ` · ${t.dur_months}x` : ''}</span>}
                      {t.rec_mode === 'once'        && <span style={{ fontSize: '9px', fontWeight: 700, background: 'var(--bg4)', color: 'var(--text3)', padding: '2px 5px', borderRadius: '4px' }}>Avulso</span>}
                      {t.installments && <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{paidCount}/{t.total_parcelas} pagas</span>}
                      {overdueCount > 0 && <span style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 600 }}>⚠ {overdueCount} vencida(s)</span>}
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
                    <button onClick={() => delTx(t.id)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Installment panel */}
                {isExpanded && t.installments && (
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px 16px', marginBottom: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>
                        {t.total_parcelas} parcelas — {formatBRL(t.value / (t.total_parcelas || 1))} cada
                      </span>
                      {overdueCount > 0 && (
                        <button onClick={() => rolloverAll(t.id)} style={{ fontSize: '10px', padding: '2px 10px', border: '1px solid var(--orange)', borderRadius: '5px', background: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          ↷ Adiar todas vencidas ({overdueCount})
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
                            {(p.rolled_over || 0) > 0 && <span style={{ fontSize: '9px', background: 'rgba(255,145,0,.12)', color: 'var(--orange)', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px' }}>↷ adiado {p.rolled_over}x</span>}
                          </div>
                          <div className="hide-val" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}><span>{formatBRL(p.value)}</span></div>
                          <span className={`inst-status ${status}`}>{statusTxt}</span>
                          {!p.paid ? (
                            <button onClick={() => markPaid(t.id, p.n)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border2)', borderRadius: '4px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--green)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                              ✓ Pagar
                            </button>
                          ) : (
                            <button onClick={() => markPaid(t.id, p.n)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border)', borderRadius: '4px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}>
                              ↩ Desfazer
                            </button>
                          )}
                          {!p.paid && (
                            <button onClick={() => rollover(t.id, p.n)} style={{ fontSize: '10px', padding: '2px 7px', border: '1px solid var(--border2)', borderRadius: '4px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: '4px' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--orange)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                              ↷ Adiar
                            </button>
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

      {/* ══ MODAL ══ */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetForm() } }}>
          <div className="modal-box" style={{ width: '480px' }}>
            <div style={{ padding: '17px 22px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
              <span className="font-bebas" style={{ fontSize: '19px', letterSpacing: '2px' }}>Nova Transação</span>
              <button onClick={() => { setShowModal(false); resetForm() }} style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '11px' }}>✕</button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              {/* Type toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', background: 'var(--bg4)', padding: '3px', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                {(['income', 'expense'] as const).map(tp => (
                  <div key={tp} onClick={() => setTxType(tp)} style={{ padding: '7px', textAlign: 'center', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: txType === tp ? (tp === 'income' ? 'rgba(0,150,74,.12)' : 'rgba(217,0,32,.1)') : 'transparent', color: txType === tp ? (tp === 'income' ? 'var(--green)' : 'var(--red)') : 'var(--text3)', transition: 'all .12s' }}>
                    {tp === 'income' ? '↑ Receita' : '↓ Despesa'}
                  </div>
                ))}
              </div>

              {/* Desc */}
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Descrição</label>
                <input className="fi" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Cartão Nubank, Salário..." />
              </div>

              {/* Value + Date */}
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

              {/* Rec mode */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '6px' }}>Tipo de lançamento</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3px', background: 'var(--bg4)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {[{ key: 'once', l: 'Avulso', s: 'sem repetição' }, { key: 'installment', l: 'Parcelado', s: 'N parcelas' }, { key: 'monthly', l: 'Mensal fixo', s: 'todo mês' }].map(r => (
                    <div key={r.key} onClick={() => setRecMode(r.key as any)} style={{ padding: '7px 4px', textAlign: 'center', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, lineHeight: 1.2, background: recMode === r.key ? 'var(--bg2)' : 'transparent', color: recMode === r.key ? 'var(--text)' : 'var(--text3)', transition: 'all .12s', boxShadow: recMode === r.key ? '0 1px 3px var(--shadow)' : 'none' }}>
                      {r.l}<br /><span style={{ fontSize: '9px', opacity: .6 }}>{r.s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Once: just category */}
              {recMode === 'once' && (
                <div style={{ marginBottom: '13px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Categoria</label>
                  <select className="fi" value={cat} onChange={e => setCat(e.target.value)}>
                    {curCats.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Installment */}
              {recMode === 'installment' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Nº parcelas</label>
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
                  {parcelas && value && (
                    <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '9px', padding: '10px 14px', marginBottom: '13px', fontSize: '11px', color: 'var(--text2)' }}>
                      <strong>{parcelas}x</strong> de <strong>{formatBRL(parseFloat(value) / parseInt(parcelas))}</strong> = Total {formatBRL(parseFloat(value))} — vencimento dia {diaVenc || '(mesmo da 1ª)'}
                    </div>
                  )}
                </>
              )}

              {/* Monthly */}
              {recMode === 'monthly' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Dia do mês</label>
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
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Meses de duração (opcional)</label>
                    <input className="fi" type="number" min="1" value={durMonths} onChange={e => setDurMonths(e.target.value)} placeholder="Deixe vazio = 12 meses" />
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '13px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--bg2)', zIndex: 1 }}>
              <button className="btn-ghost" onClick={() => { setShowModal(false); resetForm() }}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
