'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatDate, todayISO } from '@/lib/utils/format'
import type { IncomeSource } from '@/lib/types'

function toast(msg: string) { const t=document.createElement('div');t.className='toast';t.textContent='✓ '+msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200) }

export default function IncomeClient({ initialSources }: { initialSources: IncomeSource[] }) {
  const supabase = createClient()
  const [sources, setSources] = useState(initialSources)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [val, setVal] = useState('')
  const [day, setDay] = useState('')
  const [type, setType] = useState('Salário CLT')
  const [start, setStart] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const total = sources.reduce((s, x) => s + x.value, 0)
  const now = new Date()
  const nextPayment = sources.map(s => {
    let d = new Date(now.getFullYear(), now.getMonth(), s.day)
    if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, s.day)
    return { ...s, _next: d }
  }).sort((a, b) => a._next.getTime() - b._next.getTime())[0]

  async function save() {
    const v = parseFloat(val), d = parseInt(day)
    if (!name || isNaN(v) || v <= 0 || !d) { alert('Preencha todos os campos.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: src } = await supabase.from('income_sources').insert({ user_id: user!.id, name, value: v, day: d, source_type: type, start_date: start }).select().single()
      await supabase.from('events').insert({ user_id: user!.id, description: name, value: v, type: 'income', repeat: 'monthly', day: d, category: 'Salário' })
      setSources(prev => [...prev, src])
      setShowModal(false)
      setName(''); setVal(''); setDay(''); setType('Salário CLT'); setStart(todayISO())
      toast('Renda cadastrada — evento mensal criado automaticamente')
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function del(id: string) {
    if (!confirm('Remover esta fonte de renda?')) return
    await supabase.from('income_sources').delete().eq('id', id)
    setSources(prev => prev.filter(s => s.id !== id))
    toast('Fonte removida')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)' }}>Minha Renda</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Fonte de Renda</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Renda Mensal Total</div>
          <div className="hide-val font-bebas" style={{ fontSize: '28px', color: 'var(--green)', marginBottom: '3px' }}><span>{formatBRL(total)}</span></div>
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{sources.length} fonte(s) cadastrada(s)</div>
        </div>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Próximo Recebimento</div>
          <div className="hide-val font-bebas" style={{ fontSize: '28px', color: 'var(--text)', marginBottom: '3px' }}><span>{nextPayment ? formatBRL(nextPayment.value) : '—'}</span></div>
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{nextPayment ? `${nextPayment.name} — dia ${nextPayment.day} (${nextPayment._next.toLocaleDateString('pt-BR')})` : 'Nenhuma fonte cadastrada'}</div>
        </div>
      </div>

      <div className="font-bebas" style={{ fontSize: '16px', letterSpacing: '2px', marginBottom: '10px', color: 'var(--text)' }}>Fontes de Renda</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sources.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center', padding: '22px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px' }}>Nenhuma fonte cadastrada.</div>
        ) : sources.map(s => (
          <div key={s.id} className="card" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--bg4)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, border: '1px solid var(--border)' }}>💼</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{s.source_type} · desde {formatDate(s.start_date)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hide-val" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}><span>{formatBRL(s.value)}/mês</span></div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Recebe dia {s.day}</div>
            </div>
            <button onClick={() => del(s.id)} style={{ width: '24px', height: '24px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text3)', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>✕</button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box" style={{ width: '430px' }}>
            <div style={{ padding: '17px 22px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '19px', letterSpacing: '2px' }}>Fonte de Renda</span>
              <button onClick={() => setShowModal(false)} style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '11px' }}>✕</button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Nome / Origem</label>
                <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Empresa X, Freelance..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Valor Mensal (R$)</label>
                  <input className="fi" type="number" min="0" step="0.01" value={val} onChange={e => setVal(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Dia de recebimento</label>
                  <input className="fi" type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} placeholder="Ex: 5" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Tipo</label>
                  <select className="fi" value={type} onChange={e => setType(e.target.value)}>
                    <option>Salário CLT</option><option>Salário PJ</option><option>Freelance</option><option>Aluguel</option><option>Investimento</option><option>Outros</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Ativo desde</label>
                  <input className="fi" type="date" value={start} onChange={e => setStart(e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ padding: '13px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
