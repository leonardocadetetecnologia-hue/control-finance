'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api'
import { formatBRL } from '@/lib/utils/format'
import type { Goal } from '@/lib/types'

const EMOJIS = ['🏖️', '🚗', '🏠', '📱', '✈️', '💰', '🎓', '💪', '🏋️', '🎸', '🐕', '🌍']
const COLORS = ['var(--cyan)', 'var(--purple)', 'var(--orange)', 'var(--green)', 'var(--accent)']

function toast(msg: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = '✓ ' + msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

export default function GoalsClient({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [cur, setCur] = useState('')
  const [target, setTarget] = useState('')
  const [emoji, setEmoji] = useState('💰')
  const [saving, setSaving] = useState(false)

  async function save() {
    const t = parseFloat(target)
    if (!name || isNaN(t) || t <= 0) {
      alert('Preencha nome e valor alvo.')
      return
    }
    setSaving(true)
    try {
      const data = await apiRequest<Goal>('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ name, emoji, current_value: parseFloat(cur) || 0, target_value: t }),
      })
      setGoals(prev => [...prev, data])
      setShowModal(false)
      setName('')
      setCur('')
      setTarget('')
      setEmoji('💰')
      toast('Meta criada')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Excluir esta meta?')) return
    await apiRequest<{ ok: true }>(`/api/goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(g => g.id !== id))
    toast('Meta removida')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)' }}>Metas Financeiras</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Meta</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {goals.map((g, i) => {
          const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0
          return (
            <div key={g.id} className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '22px' }}>{g.emoji}</span>
                <button onClick={() => del(g.id)} style={{ width: '22px', height: '22px', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', color: 'var(--text3)', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>×</button>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '3px', color: 'var(--text)' }}>{g.name}</div>
              <div className="hide-val" style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '11px' }}>
                <span>{formatBRL(g.current_value)} / {formatBRL(g.target_value)}</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg4)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: '2px', transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{pct}% concluído</div>
            </div>
          )
        })}
        <div className="card" style={{ padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', color: 'var(--text3)', minHeight: '120px' }} onClick={() => setShowModal(true)}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>+</div>
          <div style={{ fontSize: '12px' }}>Nova meta</div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box" style={{ width: '420px' }}>
            <div style={{ padding: '17px 22px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '19px', letterSpacing: '2px' }}>Nova Meta</span>
              <button onClick={() => setShowModal(false)} style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '11px' }}>×</button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Nome</label>
                <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Reserva de emergência..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Valor atual (R$)</label>
                  <input className="fi" type="number" min="0" value={cur} onChange={e => setCur(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Meta (R$)</label>
                  <input className="fi" type="number" min="0" value={target} onChange={e => setTarget(e.target.value)} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '8px' }}>Ícone</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {EMOJIS.map(e => (
                    <span key={e} onClick={() => setEmoji(e)} style={{ fontSize: '20px', cursor: 'pointer', padding: '4px', borderRadius: '6px', border: `1px solid ${emoji === e ? 'var(--accent)' : 'transparent'}`, transition: 'border-color .12s' }}>{e}</span>
                  ))}
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
